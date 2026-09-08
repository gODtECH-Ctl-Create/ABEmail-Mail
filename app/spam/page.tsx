'use client';

import Link from 'next/link';
import { ArrowLeft, Inbox, Loader2, Mail, ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';

type Message = {
  id: string;
  direction: 'inbound' | 'outbound';
  from_address: string;
  to_addresses: string[];
  subject: string;
  text_body: string | null;
  created_at: string;
  is_read: boolean;
  is_starred: boolean;
  is_trashed: boolean;
  is_spam: boolean;
};

function initials(value: string) {
  const clean = value.includes('@') ? value.split('@')[0] : value;
  return clean.split(/[._\s-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'SP';
}

function formatDate(value: string) {
  return new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

export default function SpamPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/inbox?view=spam', { cache: 'no-store' });
      const data = await response.json();
      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!response.ok) throw new Error(data.error ?? 'Unable to load Spam.');
      setMessages(data.messages ?? []);
    } catch (loadError) {
      console.error(loadError);
      setError('Unable to load Spam right now.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function markNotSpam(id: string) {
    if (busyId) return;
    setBusyId(id);
    try {
      const response = await fetch('/api/messages', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, action: 'notspam' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Unable to restore message.');
      setMessages((current) => current.filter((message) => message.id !== id));
    } catch (actionError) {
      console.error(actionError);
      setError('Unable to mark that message as Not Spam.');
    } finally {
      setBusyId('');
    }
  }

  return (
    <main style={{ minHeight: '100dvh', background: '#f4f5f7', padding: '24px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gap: 18 }}>
        <header style={{ background: '#fff', border: '1px solid #e4e6ea', borderRadius: 16, padding: 20, display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
          <div>
            <Link href="/" style={{ display: 'inline-flex', gap: 7, alignItems: 'center', textDecoration: 'none', color: '#666c75', fontSize: 12, marginBottom: 14 }}><ArrowLeft size={15} /> Mailbox</Link>
            <p className="eyebrow">ABEmail</p>
            <h1 style={{ margin: '5px 0 6px', fontSize: 28, letterSpacing: '-.03em' }}>Spam</h1>
            <p style={{ margin: 0, color: '#737983', fontSize: 13 }}>Messages you have marked as unwanted.</p>
          </div>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: '#fff0ef', color: '#aa3a32', display: 'grid', placeItems: 'center' }}><ShieldAlert size={24} /></div>
        </header>

        {error && <div style={{ background: '#fff1f1', color: '#a12d2d', border: '1px solid #f0cccc', borderRadius: 12, padding: 12, fontSize: 12 }}>{error}</div>}

        <section style={{ background: '#fff', border: '1px solid #e4e6ea', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #eceef1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong style={{ fontSize: 13 }}>{loading ? 'Loading…' : `${messages.length} ${messages.length === 1 ? 'message' : 'messages'}`}</strong>
            <span style={{ fontSize: 11, color: '#8a9098' }}>Spam</span>
          </div>

          {loading ? (
            <div style={{ minHeight: 240, display: 'grid', placeItems: 'center', color: '#858a92' }}><Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} /></div>
          ) : messages.length === 0 ? (
            <div style={{ minHeight: 300, display: 'grid', placeItems: 'center', alignContent: 'center', gap: 8, padding: 24, textAlign: 'center', color: '#858a92' }}>
              <div style={{ width: 50, height: 50, borderRadius: 15, background: '#f8f9fa', border: '1px solid #e1e3e7', display: 'grid', placeItems: 'center' }}><Inbox size={25} /></div>
              <strong style={{ color: '#464b53', fontSize: 14 }}>No spam messages</strong>
              <span style={{ fontSize: 12 }}>Messages you mark as Spam will appear here.</span>
            </div>
          ) : (
            messages.map((message) => {
              const sender = message.from_address;
              const preview = message.text_body?.replace(/\s+/g, ' ').trim() || 'Open the message from the mailbox to view its content.';
              return (
                <article key={message.id} style={{ padding: '16px 18px', borderBottom: '1px solid #eceef1', display: 'grid', gridTemplateColumns: '40px minmax(0,1fr) auto', gap: 12, alignItems: 'start' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#eceff2', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 850 }}>{initials(sender)}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
                      <strong style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sender}</strong>
                      <span style={{ fontSize: 11, color: '#8b9098', whiteSpace: 'nowrap' }}>{formatDate(message.created_at)}</span>
                    </div>
                    <div style={{ marginTop: 5, fontWeight: 750, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{message.subject || '(no subject)'}</div>
                    <p style={{ margin: '5px 0 0', color: '#737983', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preview}</p>
                  </div>
                  <button type="button" onClick={() => markNotSpam(message.id)} disabled={busyId === message.id} style={{ border: '1px solid #dfe2e6', background: '#fff', borderRadius: 9, padding: '8px 10px', color: '#30343a', fontSize: 11, fontWeight: 700, cursor: busyId ? 'wait' : 'pointer', display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                    {busyId === message.id ? <Loader2 size={13} /> : <Mail size={13} />} Not Spam
                  </button>
                </article>
              );
            })
          )}
        </section>
      </div>
      <style jsx>{`@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:640px){main{padding:16px!important}.spam-row{grid-template-columns:36px minmax(0,1fr)!important}.spam-row button{grid-column:2;justify-self:start}}`}</style>
    </main>
  );
}
