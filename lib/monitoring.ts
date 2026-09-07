import 'server-only';

import { getResend } from '@/lib/resend';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

type MonitorEvent = {
  eventType: string;
  severity?: 'info' | 'warning' | 'error' | 'critical';
  component?: string;
  action?: string;
  message?: string;
  requestId?: string | null;
  traceId?: string | null;
  deploymentId?: string | null;
  provider?: string | null;
  providerEventId?: string | null;
  userId?: string | null;
  mailbox?: string | null;
  route?: string | null;
  httpStatus?: number | null;
  durationMs?: number | null;
  metadata?: Record<string, unknown>;
};

type IncidentInput = {
  incidentKey: string;
  title: string;
  severity: 'P1' | 'P2' | 'P3' | 'P4';
  component?: string;
  summary?: string;
  eventType: string;
  message?: string;
  requestId?: string | null;
  deploymentId?: string | null;
  providerEventId?: string | null;
  metadata?: Record<string, unknown>;
};

const safeString = (value: unknown) => (typeof value === 'string' && value.length <= 5000 ? value : undefined);
const adminEmails = () => (process.env.ABEMAIL_ADMIN_EMAILS ?? '').split(',').map((email) => email.trim().toLowerCase()).filter(Boolean);

async function createAdminAlert(input: {
  incidentId: string;
  alertKey: string;
  severity: 'P1' | 'P2' | 'P3' | 'P4';
  title: string;
  message: string;
}) {
  try {
    const supabase = getSupabaseAdmin();
    const { data: existing } = await supabase
      .from('admin_alerts')
      .select('id')
      .eq('alert_key', input.alertKey)
      .maybeSingle();
    if (existing) return;

    const { error } = await supabase.from('admin_alerts').insert({
      incident_id: input.incidentId,
      alert_key: input.alertKey,
      severity: input.severity,
      title: input.title,
      message: safeString(input.message) ?? input.title,
      status: 'new',
    });
    if (error) throw error;

    if (input.severity === 'P1' || input.severity === 'P2') {
      const recipients = adminEmails();
      if (recipients.length) {
        try {
          const resend = getResend();
          await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL ?? recipients[0],
            to: recipients,
            subject: `[ABEmail ${input.severity}] ${input.title}`,
            text: `${input.title}\n\n${safeString(input.message) ?? input.title}\n\nIncident: ${input.alertKey}`,
          });
        } catch (error) {
          console.error('admin alert email delivery failed', error);
        }
      }
    }
  } catch (error) {
    console.error('admin alert write failed', error);
  }
}

async function evaluateAutomaticIncident(event: MonitorEvent) {
  try {
    const supabase = getSupabaseAdmin();

    if (event.severity === 'critical') {
      const incidentKey = `auto.${event.component ?? 'system'}.critical`;
      const incidentId = await recordIncident({
        incidentKey,
        title: `Critical ${event.component ?? 'system'} failure`,
        severity: 'P1',
        component: event.component,
        summary: 'A critical production signal was detected automatically.',
        eventType: event.eventType,
        message: event.message,
        requestId: event.requestId,
        deploymentId: event.deploymentId,
        providerEventId: event.providerEventId,
        metadata: { automatic: true },
      });
      if (incidentId) await createAdminAlert({
        incidentId,
        alertKey: incidentKey,
        severity: 'P1',
        title: `P1: Critical ${event.component ?? 'system'} failure`,
        message: event.message ?? 'A critical production signal was detected.',
      });
      return;
    }

    if (event.severity !== 'error' && event.severity !== 'warning') return;

    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    let query = supabase
      .from('system_events')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since)
      .eq('severity', event.severity);

    if (event.component) query = query.eq('component', event.component);
    if (event.eventType) query = query.eq('event_type', event.eventType);

    const { count } = await query;
    const threshold = event.severity === 'error' ? 3 : 5;
    if ((count ?? 0) < threshold) return;

    const severity = event.severity === 'error' ? 'P2' : 'P3';
    const incidentKey = `auto.${event.component ?? 'system'}.${event.eventType}.burst`;
    const title = `${event.severity === 'error' ? 'Repeated errors' : 'Repeated warnings'}: ${event.component ?? 'system'}`;
    const summary = `${count} matching ${event.severity} signals were recorded in the last 10 minutes.`;

    const incidentId = await recordIncident({
      incidentKey,
      title,
      severity,
      component: event.component,
      summary,
      eventType: 'incident.auto_detected',
      message: summary,
      requestId: event.requestId,
      deploymentId: event.deploymentId,
      metadata: { automatic: true, threshold, observedCount: count, windowMinutes: 10, eventType: event.eventType },
    });

    if (incidentId) await createAdminAlert({
      incidentId,
      alertKey: incidentKey,
      severity,
      title: `${severity}: ${title}`,
      message: summary,
    });
  } catch (error) {
    console.error('automatic incident evaluation failed', error);
  }
}

export async function recordSystemEvent(event: MonitorEvent) {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('system_events').insert({
      event_type: safeString(event.eventType) ?? 'unknown',
      severity: event.severity ?? 'info',
      component: safeString(event.component),
      action: safeString(event.action),
      message: safeString(event.message),
      request_id: safeString(event.requestId),
      trace_id: safeString(event.traceId),
      deployment_id: safeString(event.deploymentId),
      provider: safeString(event.provider),
      provider_event_id: safeString(event.providerEventId),
      user_id: safeString(event.userId),
      mailbox: safeString(event.mailbox),
      route: safeString(event.route),
      http_status: event.httpStatus ?? null,
      duration_ms: event.durationMs ?? null,
      metadata: event.metadata ?? {},
    });
    if (!error) await evaluateAutomaticIncident(event);
  } catch (error) {
    console.error('monitoring event write failed', error);
  }
}

export async function recordIncident(input: IncidentInput) {
  try {
    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();
    const { data: existing } = await supabase
      .from('incidents')
      .select('id,status,severity')
      .eq('incident_key', input.incidentKey)
      .maybeSingle();

    let incidentId: string;
    if (!existing) {
      const { data, error } = await supabase
        .from('incidents')
        .insert({
          incident_key: input.incidentKey,
          title: input.title,
          severity: input.severity,
          status: 'detected',
          component: input.component ?? null,
          summary: input.summary ?? null,
          first_seen_at: now,
          last_seen_at: now,
          metadata: input.metadata ?? {},
        })
        .select('id')
        .single();
      if (error || !data) throw error ?? new Error('Incident was not created');
      incidentId = data.id;
    } else {
      const nextStatus = existing.status === 'resolved' || existing.status === 'closed' ? 'detected' : existing.status;
      incidentId = existing.id;
      await supabase
        .from('incidents')
        .update({
          title: input.title,
          severity: input.severity,
          status: nextStatus,
          component: input.component ?? null,
          summary: input.summary ?? null,
          last_seen_at: now,
          resolved_at: nextStatus === 'detected' ? null : undefined,
          closed_at: nextStatus === 'detected' ? null : undefined,
          metadata: input.metadata ?? {},
        })
        .eq('id', incidentId);
    }

    await supabase.from('incident_events').insert({
      incident_id: incidentId,
      event_type: input.eventType,
      source: input.component ?? 'application',
      message: input.message ?? input.summary ?? null,
      request_id: input.requestId ?? null,
      deployment_id: input.deploymentId ?? null,
      provider_event_id: input.providerEventId ?? null,
      metadata: input.metadata ?? {},
    });

    return incidentId;
  } catch (error) {
    console.error('incident record write failed', error);
    return null;
  }
}

export function requestContext(request: Request) {
  return {
    requestId: request.headers.get('x-request-id') ?? request.headers.get('x-vercel-id'),
    traceId: request.headers.get('traceparent'),
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? null,
  };
}
