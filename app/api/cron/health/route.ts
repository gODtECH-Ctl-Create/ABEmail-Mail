import { NextResponse } from 'next/server';
import { getResend } from '@/lib/resend';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { recordIncident, recordSystemEvent } from '@/lib/monitoring';

const MAIL_DOMAIN = 'waste2light.com';
const INBOUND_STALL_MINUTES = 10;

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get('authorization');
  return Boolean(cronSecret && authorization === `Bearer ${cronSecret}`);
}

function toTimestamp(value: string | null | undefined) {
  const timestamp = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : null;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const startedAt = Date.now();
  const supabase = getSupabaseAdmin();
  const results: Record<string, unknown> = {};
  let status: 'healthy' | 'degraded' | 'critical' = 'healthy';

  try {
    const { error: databaseError } = await supabase
      .from('email_messages')
      .select('id')
      .limit(1);

    if (databaseError) {
      status = 'critical';
      await recordSystemEvent({
        eventType: 'health.database.failed',
        severity: 'critical',
        component: 'supabase',
        action: 'health_check',
        message: databaseError.message,
        route: '/api/cron/health',
        httpStatus: 503,
        provider: 'supabase',
        metadata: { check: 'database_query' },
      });
      await recordIncident({
        incidentKey: 'health.supabase.database',
        title: 'Supabase database health check failed',
        severity: 'P1',
        component: 'supabase.database',
        summary: 'Scheduled health check could not query the application database.',
        eventType: 'health.database.failed',
        message: databaseError.message,
        metadata: { automatic: true, check: 'database_query' },
      });
    } else {
      results.database = 'healthy';
    }

    const resendKeyConfigured = Boolean(process.env.RESEND_API_KEY);
    const webhookSecretConfigured = Boolean(process.env.RESEND_WEBHOOK_SECRET);
    const appUrlConfigured = Boolean(process.env.NEXT_PUBLIC_APP_URL);
    results.configuration = {
      resendApiKey: resendKeyConfigured,
      resendWebhookSecret: webhookSecretConfigured,
      appUrl: appUrlConfigured,
      cronSecret: Boolean(process.env.CRON_SECRET),
    };

    if (!resendKeyConfigured || !webhookSecretConfigured || !appUrlConfigured) {
      status = status === 'critical' ? status : 'degraded';
      const missing = [
        !resendKeyConfigured && 'RESEND_API_KEY',
        !webhookSecretConfigured && 'RESEND_WEBHOOK_SECRET',
        !appUrlConfigured && 'NEXT_PUBLIC_APP_URL',
      ].filter(Boolean);
      await recordSystemEvent({
        eventType: 'health.configuration.warning',
        severity: 'warning',
        component: 'configuration',
        action: 'health_check',
        message: `Missing production configuration: ${missing.join(', ')}`,
        route: '/api/cron/health',
        httpStatus: 200,
        metadata: { missing },
      });
    }

    if (resendKeyConfigured) {
      try {
        const resend = getResend();
        const { data: domains, error: domainError } = await resend.domains.list({ limit: 20 });
        if (domainError) throw domainError;

        const domain = domains?.data?.find((item) => item.name?.toLowerCase() === MAIL_DOMAIN);
        const domainHealthy = Boolean(
          domain &&
          domain.status === 'verified' &&
          domain.capabilities?.sending === 'enabled' &&
          domain.capabilities?.receiving === 'enabled',
        );

        results.resend = {
          api: 'reachable',
          domain: domain
            ? {
                name: domain.name,
                status: domain.status,
                sending: domain.capabilities?.sending ?? 'unknown',
                receiving: domain.capabilities?.receiving ?? 'unknown',
              }
            : null,
        };

        if (!domainHealthy) {
          status = status === 'critical' ? status : 'degraded';
          const message = domain
            ? `Waste2Light domain is not fully operational: ${domain.status}`
            : `Waste2Light domain ${MAIL_DOMAIN} was not found in Resend.`;
          await recordSystemEvent({
            eventType: 'health.resend.domain_degraded',
            severity: 'error',
            component: 'resend.domain',
            action: 'health_check',
            message,
            route: '/api/cron/health',
            httpStatus: 200,
            provider: 'resend',
            metadata: { domain: MAIL_DOMAIN },
          });
          await recordIncident({
            incidentKey: 'health.resend.domain',
            title: 'Resend domain is not fully operational',
            severity: 'P2',
            component: 'resend.domain',
            summary: message,
            eventType: 'health.resend.domain_degraded',
            message,
            metadata: { automatic: true, domain: MAIL_DOMAIN },
          });
        }

        const { data: receivedPage, error: receiveListError } = await resend.emails.receiving.list({ limit: 1 });
        if (receiveListError) throw receiveListError;

        const latestProviderInbound = receivedPage?.data?.[0] ?? null;
        const { data: latestLocalInbound, error: latestLocalError } = await supabase
          .from('email_messages')
          .select('resend_email_id,received_at')
          .eq('direction', 'inbound')
          .order('received_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestLocalError) throw latestLocalError;

        const providerCreatedAt = toTimestamp(latestProviderInbound?.created_at);
        const localReceivedAt = toTimestamp(latestLocalInbound?.received_at);
        const now = Date.now();
        const providerIsNewer = Boolean(
          latestProviderInbound &&
          (!latestLocalInbound || latestProviderInbound.id !== latestLocalInbound.resend_email_id) &&
          providerCreatedAt !== null &&
          now - providerCreatedAt > INBOUND_STALL_MINUTES * 60 * 1000,
        );

        results.inbound = {
          latestProviderEmailId: latestProviderInbound?.id ?? null,
          latestProviderCreatedAt: latestProviderInbound?.created_at ?? null,
          latestLocalEmailId: latestLocalInbound?.resend_email_id ?? null,
          latestLocalReceivedAt: latestLocalInbound?.received_at ?? null,
          stalled: providerIsNewer,
        };

        if (providerIsNewer) {
          status = status === 'critical' ? status : 'degraded';
          const lagMinutes = providerCreatedAt && localReceivedAt
            ? Math.max(0, Math.round((providerCreatedAt - localReceivedAt) / 60000))
            : null;
          const message = `Resend has a newer inbound email than ABEmail. Possible webhook or persistence stall (${lagMinutes ?? 'unknown'} minutes).`;
          await recordSystemEvent({
            eventType: 'health.inbound.stalled',
            severity: 'error',
            component: 'resend.webhook',
            action: 'health_check',
            message,
            route: '/api/cron/health',
            httpStatus: 200,
            provider: 'resend',
            providerEventId: latestProviderInbound?.id,
            metadata: { automatic: true, lagMinutes, thresholdMinutes: INBOUND_STALL_MINUTES },
          });
          await recordIncident({
            incidentKey: 'health.inbound.pipeline',
            title: 'Inbound email pipeline may be stalled',
            severity: 'P2',
            component: 'resend.webhook',
            summary: message,
            eventType: 'health.inbound.stalled',
            message,
            providerEventId: latestProviderInbound?.id,
            metadata: { automatic: true, lagMinutes, thresholdMinutes: INBOUND_STALL_MINUTES },
          });
        }
      } catch (error) {
        status = status === 'critical' ? status : 'degraded';
        const message = error instanceof Error ? error.message : 'Resend health check failed';
        results.resend = { api: 'unreachable' };
        await recordSystemEvent({
          eventType: 'health.resend.failed',
          severity: 'error',
          component: 'resend',
          action: 'health_check',
          message,
          route: '/api/cron/health',
          httpStatus: 503,
          provider: 'resend',
          metadata: { automatic: true },
        });
        await recordIncident({
          incidentKey: 'health.resend.api',
          title: 'Resend API health check failed',
          severity: 'P2',
          component: 'resend.api',
          summary: 'Scheduled health check could not reach the Resend API.',
          eventType: 'health.resend.failed',
          message,
          metadata: { automatic: true },
        });
      }
    }

    const durationMs = Date.now() - startedAt;
    await recordSystemEvent({
      eventType: `health.check.${status}`,
      severity: status === 'healthy' ? 'info' : status === 'degraded' ? 'warning' : 'critical',
      component: 'health.check',
      action: 'scheduled',
      message: `Scheduled health check completed with status: ${status}`,
      route: '/api/cron/health',
      httpStatus: status === 'critical' ? 503 : 200,
      durationMs,
      metadata: results,
    });

    return NextResponse.json({
      ok: status !== 'critical',
      status,
      generatedAt: new Date().toISOString(),
      durationMs,
      checks: results,
    }, { status: status === 'critical' ? 503 : 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Health check failed';
    await recordSystemEvent({
      eventType: 'health.check.error',
      severity: 'critical',
      component: 'health.check',
      action: 'scheduled',
      message,
      route: '/api/cron/health',
      httpStatus: 503,
      durationMs: Date.now() - startedAt,
      metadata: { automatic: true },
    });
    await recordIncident({
      incidentKey: 'health.check.execution',
      title: 'Scheduled health check failed to complete',
      severity: 'P1',
      component: 'health.check',
      summary: 'The scheduled operations health check itself failed unexpectedly.',
      eventType: 'health.check.error',
      message,
      metadata: { automatic: true },
    });
    return NextResponse.json({ ok: false, status: 'critical', error: 'Health check failed.' }, { status: 503 });
  }
}
