'use client';

import Link from 'next/link';
import { ArrowLeft, RefreshCw, ShieldCheck, UserRound, UserRoundX } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import styles from '../admin.module.css';

type UserRecord = {
  id: string;
  email: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  emailConfirmedAt: string | null;
  bannedUntil: string | null;
  suspended: boolean;
  isAdmin: boolean;
  isCurrentAdmin: boolean;
};

const formatTime = (value: string | null) => {
  if (!value) return 'Never';
  try { return new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
  catch { return value; }
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/users', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Unable to load users.');
      setUsers(payload.users ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load users.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function updateUser(user: UserRecord) {
    const action = user.suspended ? 'restore' : 'suspend';
    const prompt = action === 'suspend'
      ? `Suspend ${user.email} for 24 hours?`
      : `Restore ${user.email} now?`;
    if (!window.confirm(prompt)) return;

    setBusyId(user.id);
    setError('');
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: user.id, action }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Unable to update user.');
      setUsers((current) => current.map((item) => item.id === user.id ? { ...item, bannedUntil: payload.user.bannedUntil, suspended: payload.user.suspended } : item));
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update user.');
    } finally {
      setBusyId(null);
    }
  }

  const filteredUsers = useMemo(() => users.filter((user) => (user.email ?? '').toLowerCase().includes(query.toLowerCase())), [users, query]);

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <Link href="/admin" className={styles.primaryButton}><ArrowLeft size={14} /> Overview</Link>
          <p className={styles.eyebrow} style={{ marginTop: 18 }}>ABE Tech Lab Operations</p>
          <h1>User access</h1>
          <p className={styles.muted}>Monitor Waste2Light accounts and temporarily suspend access when needed.</p>
        </div>
        <button className={styles.primaryButton} type="button" onClick={() => void load()} disabled={loading}><RefreshCw size={14} /> Refresh</button>
      </header>

      <section className={styles.healthRow}>
        <span className={styles.healthPill}><UserRound size={12} /> {users.length} users</span>
        <span className={styles.healthPill}><ShieldCheck size={12} /> Admins protected</span>
        <input aria-label="Search users" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search email…" style={{ border: '1px solid #e0e3e7', borderRadius: 999, background: '#fff', padding: '8px 12px', fontSize: 11, outline: 'none' }} />
      </section>

      {error ? <section className={styles.panel}><div style={{ padding: 14, color: '#aa3a32', fontSize: 12 }}>{error}</div></section> : null}

      <section className={styles.panel}>
        <div className={styles.panelHead}><div><p className={styles.eyebrow}>Accounts</p><h2>Waste2Light users</h2></div><span className={styles.counter}>{filteredUsers.length} shown</span></div>
        {loading ? <div className={styles.empty}><RefreshCw size={22} /><strong>Loading accounts</strong><span>Reading current authentication status.</span></div> : filteredUsers.length === 0 ? <div className={styles.empty}><UserRoundX size={22} /><strong>No users found</strong><span>Try a different email search.</span></div> : filteredUsers.map((user) => (
          <div className={styles.listRow} key={user.id}>
            <div>
              <strong>{user.email ?? 'Unknown email'} {user.isAdmin ? '· Admin' : ''}</strong>
              <span>Joined {formatTime(user.createdAt)} · Last sign-in {formatTime(user.lastSignInAt)}{user.suspended ? ` · Suspended until ${formatTime(user.bannedUntil)}` : ''}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <b className={user.suspended ? styles.disabled : styles.active}>{user.suspended ? 'Suspended' : 'Active'}</b>
              {user.isAdmin || user.isCurrentAdmin ? null : (
                <button
                  type="button"
                  onClick={() => void updateUser(user)}
                  disabled={busyId === user.id}
                  className={styles.badge}
                  style={{ border: 0, cursor: busyId === user.id ? 'wait' : 'pointer' }}
                >
                  {busyId === user.id ? 'Updating' : user.suspended ? 'Restore' : 'Suspend 24h'}
                </button>
              )}
            </div>
          </div>
        ))}
      </section>

      <footer className={styles.footer}>User suspension uses Supabase Auth ban controls. Admin accounts are protected from this operator action.</footer>
    </main>
  );
}
