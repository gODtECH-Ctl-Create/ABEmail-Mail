'use client';

import Link from 'next/link';
import { ArrowLeft, Mail, Power, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import styles from '../admin.module.css';

type Mailbox = {
  id: string;
  address: string;
  display_name: string | null;
  active: boolean;
  created_at: string;
};

export default function AdminMailboxesPage() {
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/mailboxes', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Unable to load mailboxes.');
      setMailboxes(payload.mailboxes ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load mailboxes.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function toggleMailbox(mailbox: Mailbox) {
    setBusyId(mailbox.id);
    setError('');
    try {
      const response = await fetch('/api/admin/mailboxes', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: mailbox.id, active: !mailbox.active }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Unable to update mailbox.');
      setMailboxes((current) => current.map((item) => item.id === mailbox.id ? payload.mailbox : item));
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : 'Unable to update mailbox.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <Link href="/admin" className={styles.primaryButton}><ArrowLeft size={14} /> Overview</Link>
          <p className={styles.eyebrow} style={{ marginTop: 18 }}>ABE Tech Lab Operations</p>
          <h1>Mailbox operations</h1>
          <p className={styles.muted}>Control whether Waste2Light mailboxes are available inside ABEmail.</p>
        </div>
        <button className={styles.primaryButton} type="button" onClick={() => void load()} disabled={loading}><RefreshCw size={14} /> Refresh</button>
      </header>

      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <div><p className={styles.eyebrow}>Mailboxes</p><h2>Application access</h2></div>
          <span className={styles.counter}>{mailboxes.filter((mailbox) => mailbox.active).length} active</span>
        </div>

        <div style={{ padding: 18, borderBottom: '1px solid #eceef1', color: '#757b84', fontSize: 11, lineHeight: 1.6 }}>
          Turning a mailbox off here disables its application access and visibility. It does not delete the address or change Resend routing.
        </div>

        {error ? <div style={{ padding: 16, color: '#aa3a32', fontSize: 12, borderBottom: '1px solid #eceef1' }}>{error}</div> : null}

        {loading ? (
          <div className={styles.empty}><RefreshCw size={22} /><strong>Loading mailboxes</strong><span>Checking the current application access state.</span></div>
        ) : mailboxes.length === 0 ? (
          <div className={styles.empty}><Mail size={22} /><strong>No mailboxes found</strong><span>The configured Waste2Light mailbox records are not available yet.</span></div>
        ) : mailboxes.map((mailbox) => (
          <div className={styles.listRow} key={mailbox.id}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className={styles.mailboxIcon}><Mail size={16} /></div>
              <div>
                <strong>{mailbox.display_name || mailbox.address}</strong>
                <span>{mailbox.address}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void toggleMailbox(mailbox)}
              disabled={busyId === mailbox.id}
              className={mailbox.active ? styles.active : styles.disabled}
              style={{ border: 0, cursor: busyId === mailbox.id ? 'wait' : 'pointer' }}
              aria-label={`${mailbox.active ? 'Disable' : 'Enable'} ${mailbox.address}`}
            >
              <Power size={12} style={{ marginRight: 5, verticalAlign: -2 }} />
              {busyId === mailbox.id ? 'Updating' : mailbox.active ? 'Enabled' : 'Disabled'}
            </button>
          </div>
        ))}
      </section>

      <footer className={styles.footer}>Mailbox controls are operator actions for the Waste2Light deployment. Resend/domain configuration remains separate.</footer>
    </main>
  );
}
