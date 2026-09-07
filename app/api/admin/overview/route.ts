import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/admin';

function isMissingTable(error: { code?: string } | null) {
  return error?.code === 'PGRST205' || error?.code === '42P01';
}

export async function GET() {
  try {
    const admin = await requireAdmin();
    const supabase = getSupabaseAdmin();

    const [mailboxes, inbound, outbound, failed, subscriptions, billing] = await Promise.all([
      supabase.from('mailboxes').select('id,address,display_name,active').order('address'),
      supabase.from('email_messages').select('id', { count: 'exact', head: true }).eq('direction', 'inbound'),
      supabase.from('email_messages').select('id', { count: 'exact', head: true }).eq('direction', 'outbound'),
      supabase.from('email_messages').select('id', { count: 'exact', head: true }).eq('direction', 'outbound').neq('status', 'sent'),
      supabase.from('notification_preferences').select('user_id', { count: 'exact', head: true }).eq('browser_notifications', true),
      supabase.from('billing_subscriptions').select('plan_name,billing_cycle,status,currency,monthly_price,yearly_price,renews_at').limit(1).maybeSingle(),
    ]);

    for (const result of [mailboxes, inbound, outbound, failed, subscriptions, billing]) {
      if (result.error && !isMissingTable(result.error)) throw result.error;
    }

    const [incidentsResult, reportsResult, alertsResult] = await Promise.all([
      supabase.from('incidents').select('id,incident_key,title,severity,status,component,first_seen_at,last_seen_at').order('last_seen_at', { ascending: false }).limit(8),
      supabase.from('user_issue_reports').select('id,report_key,mailbox,action,status,description,created_at,incident_id').order('created_at', { ascending: false }).limit(8),
      supabase.from('admin_alerts').select('id,alert_key,incident_id,severity,title,message,status,created_at').order('created_at', { ascending: false }).limit(6),
    ]);

    const incidents = incidentsResult.error && isMissingTable(incidentsResult.error) ? [] : incidentsResult.data ?? [];
    const reports = reportsResult.error && isMissingTable(reportsResult.error) ? [] : reportsResult.data ?? [];
    const alerts = alertsResult.error && isMissingTable(alertsResult.error) ? [] : alertsResult.data ?? [];

    if (incidentsResult.error && !isMissingTable(incidentsResult.error)) throw incidentsResult.error;
    if (reportsResult.error && !isMissingTable(reportsResult.error)) throw reportsResult.error;
    if (alertsResult.error && !isMissingTable(alertsResult.error)) throw alertsResult.error;

    return NextResponse.json({
      adminEmail: admin.email,
      generatedAt: new Date().toISOString(),
      health: {
        app: 'operational',
        database: mailboxes.error && !isMissingTable(mailboxes.error) ? 'degraded' : 'connected',
        adminAccess: 'configured',
        monitoringStore: incidentsResult.error && isMissingTable(incidentsResult.error) ? 'not_initialized' : 'connected',
      },
      mailboxes: mailboxes.data ?? [],
      metrics: {
        inbound: inbound.count ?? 0,
        outbound: outbound.count ?? 0,
        nonSentOutbound: failed.count ?? 0,
        browserNotificationUsers: subscriptions.count ?? 0,
        newAlerts: alerts.filter((alert) => alert.status === 'new').length,
      },
      billing: billing.data ?? null,
      incidents,
      reports,
      alerts,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'AUTHENTICATION_REQUIRED') return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    if (code === 'ADMIN_ACCESS_REQUIRED') return NextResponse.json({ error: 'ABE Tech Lab admin access required.' }, { status: 403 });
    console.error('admin overview error', error);
    return NextResponse.json({ error: 'Unable to load admin overview.' }, { status: 500 });
  }
}
