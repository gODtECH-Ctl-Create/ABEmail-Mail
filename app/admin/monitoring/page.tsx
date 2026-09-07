import Link from 'next/link';
import { Activity, AlertTriangle, ArrowLeft, CheckCircle2, Clock3, Database, MailWarning, ShieldAlert } from 'lucide-react';
import { requireAdmin } from '@/lib/admin';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import styles from '../admin.module.css';

const tone = (severity: string) => severity === 'critical' ? styles.danger : severity === 'error' ? styles.danger : severity === 'warning' ? styles.badge : styles.active;

const formatTime = (value: string) => {
  try { return new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
  catch { return value; }
};

export default async function AdminMonitoringPage() {
  const admin = await requireAdmin();
  const supabase = getSupabaseAdmin();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [events, incidents, reports, inbound, outbound, failures] = await Promise.all([
    supabase.from('system_events').select('id,event_type,severity,component,action,message,request_id,route,http_status,created_at').gte('created_at', since).order('created_at', { ascending: false }).limit(30),
    supabase.from('incidents').select('id,incident_key,title,severity,status,component,last_seen_at').not('status', 'in', '(resolved,closed)').order('last_seen_at', { ascending: false }).limit(20),
    supabase.from('user_issue_reports').select('id,report_key,mailbox,action,status,description,created_at,incident_id').not('status', 'in', '(resolved,closed)').order('created_at', { ascending: false }).limit(20),
    supabase.from('email_messages').select('id', { count: 'exact', head: true }).eq('direction', 'inbound').gte('created_at', since),
    supabase.from('email_messages').select('id', { count: 'exact', head: true }).eq('direction', 'outbound').gte('created_at', since),
    supabase.from('email_messages').select('id', { count: 'exact', head: true }).eq('direction', 'outbound').neq('status', 'sent').gte('created_at', since),
  ]);

  const missing = [events, incidents, reports].some((r) => r.error?.code === 'PGRST205' || r.error?.code === '42P01');
  const hardError = [events, incidents, reports, inbound, outbound, failures].find((r) => r.error && r.error.code !== 'PGRST205' && r.error.code !== '42P01');

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <Link href="/admin" className={styles.primaryButton}><ArrowLeft size={14} /> Overview</Link>
          <p className={styles.eyebrow} style={{ marginTop: 18 }}>ABE Tech Lab Operations</p>
          <h1>Monitoring</h1>
          <p className={styles.muted}>24-hour application, email and incident signals.</p>
        </div>
        <div className={styles.headerMeta}><span>{admin.email}</span><span>Window: last 24 hours</span></div>
      </header>

      <section className={styles.healthRow}>
        <span className={`${styles.healthPill} ${missing ? styles.attention : styles.healthy}`}><span /> Monitoring store: {missing ? 'not initialized' : 'connected'}</span>
        <span className={styles.healthPill}><Clock3 size={12} /> {formatTime(new Date().toISOString())}</span>
      </section>

      <section className={styles.metricGrid}>
        <div className={styles.metricCard}><Activity size={18} /><span>Events</span><strong>{events.data?.length ?? 0}</strong><small>Last 24 hours</small></div>
        <div className={styles.metricCard}><AlertTriangle size={18} /><span>Open incidents</span><strong>{incidents.data?.length ?? 0}</strong><small>Detected / investigating / mitigated</small></div>
        <div className={styles.metricCard}><MailWarning size={18} /><span>Outbound failures</span><strong>{failures.count ?? 0}</strong><small>Recent non-sent records</small></div>
        <div className={styles.metricCard}><Database size={18} /><span>Mail flow</span><strong>{(inbound.count ?? 0) + (outbound.count ?? 0)}</strong><small>{inbound.count ?? 0} inbound · {outbound.count ?? 0} outbound</small></div>
      </section>

      {hardError ? <section className={styles.panel}><div className={styles.empty}><ShieldAlert size={22} /><strong>Monitoring data error</strong><span>{hardError.error?.message}</span></div></section> : null}

      <section className={styles.twoCol}>
        <div className={styles.panel}>
          <div className={styles.panelHead}><div><p className={styles.eyebrow}>Incidents</p><h2>Open incidents</h2></div><span className={styles.counter}>{incidents.data?.length ?? 0}</span></div>
          {incidents.data?.length ? incidents.data.map((incident) => <div className={styles.listRow} key={incident.id}><div><strong>{incident.title}</strong><span>{incident.incident_key} · {incident.component ?? 'system'} · Last seen {formatTime(incident.last_seen_at)}</span></div><b className={incident.severity === 'P1' ? styles.danger : styles.badge}>{incident.severity}</b></div>) : <div className={styles.empty}><CheckCircle2 size={22} /><strong>No open incidents</strong><span>No active incidents are currently stored.</span></div>}
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHead}><div><p className={styles.eyebrow}>User reports</p><h2>Outstanding reports</h2></div><span className={styles.counter}>{reports.data?.length ?? 0}</span></div>
          {reports.data?.length ? reports.data.map((report) => <div className={styles.listRow} key={report.id}><div><strong>{report.description || report.action || 'Reported problem'}</strong><span>{report.report_key} · {report.mailbox ?? 'unknown mailbox'} · {formatTime(report.created_at)}</span></div><b className={styles.badge}>{report.status}</b></div>) : <div className={styles.empty}><CheckCircle2 size={22} /><strong>No outstanding reports</strong><span>User reports will appear here when reporting is enabled.</span></div>}
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHead}><div><p className={styles.eyebrow}>Event stream</p><h2>Recent system events</h2></div><span className={styles.counter}>{events.data?.length ?? 0} loaded</span></div>
        {events.data?.length ? events.data.map((event) => <div className={styles.listRow} key={event.id}><div><strong>{event.message || event.event_type}</strong><span>{event.event_type} · {event.component ?? 'system'} · {event.action ?? 'event'} · {formatTime(event.created_at)}</span></div><b className={tone(event.severity)}>{event.severity}</b></div>) : <div className={styles.empty}><Activity size={22} /><strong>No events recorded yet</strong><span>Production events will populate this stream as monitoring hooks are connected.</span></div>}
      </section>

      <footer className={styles.footer}>Signed in as {admin.email}. Monitoring is provider-neutral for Vercel today and Cloudflare later.</footer>
    </main>
  );
}
