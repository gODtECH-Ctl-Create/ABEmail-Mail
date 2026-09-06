'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Inbox, Mail, Search, Star, Trash2 } from 'lucide-react';

type ViewKey = 'primary' | 'all' | 'my-sent' | 'all-sent' | 'starred' | 'trash';

type Message = {
  id: string;
  direction: 'inbound' | 'outbound';
  from_address: string;
  to_addresses: string[];
  subject: string;
  html_body: string | null;
  text_body: string | null;
  created_at: string;
  is_read: boolean;
  is_starred: boolean;
  is_trashed: boolean;
};

const labels: Record<ViewKey, string> = {
  primary: 'Primary',
  all: 'All Mail',
  'my-sent': 'My Sent',
  'all-sent': 'All Sent',
  starred: 'Starred',
  trash: 'Trash',
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function SearchPage() {
  const params = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search);
  const initialQuery = params.get('q') ?? '';
  const initialView = (params.get('view') as ViewKey) || 'primary';
  const initialMailbox = params.get('mailbox') ?? '';
  const focusId = params.get('focus') ?? '';

  const [query, setQuery] = useState(initialQuery);
  const [view] = useState<ViewKey>(initialView in labels ? initialView : 'primary');
  const [mailbox] = useState(initialMailbox);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selected, setSelected] = useState<Message | null>(null);
  const [loading, setLoading] = useState(Boolean(initialQuery));
  const [error, setError] = useState('');

  useEffect(() => {
    if (!initialQuery) return;
    let mounted = true;
    async function run() {
      setLoading(true);
      try {
        const searchParams = new URLSearchParams({ q: initialQuery, view });
        if (mailbox) searchParams.set('mailbox', mailbox);
        const response = await fetch(`/api/search?${searchParams.toString()}`, { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? 'Unable to search mailbox.');
        if (!mounted) return;
        const next = (data.messages ?? []) as Message[];
        setMessages(next);
        if (focusId) setSelected(next.find((message) => message.id === focusId) ?? null);
      } catch (searchError) {
        console.error(searchError);
        if (mounted) setError('Unable to search this mailbox right now.');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void run();
    return () => { mounted = false; };
  }, [initialQuery, view, mailbox, focusId]);

  const visibleMessages = useMemo(() => messages, [messages]);

  return (
    <main className="app-shell" style={{ minHeight: '100dvh' }}>
      <aside className="sidebar" aria-label="Search navigation">
        <div className="sidebar-top">
          <div className="brand"><div className="brand-mark">AB</div><div><strong>ABEmail</strong><span>Business Mail</span></div></div>
        </div>
        <Link className="nav-item nav-subitem" href="/" style={{ textDecoration: 'none' }}><ArrowLeft size={16} /><span>Back to Mail</span></Link>
        <div style={{ marginTop: 14, padding: '0 10px', color: '#7b8088', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em' }}>Search scope</div>
        <div style={{ marginTop: 8, padding: '0 10px', color: '#20242a', fontSize: 14, fontWeight: 700 }}>{labels[view]}</div>
        {mailbox && <div style={{ marginTop: 4, padding: '0 10px', color: '#7b8088', fontSize: 12 }}>{mailbox}</div>}
      </aside>

      <section className="mail-panel">
        <header className="topbar">
          <div className="topbar-left"><div><p className="eyebrow">ABEmail</p><h1>Search</h1><span className="view-description">Search results for “{initialQuery}”</span></div></div>
          <form className="search" onSubmit={(event) => { event.preventDefault(); if (query.trim()) window.location.href = `/search?${new URLSearchParams({ q: query.trim(), view, ...(mailbox ? { mailbox } : {}) }).toString()}`; }}>
            <Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search mail" aria-label="Search mail" /><button type="submit" style={{ display: 'none' }} aria-hidden="true">Search</button>
          </form>
        </header>

        <div className="mail-content">
          <div className="message-list">
            <div className="list-toolbar"><span>{loading ? 'Searching…' : `${visibleMessages.length} ${visibleMessages.length === 1 ? 'result' : 'results'}`}</span></div>
            {error && <div className="empty-state"><div className="empty-icon"><Mail size={25} /></div><strong>{error}</strong><span>Return to Mail and try again.</span></div>}
            {!loading && !error && visibleMessages.map((message) => {
              const otherParty = message.direction === 'outbound' ? message.to_addresses[0] ?? 'Recipient' : message.from_address;
              return <button key={message.id} type="button" className={`message-row ${selected?.id === message.id ? 'selected' : ''} ${!message.is_read && message.direction === 'inbound' ? 'unread' : ''}`} onClick={() => setSelected(message)} style={{ width: '100%', border: 0, textAlign: 'left' }}>
                <div className="message-avatar">{otherParty.slice(0, 2).toUpperCase()}</div>
                <div className="message-main"><div className="message-head"><strong>{otherParty}</strong><span>{formatDate(message.created_at)}</span></div><div className="message-subject">{message.subject || '(no subject)'}</div><p>{message.text_body?.replace(/\s+/g, ' ').trim() || 'Open message to view its content.'}</p></div>
                {message.is_starred && <Star className="message-star" size={14} fill="currentColor" aria-label="Starred" />}
              </button>;
            })}
            {!loading && !error && visibleMessages.length === 0 && <div className="empty-state"><div className="empty-icon"><Search size={25} /></div><strong>No results</strong><span>Try a different sender, subject, recipient, or keyword.</span></div>}
          </div>

          <section className="message-detail" aria-label="Search result detail">
            <div className="detail-toolbar"><span />{selected && <div className="detail-actions"><span style={{ fontSize: 11, color: '#7b8088' }}>Search result</span></div>}</div>
            {selected ? <div className="detail-scroll"><div className="detail-heading"><h2>{selected.subject || '(no subject)'}</h2><div className="detail-meta-row"><div className="large-avatar">{selected.from_address.slice(0, 2).toUpperCase()}</div><div className="detail-meta"><strong>{selected.from_address}</strong><span>to {selected.to_addresses.join(', ') || 'this mailbox'}</span></div><time>{formatDate(selected.created_at)}</time></div></div><div className="message-content" dangerouslySetInnerHTML={{ __html: selected.html_body || `<p>${selected.text_body || ''}</p>` }} /></div> : <div className="detail-empty"><div className="empty-icon"><Search size={26} /><Inbox size={26} /></div><strong>Select a result</strong><span>Choose a message to read it here.</span></div>}
          </section>
        </div>
      </section>
    </main>
  );
}
