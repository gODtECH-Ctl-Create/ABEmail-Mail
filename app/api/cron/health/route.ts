import { NextResponse } from 'next/server';
import { promises as dns } from 'node:dns';
import { getResend } from '@/lib/resend';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { recordIncident, recordSystemEvent } from '@/lib/monitoring';

const MAIL_DOMAIN = 'waste2light.com';
const INBOUND_STALL_MINUTES = 10;

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  return Boolean(cronSecret && request.headers.get('authorization') === `Bearer ${cronSecret}`);
}

function toTimestamp(value: string | null | undefined) {
  const timestamp = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : null;
}

async function resolveMx(host: string) {
  try { return await dns.resolveMx(host); } catch { return []; }
}

async function resolveTxt(host: string) {
  try { return await dns.resolveTxt(host); } catch { return []; }
}

function flattenTxt(records: string[][]) {
  return records.map((parts) => parts.join('')).map((value) => value.toLowerCase());
}

async function checkDns() {
  const [mxRecords, spfRecords, dmarcRecords] = await Promise.all([
    resolveMx(MAIL_DOMAIN),
    resolveTxt(MAIL_DOMAIN),
    resolveTxt(`_dmarc.${MAIL_DOMAIN}`),
  ]);

  const spf = flattenTxt(spfRecords).filter((value) => value.includes('v=spf1'));
  const dmarc = flattenTxt(dmarcRecords).filter((value) => value.includes('v=dmarc1'));

  return {
    mx: { healthy: mxRecords.length > 0, records: mxRecords.slice(0, 5) },
    spf: { healthy: spf.length > 0, records: spf.slice(0, 3) },
    dmarc: { healthy: dmarc.length > 0, records: dmarc.slice(0, 3) },
  };
}

async function reportHealthIssue(input: {
  incidentKey: string;
  title: string;
  severity: 'P1' | 'P2' | 'P3' | 'P4';
  component: string;
  summary: string;
  eventType: string;
  message: string;
  metadata?: Record<string, unknown>;
}) {
  await recordSystemEvent({
    eventType: input.eventType,
    severity: input.severity === 'P1' ? 'critical' : input.severity === 'P2' ? 'error' : 'warning',
    component: input.component,
    action: 'health_check',
    message: input.message,
    route: '/api/cron/health',
    httpStatus: input.severity === 'P1' ? 503 : 200,
    provider: input.component.startsWith('resend') ? 'resend' : input.component.startsWith('dns') ? 'dns' : 'supabase',
    metadata: input.metadata,
  });
  await recordIncident({ ...input, metadata: { automatic: true, ...(input.metadata ?? {}) } });
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return new Response('Unauthorized', { status: 401 });

  const startedAt = Date.now();
  const supabase = getSupabaseAdmin();
  const results: Record<string, unknown> = {};
  let status: 'healthy' | 'degraded' | 'critical' = 'healthy';

  try {
    const { error: databaseError } = await supabase.from('email_messages').select('id').limit(1);
    if (databaseError) {
      status = 'critical';
      await reportHealthIssue({ incidentKey: 'health.supabase.database', title: 'Supabase database health check failed', severity: 'P1', component: 'supabase.database', summary: 'Scheduled health check could not query the application database.', eventType: 'health.database.failed', message: databaseError.message, metadata: { check: 'database_query' } });
    } else results.database = 'healthy';

    const requiredConfig = {
      resendApiKey: Boolean(process.env.RESEND_API_KEY),
      webhookSecret: Boolean(process.env.RESEND_WEBHOOK_SECRET),
      appUrl: Boolean(process.env.NEXT_PUBLIC_APP_URL),
      cronSecret: Boolean(process.env.CRON_SECRET),
    };
    results.configuration = requiredConfig;
    const missing = Object.entries(requiredConfig).filter(([, value]) => !value).map(([key]) => key);
    if (missing.length) {
      status = status === 'critical' ? status : 'degraded';
      await recordSystemEvent({ eventType: 'health.configuration.warning', severity: 'warning', component: 'configuration', action: 'health_check', message: `Missing production configuration: ${missing.join(', ')}`, route: '/api/cron/health', httpStatus: 200, metadata: { missing } });
    }

    if (process.env.RESEND_API_KEY) {
      try {
        const resend = getResend();
        const { data: domains, error: domainError } = await resend.domains.list({ limit: 20 });
        if (domainError) throw domainError;
        const domain = domains?.data?.find((item) => item.name?.toLowerCase() === MAIL_DOMAIN);
        const domainHealthy = Boolean(domain && domain.status === 'verified' && domain.capabilities?.sending === 'enabled' && domain.capabilities?.receiving === 'enabled');
        results.resend = { api: 'reachable', domain: domain ? { name: domain.name, status: domain.status, sending: domain.capabilities?.sending ?? 'unknown', receiving: domain.capabilities?.receiving ?? 'unknown' } : null };
        if (!domainHealthy) {
          status = status === 'critical' ? status : 'degraded';
          const message = domain ? `Waste2Light domain is not fully operational: ${domain.status}` : `Waste2Light domain ${MAIL_DOMAIN} was not found in Resend.`;
          await reportHealthIssue({ incidentKey: 'health.resend.domain', title: 'Resend domain is not fully operational', severity: 'P2', component: 'resend.domain', summary: message, eventType: 'health.resend.domain_degraded', message, metadata: { domain: MAIL_DOMAIN } });
        }

        const { data: receivedPage, error: receiveListError } = await resend.emails.receiving.list({ limit: 1 });
        if (receiveListError) throw receiveListError;
        const latestProviderInbound = receivedPage?.data?.[0] ?? null;
        const { data: latestLocalInbound, error: latestLocalError } = await supabase.from('email_messages').select('resend_email_id,received_at').eq('direction', 'inbound').order('received_at', { ascending: false }).limit(1).maybeSingle();
        if (latestLocalError) throw latestLocalError;
        const providerCreatedAt = toTimestamp(latestProviderInbound?.created_at);
        const providerIsNewer = Boolean(latestProviderInbound && (!latestLocalInbound || latestProviderInbound.id !== latestLocalInbound.resend_email_id) && providerCreatedAt !== null && Date.now() - providerCreatedAt > INBOUND_STALL_MINUTES * 60 * 1000);
        results.inbound = { latestProviderEmailId: latestProviderInbound?.id ?? null, latestProviderCreatedAt: latestProviderInbound?.created_at ?? null, latestLocalEmailId: latestLocalInbound?.resend_email_id ?? null, latestLocalReceivedAt: latestLocalInbound?.received_at ?? null, stalled: providerIsNewer };
        if (providerIsNewer) {
          status = status === 'critical' ? status : 'degraded';
          const message = 'Resend has a newer inbound email than ABEmail. Possible webhook or persistence stall.';
          await reportHealthIssue({ incidentKey: 'health.inbound.pipeline', title: 'Inbound email pipeline may be stalled', severity: 'P2', component: 'resend.webhook', summary: message, eventType: 'health.inbound.stalled', message, metadata: { thresholdMinutes: INBOUND_STALL_MINUTES, providerEmailId: latestProviderInbound?.id } });
        }
      } catch (error) {
        status = status === 'critical' ? status : 'degraded';
        const message = error instanceof Error ? error.message : 'Resend health check failed';
        results.resend = { api: 'unreachable' };
        await reportHealthIssue({ incidentKey: 'health.resend.api', title: 'Resend API health check failed', severity: 'P2', component: 'resend.api', summary: 'Scheduled health check could not reach the Resend API.', eventType: 'health.resend.failed', message });
      }
    }

    const dnsChecks = await checkDns();
    results.dns = dnsChecks;
    const unhealthyDns = Object.entries(dnsChecks).filter(([, value]) => !value.healthy).map(([name]) => name);
    if (unhealthyDns.length) {
      status = status === 'critical' ? status : 'degraded';
      const message = `DNS/email authentication checks failed: ${unhealthyDns.join(', ')}`;
      await reportHealthIssue({ incidentKey: `health.dns.${unhealthyDns.join('.')}`, title: 'DNS or email authentication degraded', severity: 'P2', component: 'dns.email', summary: message, eventType: 'health.dns.degraded', message, metadata: { unhealthyDns, domain: MAIL_DOMAIN } });
    }

    const durationMs = Date.now() - startedAt;
    await recordSystemEvent({ eventType: `health.check.${status}`, severity: status === 'healthy' ? 'info' : status === 'degraded' ? 'warning' : 'critical', component: 'health.check', action: 'scheduled', message: `Scheduled health check completed with status: ${status}`, route: '/api/cron/health', httpStatus: status === 'critical' ? 503 : 200, durationMs, metadata: results });
    return NextResponse.json({ ok: status !== 'critical', status, generatedAt: new Date().toISOString(), durationMs, checks: results }, { status: status === 'critical' ? 503 : 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Health check failed';
    await reportHealthIssue({ incidentKey: 'health.check.execution', title: 'Scheduled health check failed to complete', severity: 'P1', component: 'health.check', summary: 'The scheduled operations health check itself failed unexpectedly.', eventType: 'health.check.error', message });
    return NextResponse.json({ ok: false, status: 'critical', error: 'Health check failed.' }, { status: 503 });
  }
}
