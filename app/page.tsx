'use client';

import { useEffect, useMemo, useState } from 'react';
import { Inbox, Mail, PenLine, Search, Send, Settings, Star, Trash2, LogOut } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

type Message = {
  id: string;
  direction: 'inbound' | 'outbound';
  from_address: string;
  to_addresses: string[];
  subject: string;
  html_body: string | null;
  text_body: string | null;
  created_at: string;
  status: string;
};

export default function Home() {
  const [folder, setFolder] = useState('Inbox');
  const [composerOpen, setComposerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [selected, setSelected] = useState<Message | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetch('/api/inbox').then(async (response) => {
      if (response.status === 401) { window.location.href = '/login'; return; }
      const data = await response.json();
      if (mounted) setMessages(data.messages ?? []);
    }).catch(console.error).finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, []);

  const filtered = useMemo(() => {
    const folderMessages = messages.filter((message) => {
      if (folder === 'Inbox') return message.direction === 'inbound';
      if (folder === 'Sent') return message.direction === 'outbound';
      return true;
    });
    return folderMessages.filter((message) => `${message.from_address} ${message.to_addresses.join(' ')} ${message.subject}`.toLowerCase().includes(query.toLowerCase()));
  }, [folder, messages, query]);

  async function logout() {
    await getSupabaseBrowser().auth.signOut();
    window.location.href = '/login';
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">AB</div><span>ABEmail</span></div>
        <button className="compose" onClick={() => setComposerOpen(true)}><PenLine size={17} /> Compose</button>
        <nav>
          {([['Inbox', Inbox], ['Sent', Send], ['Starred', Star], ['Trash', Trash2]] as const).map(([name, Icon]) => (
            <button key={name} className={folder === name ? 'nav-item active' : 'nav-item'} onClick={() => setFolder(name)}>
              <Icon size={17} /><span>{name}</span>{name === 'Inbox' && <b>{messages.filter((m) => m.direction === 'inbound').length || ''}</b>}
            </button>
          ))}
        </nav>
        <button className="nav-item settings"><Settings size={17} /><span>Settings</span></button>
        <button className="account-card" onClick={logout}><div className="avatar">AB</div><div><strong>ABEmail</strong><span>Sign out</span></div><LogOut size={15} /></button>
      </aside>

      <section className="mail-panel">
        <header className="topbar">
          <div><p className="eyebrow">ABEmail Mail</p><h1>{folder}</h1></div>
          <label className="search"><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search mail" /></label>
        </header>
        <div className="message-list">
          {loading && <div className="empty"><Mail size={32} /><strong>Loading mail…</strong></div>}
          {!loading && filtered.map((message) => (
            <article key={message.id} className="message" onClick={() => setSelected(message)}>
              <div className="message-avatar">{message.from_address.slice(0, 2).toUpperCase()}</div>
              <div className="message-main"><div className="message-head"><strong>{message.from_address}</strong><span>{new Date(message.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span></div><div className="message-subject">{message.subject}</div><p>{message.text_body || 'Open message to view content.'}</p></div>
            </article>
          ))}
          {!loading && !filtered.length && <div className="empty"><Mail size={32} /><strong>No mail here yet</strong><span>Messages received by Resend will appear here.</span></div>}
        </div>
      </section>

      {selected && <div className="overlay" onClick={() => setSelected(null)}><article className="composer message-view" onClick={(event) => event.stopPropagation()}><div className="composer-head"><div><strong>{selected.subject}</strong><div className="message-meta">From {selected.from_address}</div></div><button type="button" onClick={() => setSelected(null)}>×</button></div><div className="message-content" dangerouslySetInnerHTML={{ __html: selected.html_body || `<p>${selected.text_body || ''}</p>` }} /></article></div>}
      {composerOpen && <Compose onClose={() => setComposerOpen(false)} />}
    </main>
  );
}

function Compose({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function send(form: FormData) {
    setBusy(true); setStatus('');
    const payload = { to: form.get('to'), subject: form.get('subject'), html: String(form.get('body') || '').replace(/\n/g, '<br />') };
    const response = await fetch('/api/send', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) { setStatus(data.error ?? 'Unable to send message'); return; }
    setStatus('Message sent'); setTimeout(onClose, 700);
  }

  return <div className="overlay"><form className="composer" action={send}><div className="composer-head"><strong>New message</strong><button type="button" onClick={onClose}>×</button></div><input name="to" type="email" placeholder="To" required /><input name="subject" placeholder="Subject" required /><textarea name="body" placeholder="Write your message…" required /><div className="composer-foot"><span>{status}</span><button className="send-button" disabled={busy}>{busy ? 'Sending…' : 'Send'} <Send size={15} /></button></div></form></div>;
}
