import Link from 'next/link';
import { ArrowLeft, FileStack, Mail, Smartphone, TrendingUp, Users } from 'lucide-react';
import { requireAdmin } from '@/lib/admin';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import styles from '../admin.module.css';

function isMissingSchema(error: { code?: string } | null | undefined) {
  return error?.code === 'PGRST205' || error?.code === '42P01';
}

export default async function AdminCapacityPage() {
  const admin = await requireAdmin();
  const supabase = getSupabaseAdmin();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [messagesDay, messagesMonth, drafts, notificationUsers, attachmentsMonth, deliveryEventsMonth] = await Promise.all([
    supabase.from('email_messages').select('id', { count: 'exact', head: true }).gte('created_at', dayAgo),
    supabase.from('email_messages').select('id', { count: 'exact', head: true }).gte('created_at', monthAgo),
    supabase.from('email_drafts').select('id', { count: 'exact', head: true }),
    supabase.from('notification_preferences').select('user_id', { count: 'exact', head: true }).eq('browser_notifications', true),
    supabase.from('email_messages').select('attachments').gte('created_at', monthAgo).limit(5000),
    supabase.from('resend_email_events').select('id', { count: 'exact', head: true }).gte('received_at', monthAgo),
  ]);

  const results = [messagesDay, messagesMonth, drafts, notificationUsers, attachmentsMonth, deliveryEventsMonth];
  const hardError = results.find((result) => result.error && !isMissingSchema(result.error));
  const attachmentItems = (attachmentsMonth.data ?? []).reduce((count, row) => count + (Array.isArray(row.attachments) ? row.attachments.length : 0), 0);

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <Link href="/admin" className={styles.primaryButton}><ArrowLeft size={14} /> Overview</Link>
          <p className={styles.eyebrow} style={{ marginTop: 18 }}>ABE Tech Lab Operations</p>
          <h1>Capacity & Usage</h1>
          <p className={styles.muted}>Application-level volume and resource signals for Waste2Light.</p>
        </div>
        <div className={styles.headerMeta}><span>{admin.email}</span><span>24h / 30d windows</span></div>
      </header>

      <section className={styles.metricGrid}>
        <div className={styles.metricCard}><Mail size={18} /><span>Messages · 24h</span><strong>{messagesDay.count ?? 0}</strong><small>Inbound + outbound records</small></div>
        <div className={styles.metricCard}><TrendingUp size={18} /><span>Messages · 30d</span><strong>{messagesMonth.count ?? 0}</strong><small>Inbound + outbound records</small></div>
        <div className={styles.metricCard}><FileStack size={18} /><span>Attachments · 30d</span><strong>{attachmentItems}</strong><small>Attachment entries recorded on messages</small></div>
        <div className={styles.metricCard}><Users size={18} /><span>Drafts</span><strong>{drafts.count ?? 0}</strong><small>Current saved drafts</small></div>
      </section>

      <section className={styles.metricGrid}>
        <div className={styles.metricCard}><Smartphone size={18} /><span>Push-enabled users</span><strong>{notificationUsers.count ?? 0}</strong><small>Users opted into browser notifications</small></div>
        <div className={styles.metricCard}><Mail size={18} /><span>Delivery events · 30d</span><strong>{deliveryEventsMonth.count ?? 0}</strong><small>Resend provider events recorded</small></div>
      </section>

      {hardError ? <section className={styles.panel}><div className={styles.empty}><strong>Capacity data error</strong><span>{hardError.error?.message}</span></div></section> : null}

      <section className={styles.panel}>
        <div className={styles.panelHead}><div><p className={styles.eyebrow}>Interpretation</p><h2>What these numbers mean</h2></div></div>
        <div className={styles.listRow}><div><strong>Application usage</strong><span>These counts describe actual Waste2Light usage, not provider billing quotas.</span></div></div>
        <div className={styles.listRow}><div><strong>Provider limits</strong><span>Resend, Supabase, Vercel and future Cloudflare quota monitoring will be added from their service-level usage APIs where available.</span></div></div>
        <div className={styles.listRow}><div><strong>Growth signal</strong><span>30-day volume and attachment counts provide an early warning before storage, email volume or operational complexity grows unexpectedly.</span></div></div>
      </section>

      <footer className={styles.footer}>Waste2Light deployment · Capacity data is intentionally provider-neutral and safe to carry into the future Cloudflare environment.</footer>
    </main>
  );
}
