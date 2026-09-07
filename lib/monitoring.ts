import 'server-only';

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

export async function recordSystemEvent(event: MonitorEvent) {
  try {
    const supabase = getSupabaseAdmin();
    await supabase.from('system_events').insert({
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
