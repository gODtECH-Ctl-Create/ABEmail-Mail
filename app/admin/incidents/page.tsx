import Link from 'next/link';
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock3, ShieldAlert } from 'lucide-react';
import { requireAdmin } from '@/lib/admin';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import IncidentActions from './incident-actions';
import styles from '../admin.module.css';

const statusLabel: Record<string, string> = {
  detected: 'Detected',
  investigating: 'Investigating',
  mitigated: 'Mitigated',
  resolved: 'Resolved',
  closed: 'Closed',
};

const formatTime = (value: string) => {
  try {
    return new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  } catch {
    return value;
  }
};

export default async function AdminIncidentsPage() {
  const admin = await requireAdmin();
  const supabase = getSupabaseAdmin();
  const { data: incidents, error } = await supabase
    .from('incidents')
    .select('id,incident_key,title,severity,status,component,summary,first_seen_at,last_seen_at')
    .order('last_seen_at', { ascending: false })
    .limit(100);

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href="/admin" className={styles.primaryButton}><ArrowLeft size={14} /> Overview</Link>
            <Link href="/admin/audit" className={styles.secondaryButton}>Audit log</Link>
          </div>
          <p className={styles.eyebrow} style={{ marginTop: 18 }}>ABE Tech Lab Operations</p>
          <h1>Incidents</h1>
          <p className={styles.muted}>Detected and manually tracked problems across the Waste2Light deployment.</p>
        </div>
        <div className={styles.headerMeta}>
          <span>{admin.email}</span>
          <span>Operational incidents</span>
        </div>
      </header>

      <section className={styles.healthRow}>
        <span className={styles.healthPill}><span /> Detection store</span>
        <span className={styles.healthPill}><Clock3 size={12} /> Status lifecycle enabled</span>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <div><p className={styles.eyebrow}>Incident queue</p><h2>Latest incidents</h2></div>
          <span className={styles.counter}>{incidents?.length ?? 0} loaded</span>
        </div>
        {error ? (
          <div className={styles.empty}><ShieldAlert size={22} /><strong>Monitoring store unavailable</strong><span>{error.message}</span></div>
        ) : incidents && incidents.length > 0 ? (
          incidents.map((incident) => (
            <div className={styles.listRow} key={incident.id}>
              <div style={{ flex: 1 }}>
                <strong>{incident.title}</strong>
                <span>{incident.incident_key} · {incident.component ?? 'system'} · Last seen {formatTime(incident.last_seen_at)}</span>
                {incident.summary ? <span>{incident.summary}</span> : null}
              </div>
              <div style={{ display: 'grid', justifyItems: 'end', gap: 8 }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <b className={incident.severity === 'P1' ? styles.danger : styles.badge}>{incident.severity}</b>
                  <b className={incident.status === 'resolved' || incident.status === 'closed' ? styles.active : styles.badge}>{statusLabel[incident.status] ?? incident.status}</b>
                </div>
                <IncidentActions id={incident.id} status={incident.status} />
              </div>
            </div>
          ))
        ) : (
          <div className={styles.empty}><CheckCircle2 size={22} /><strong>No incidents recorded</strong><span>Automatic detection will populate this queue once monitoring signals are connected.</span></div>
        )}
      </section>

      <footer className={styles.footer}>Signed in as {admin.email}. Incident changes are audit logged.</footer>
    </main>
  );
}
