import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/admin';

function authError(error: unknown) {
  const code = error instanceof Error ? error.message : '';
  if (code === 'AUTHENTICATION_REQUIRED') return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  if (code === 'ADMIN_ACCESS_REQUIRED') return NextResponse.json({ error: 'ABE Tech Lab admin access required.' }, { status: 403 });
  return null;
}

function isMissingSchema(result: { error?: { code?: string } | null }) {
  return result.error?.code === 'PGRST205' || result.error?.code === '42P01';
}

export async function GET() {
  try {
    await requireAdmin();
    const supabase = getSupabaseAdmin();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [events, activeIncidents, reports, outboundFailures, inbound, outbound, deliveryEvents] = await Promise.all([
      supabase.from('system_events').select('id,event_type,severity,component,action,message,request_id,trace_id,deployment_id,provider,provider_event_id,mailbox,route,http_status,duration_ms,metadata,created_at').gte('created_at', since).order('created_at', { ascending: false }).limit(100),
      supabase.from('incidents').select('id,incident_key,title,severity,status,component,last_seen_at').not('status', 'in', '(resolved,closed)').order('last_seen_at', { ascending: false }).limit(20),
      supabase.from('user_issue_reports').select('id,report_key,mailbox,action,status,description,created_at,incident_id').not('status', 'in', '(resolved,closed)').order('created_at', { ascending: false }).limit(20),
      supabase.from('email_messages').select('id', { count: 'exact', head: true }).eq('direction', 'outbound').neq('status', 'sent').gte('created_at', since),
      supabase.from('email_messages').select('id', { count: 'exact', head: true }).eq('direction', 'inbound').gte('created_at', since),
      supabase.from('email_messages').select('id', { count: 'exact', head: true }).eq('direction', 'outbound').gte('created_at', since),
      supabase.from('resend_email_events').select('event_type', { count: 'exact', head: true }).gte('received_at', since),
    ]);

    const resultSets = [events, activeIncidents, reports, outboundFailures, inbound, outbound];
    const missingSchema = resultSets.find((result) => isMissingSchema(result));
    const realError = resultSets.find((result) => result.error && !isMissingSchema(result));
    if (realError?.error) throw realError.error;
    if (deliveryEvents.error && !isMissingSchema(deliveryEvents)) throw deliveryEvents.error;

    const deliveryCounts = {} as Record<string, number>;
    if (!isMissingSchema(deliveryEvents)) {
      const rows = (await supabase.from('resend_email_events').select('event_type').gte('received_at', since).limit(5000)).data ?? [];
      for (const row of rows) deliveryCounts[row.event_type] = (deliveryCounts[row.event_type] ?? 0) + 1;
    }

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      monitoringStore: missingSchema ? 'not_initialized' : 'connected',
      deliveryStore: isMissingSchema(deliveryEvents) ? 'not_initialized' : 'connected',
      window: '24h',
      metrics: {
        eventCount: events.count ?? events.data?.length ?? 0,
        openIncidents: activeIncidents.data?.length ?? 0,
        openReports: reports.data?.length ?? 0,
        outboundFailures24h: outboundFailures.count ?? 0,
        inbound24h: inbound.count ?? 0,
        outbound24h: outbound.count ?? 0,
        deliveryEvents24h: deliveryEvents.count ?? Object.values(deliveryCounts).reduce((sum, count) => sum + count, 0),
        delivered24h: deliveryCounts['email.delivered'] ?? 0,
        delayed24h: deliveryCounts['email.delivery_delayed'] ?? 0,
        bounced24h: deliveryCounts['email.bounced'] ?? 0,
        complained24h: deliveryCounts['email.complained'] ?? 0,
        suppressed24h: deliveryCounts['email.suppressed'] ?? 0,
        failed24h: deliveryCounts['email.failed'] ?? 0,
      },
      events: events.data ?? [],
      incidents: activeIncidents.data ?? [],
      reports: reports.data ?? [],
    });
  } catch (error) {
    const response = authError(error);
    if (response) return response;
    console.error('admin monitoring error', error);
    return NextResponse.json({ error: 'Unable to load monitoring data.' }, { status: 500 });
  }
}
