'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CalendarClock, Check, Loader2, RefreshCw, Send, Trash2, X } from 'lucide-react';

type ScheduledMessage = {
  id: string;
  from_address: string;
  to_addresses: string[];
  cc_addresses: string[];
  bcc_addresses: string[];
  subject: string;
  text_body: string;
  html_body: string;
  attachments: Array<{ filename: string; content_type: string; size: number; storage_path: string }>;
  scheduled_at: string;
  status: 'pending' | 'processing' | 'sent' | 'cancelled' | 'failed';
  provider_message_id: string | null;
  attempts: number;
  last_error: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
};

type FormState = { to: string; subject: string; body: string; scheduledAt: string };

function localInputValue(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function displayDate(value: string) {
  return new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function initialForm(): FormState {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  return { to: '', subject: '', body: '', scheduledAt: localInputValue(date) };
}

export default function ScheduledPage() {
  const [scheduled, setScheduled] = useState<ScheduledMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [status, setStatus] = useState('');
  const [form, setForm] = useState<FormState>(initialForm);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch('/api/scheduled', { cache: 'no-store' });
      const data = await response.json();
      if (response.status === 401) { window.location.href = '/login'; return; }
      if (!response.ok) throw new Error(data.error ?? 'Unable to load scheduled messages.');
      setScheduled(data.scheduled ?? []);
    } catch (error) {
      console.error(error);
      setStatus('Unable to load scheduled messages.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const active = useMemo(() => scheduled.filter((message) => ['pending', 'processing', 'failed'].includes(message.status)), [scheduled]);
  const completed = useMemo(() => scheduled.filter((message) => ['sent', 'cancelled'].includes(message.status)), [scheduled]);

  function resetForm() {
    setEditingId('');
    setForm(initialForm());
  }

  function editMessage(message: ScheduledMessage) {
    setEditingId(message.id);
    setForm({
      to: message.to_addresses.join(', '),
      subject: message.subject,
      body: message.text_body,
      scheduledAt: localInputValue(message.scheduled_at),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setStatus(editingId ? 'Updating…' : 'Scheduling…');
    try {
      const payload = {
        id: editingId || undefined,
        to_addresses: form.to.split(/[\n,;]+/).map((value) => value.trim()).filter(Boolean),
        subject: form.subject.trim(),
        text_body: form.body,
        html_body: form.body.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br />'),
        scheduled_at: new Date(form.scheduledAt).toISOString(),
      };
      const response = editingId
        ? await fetch('/api/scheduled', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch('/api/scheduled', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Unable to save scheduled message.');
      setStatus(editingId ? 'Schedule updated.' : 'Message scheduled.');
      resetForm();
      await load();
    } catch (error) {
      console.error(error);
      setStatus(error instanceof Error ? error.message : 'Unable to save scheduled message.');
    } finally {
      setBusy(false);
    }
  }

  async function cancelMessage(id: string) {
    if (busy) return;
    setBusy(true);
    setStatus('Cancelling…');
    try {
      const response = await fetch('/api/scheduled', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, action: 'cancel' }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Unable to cancel scheduled message.');
      setStatus('Message cancelled.');
      if (editingId === id) resetForm();
      await load();
    } catch (error) {
      console.error(error);
      setStatus(error instanceof Error ? error.message : 'Unable to cancel scheduled message.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteMessage(id: string) {
    if (busy || !window.confirm('Delete this scheduled message permanently?')) return;
    setBusy(true);
    setStatus('Deleting…');
    try {
      const response = await fetch(`/api/scheduled?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Unable to delete scheduled message.');
      setStatus('Scheduled message deleted.');
      await load();
    } catch (error) {
      console.error(error);
      setStatus(error instanceof Error ? error.message : 'Unable to delete scheduled message.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ minHeight: '100dvh', background: '#f4f5f7', padding: '24px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gap: 18 }}>
        <header style={{ background: '#fff', border: '1px solid #e4e6ea', borderRadius: 16, padding: 20 }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, textDecoration: 'none', color: '#666c75', fontSize: 12, marginBottom: 14 }}><ArrowLeft size={15} /> Mailbox</Link>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
            <div>
              <p className="eyebrow">ABEmail</p>
              <h1 style={{ margin: '5px 0 6px', fontSize: 28, letterSpacing: '-.03em' }}>Scheduled Messages</h1>
              <p style={{ margin: 0, color: '#737983', fontSize: 13 }}>Compose now and send automatically later.</p>
            </div>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: '#eef1f6', color: '#343942', display: 'grid', placeItems: 'center' }}><CalendarClock size={24} /></div>
          </div>
        </header>

        <section style={{ background: '#fff', border: '1px solid #e4e6ea', borderRadius: 16, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 16 }}>
            <div><p className="eyebrow">{editingId ? 'Edit schedule' : 'New schedule'}</p><h2 style={{ margin: '4px 0 0', fontSize: 18 }}>{editingId ? 'Update scheduled email' : 'Schedule an email'}</h2></div>
            {editingId && <button type="button" onClick={resetForm} style={{ border: '1px solid #dfe2e6', background: '#fff', borderRadius: 9, padding: '8px 10px', color: '#30343a', fontSize: 11, fontWeight: 700, display: 'inline-flex', gap: 6, alignItems: 'center' }}><X size={13} /> Cancel edit</button>}
          </div>
          <form onSubmit={submit} style={{ display: 'grid', gap: 10 }}>
            <label style={{ display: 'grid', gap: 5, fontSize: 11, color: '#666c75', fontWeight: 700 }}>To<input required value={form.to} onChange={(event) => setForm((current) => ({ ...current, to: event.target.value }))} placeholder="customer@example.com" style={{ padding: '11px 12px', border: '1px solid #dfe2e6', borderRadius: 10, outline: 0 }} /></label>
            <label style={{ display: 'grid', gap: 5, fontSize: 11, color: '#666c75', fontWeight: 700 }}>Subject<input required value={form.subject} onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))} placeholder="Subject" style={{ padding: '11px 12px', border: '1px solid #dfe2e6', borderRadius: 10, outline: 0 }} /></label>
            <label style={{ display: 'grid', gap: 5, fontSize: 11, color: '#666c75', fontWeight: 700 }}>Message<textarea required value={form.body} onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))} placeholder="Write your message…" style={{ minHeight: 170, resize: 'vertical', padding: '11px 12px', border: '1px solid #dfe2e6', borderRadius: 10, outline: 0, lineHeight: 1.6 }} /></label>
            <label style={{ display: 'grid', gap: 5, fontSize: 11, color: '#666c75', fontWeight: 700 }}>Send at<input required type="datetime-local" value={form.scheduledAt} onChange={(event) => setForm((current) => ({ ...current, scheduledAt: event.target.value }))} style={{ padding: '11px 12px', border: '1px solid #dfe2e6', borderRadius: 10, outline: 0 }} /></label>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingTop: 4 }}>
              <span style={{ fontSize: 11, color: status.includes('Unable') || status.includes('Invalid') ? '#a12d2d' : '#6f757e' }}>{status}</span>
              <button type="submit" disabled={busy} style={{ border: 0, borderRadius: 10, background: '#15171a', color: '#fff', padding: '10px 14px', display: 'inline-flex', gap: 8, alignItems: 'center', fontWeight: 750, cursor: busy ? 'wait' : 'pointer' }}>{busy ? <Loader2 size={15} /> : editingId ? <Check size={15} /> : <Send size={15} />}{editingId ? 'Update schedule' : 'Schedule send'}</button>
            </div>
          </form>
        </section>

        <section style={{ display: 'grid', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}><div><p className="eyebrow">Queue</p><h2 style={{ margin: '4px 0 0', fontSize: 18 }}>Upcoming</h2></div><button type="button" onClick={() => void load()} disabled={loading} style={{ border: '1px solid #dfe2e6', background: '#fff', borderRadius: 9, padding: '8px 10px', color: '#30343a', fontSize: 11, fontWeight: 700, display: 'inline-flex', gap: 6, alignItems: 'center' }}><RefreshCw size={13} /> Refresh</button></div>

          {loading ? <div style={{ background: '#fff', border: '1px solid #e4e6ea', borderRadius: 16, minHeight: 180, display: 'grid', placeItems: 'center', color: '#7d828b' }}><Loader2 size={22} /></div> : active.length === 0 ? <div style={{ background: '#fff', border: '1px solid #e4e6ea', borderRadius: 16, padding: 32, textAlign: 'center', color: '#7d828b', fontSize: 12 }}>No active scheduled messages.</div> : active.map((message) => <article key={message.id} style={{ background: '#fff', border: '1px solid #e4e6ea', borderRadius: 16, padding: 18, display: 'grid', gap: 10 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start' }}><div style={{ minWidth: 0 }}><strong style={{ display: 'block', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{message.subject}</strong><span style={{ display: 'block', marginTop: 4, fontSize: 11, color: '#858a92', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{message.to_addresses.join(', ')}</span></div><span style={{ borderRadius: 999, padding: '5px 8px', background: message.status === 'failed' ? '#fff0ef' : message.status === 'processing' ? '#eef1f6' : '#eef8f2', color: message.status === 'failed' ? '#aa3a32' : '#4f5966', fontSize: 10, textTransform: 'uppercase', fontWeight: 800 }}>{message.status}</span></div><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}><span style={{ fontSize: 11, color: '#737983' }}><CalendarClock size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />{displayDate(message.scheduled_at)}</span>{message.last_error && <span style={{ color: '#a12d2d', fontSize: 11 }}>{message.last_error}</span>}</div><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button type="button" onClick={() => editMessage(message)} disabled={busy || message.status === 'processing'} style={{ border: '1px solid #dfe2e6', background: '#fff', borderRadius: 9, padding: '8px 10px', color: '#30343a', fontSize: 11, fontWeight: 700 }}>Edit / Reschedule</button><button type="button" onClick={() => void cancelMessage(message.id)} disabled={busy || message.status === 'processing'} style={{ border: '1px solid #ead0ce', background: '#fff7f6', borderRadius: 9, padding: '8px 10px', color: '#9b4039', fontSize: 11, fontWeight: 700 }}>Cancel</button></div></article>)}

          {completed.length > 0 && <div style={{ marginTop: 8 }}><p className="eyebrow">History</p><h2 style={{ margin: '4px 0 10px', fontSize: 18 }}>Completed</h2><div style={{ background: '#fff', border: '1px solid #e4e6ea', borderRadius: 16, overflow: 'hidden' }}>{completed.map((message) => <article key={message.id} style={{ padding: '14px 18px', borderBottom: '1px solid #eceef1', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}><div style={{ minWidth: 0 }}><strong style={{ display: 'block', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{message.subject}</strong><span style={{ display: 'block', marginTop: 4, fontSize: 10, color: '#858a92' }}>{message.status} · {message.sent_at ? displayDate(message.sent_at) : displayDate(message.updated_at)}</span></div>{message.status === 'cancelled' && <button type="button" onClick={() => void deleteMessage(message.id)} disabled={busy} title="Delete record" style={{ border: 0, background: 'transparent', color: '#7b8088', cursor: 'pointer' }}><Trash2 size={15} /></button>}</article>)}</div></div>}
        </section>
      </div>
    </main>
  );
}
