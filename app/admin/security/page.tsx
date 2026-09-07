import Link from 'next/link';
import { AlertTriangle, ArrowLeft, CheckCircle2, LockKeyhole, ShieldAlert, UserX } from 'lucide-react';
import { requireAdmin } from '@/lib/admin';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import styles from '../admin.module.css';

const formatTime = (value: string) => {
  try { return new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
  catch { return value; }
};

function isMissingSchema(error: { code?: string } | null | undefined) {
  return error?.code === 'PGRST205' || error?.code === '42P01';
}

const securityComponents = ['auth', 'admin', 'resend.webhook', 'storage', 'dns.email', 'configuration'];

export default async function AdminSecurityPage() {
  const admin = await requireAdmin();
  const supabase = getSupabaseAdmin();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [events, incidents] = await Promise.all([
    supabase.from('system_events').select('id,event_type,severity,component,action,message,request_id,route,http_status,created_at').gte('created_at', since).in('severity', ['error', 'critical']).order('created_at', { ascending: false }).limit(100),
    supabase.from('incidents').select('id,incident_key,title,severity,status,component,first_seen_at,last_seen_at').not('status', 'in', '(resolved,closed)').order('last_seen_at', { ascending: false }).limit(50),
  ]);

  const hardError = [events, incidents].find((result) => result.error && !isMissingSchema(result.error));
  const securityEvents = (events.data ?? []).filter((event) => securityComponents.some((component) => (event.component ?? '').toLowerCase().includes(component)));
  const securityIncidents = (incidents.data ?? []).filter((incident) => securityComponents.some((component) => (incident.component ?? '').toLowerCase().includes(component)));
  const authFailures = securityEvents.filter((event) => (event.component ?? '').toLowerCase().includes('auth')).length;
  const webhookFailures = securityEvents.filter((event) => (event.component ?? '').toLowerCase().includes('webhook')).length;
  const accessFailures = securityEvents.filter((event) => (event.component ?? '').toLowerCase().includes('admin')).length;

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <Link href="/admin" className={styles.primaryButton}><ArrowLeft size={14} /> Overview</Link>
          <p className={styles.eyebrow} style={{ marginTop: 18 }}>ABE Tech Lab Operations</p>
          <h1>Security</h1>
          <p className={styles.muted}>Recent authentication, access, webhook and infrastructure security signals.</p>
        </div>
        <div className={styles.headerMeta}><span>{admin.email}</span><span>Window: last 24 hours</span></div>
      </header>

      <section className={styles.metricGrid}>
        <div className={styles.metricCard}><LockKeyhole size={18} /><span>Authentication failures</span><strong>{authFailures}</strong><small>Error / critical signals</small></div>
        <div className={styles.metricCard}><ShieldAlert size={18} /><span>Webhook security failures</span><strong>{webhookFailures}</strong><small>Signature / processing failures</small></div>
        <div className={styles.metricCard}><UserX size={18} /><span>Admin access failures</span><strong>{accessFailures}</strong><small>Unauthorized Admin attempts</small></div>
        <div className={styles.metricCard}><AlertTriangle size={18} /><span>Security incidents</span><strong>{securityIncidents.length}</strong><small>Open security-related incidents</small></div>
      </section>

      {hardError ? <section className={styles.panel}><div className={styles.empty}><ShieldAlert size={22} /><strong>Security data error</strong><span>{hardError.error?.message}</span></div></section> : null}

      <section className={styles.panel}>
        <div className={styles.panelHead}><div><p className={styles.eyebrow}>Open incidents</p><h2>Security-related incidents</h2></div><span className={styles.counter}>{securityIncidents.length}</span></div>
        {securityIncidents.length ? securityIncidents.map((incident) => <div className={styles.listRow} key={incident.id}><div><strong>{incident.title}</strong><span>{incident.incident_key} · {incident.component ?? 'security'} · Last seen {formatTime(incident.last_seen_at)}</span></div><b className={incident.severity === 'P1' ? styles.danger : styles.badge}>{incident.severity}</b></div>) : <div className={styles.empty}><CheckCircle2 size={22} /><strong>No open security incidents</strong><span>No active security-related incidents are recorded.</span></div>}
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHead}><div><p className={styles.eyebrow}>Signals</p><h2>Recent security events</h2></div><span className={styles.counter}>{securityEvents.length}</span></div>
        {securityEvents.length ? securityEvents.map((event) => <div className={styles.listRow} key={event.id}><div><strong>{event.message || event.event_type}</strong><span>{event.component ?? 'security'} · {event.action ?? 'event'} · {event.http_status ?? 'n/a'} · {formatTime(event.created_at)}</span></div><b className={event.severity === 'critical' ? styles.danger : styles.badge}>{event.severity}</b></div>) : <div className={styles.empty}><CheckCircle2 size={22} /><strong>No security events in the last 24 hours</strong><span>The security signal stream is currently quiet.</span></div>}
      </section>

      <footer className={styles.footer}>Security events exclude passwords, access tokens and message bodies. This view covers application signals; provider-level security controls remain monitored through the infrastructure layer.</footer>
    </main>
  );
}
