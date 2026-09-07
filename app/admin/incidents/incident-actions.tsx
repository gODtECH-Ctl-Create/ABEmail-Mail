'use client';

import { useState } from 'react';
import styles from '../admin.module.css';

type Props = { id: string; status: string };

const statuses = [
  { value: 'investigating', label: 'Investigate' },
  { value: 'mitigated', label: 'Mark mitigated' },
  { value: 'resolved', label: 'Resolve' },
  { value: 'closed', label: 'Close' },
];

export default function IncidentActions({ id, status }: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function updateStatus(nextStatus: string) {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/admin/incidents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: nextStatus }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Unable to update incident.');
      setMessage(`Updated to ${nextStatus}.`);
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to update incident.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'grid', justifyItems: 'end', gap: 6, minWidth: 150 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {statuses
          .filter((item) => item.value !== status && !(status === 'closed'))
          .map((item) => (
            <button
              key={item.value}
              type="button"
              className={styles.secondaryButton}
              disabled={busy}
              onClick={() => updateStatus(item.value)}
            >
              {busy ? 'Saving…' : item.label}
            </button>
          ))}
      </div>
      {message ? <span className={styles.muted} role="status">{message}</span> : null}
    </div>
  );
}
