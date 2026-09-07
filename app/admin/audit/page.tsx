import Link from 'next/link';
import { ArrowLeft, ClipboardList } from 'lucide-react';
import { requireAdmin } from '@/lib/admin';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import styles from '../admin.module.css';

const formatTime = (value: string) => {
  try {
    return new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  } catch {
    return value;
  }
};

export default async function AdminAuditPage() {
  const admin = await requireAdmin();
  const supabase = getSupabaseAdmin();
  const { data: entries, error } = await supabase
    .from('admin_audit_log')
    .select('id,admin_user_id,action,target_type,target_id,summary,metadata,created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <Link href="/admin" className={styles.primaryButton}><ArrowLeft size={14} /> Overview</Link>
          <p className={styles.eyebrow} style={{ marginTop: 18 }}>ABE Tech Lab Operations</p>
          <h1>Audit log</h1>
          <p className={styles.muted}>Administrative actions recorded across the Waste2Light deployment.</p>
        </div>
        <div className={styles.headerMeta}>
          <span>{admin.email}</span>
          <span>Read-only history</span>
        </div>
      </header>

      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <div><p className={styles.eyebrow}>Activity trail</p><h2>Latest Admin actions</h2></div>
          <span className={styles.counter}>{entries?.length ?? 0} loaded</span>
        </div>
        {error ? (
          <div className={styles.empty}><ClipboardList size={22} /><strong>Audit log unavailable</strong><span>{error.message}</span></div>
        ) : entries && entries.length > 0 ? (
          entries.map((entry) => (
            <div className={styles.listRow} key={entry.id}>
              <div style={{ flex: 1 }}>
                <strong>{entry.summary || entry.action}</strong>
                <span>{formatTime(entry.created_at)} · {entry.target_type ?? 'system'}{entry.target_id ? ` · ${entry.target_id}` : ''}</span>
              </div>
              <b className={styles.badge}>{entry.action}</b>
            </div>
          ))
        ) : (
          <div className={styles.empty}><ClipboardList size={22} /><strong>No audit activity yet</strong><span>Admin actions will appear here as the operations console is used.</span></div>
        )}
      </section>

      <footer className={styles.footer}>Signed in as {admin.email}. Audit history is read-only from this screen.</footer>
    </main>
  );
}
