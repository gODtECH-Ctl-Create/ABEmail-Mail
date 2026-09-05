'use client';

import { useMemo, useState } from 'react';
import { Inbox, Mail, PenLine, Search, Send, Settings, Star, Trash2 } from 'lucide-react';

const demoMessages = [
  { id: '1', sender: 'Waste2Light Team', email: 'team@waste2light.com', subject: 'Welcome to ABEmail Mail', preview: 'Your company mailbox is ready to use.', time: '08:42', unread: true },
  { id: '2', sender: 'Operations', email: 'operations@example.com', subject: 'Weekly operations update', preview: 'Here are the items that need your attention this week.', time: 'Yesterday', unread: true },
  { id: '3', sender: 'Emmanuel', email: 'emmanuel@waste2light.com', subject: 'Project notes', preview: 'I have added the latest notes to the shared folder.', time: 'Fri', unread: false },
];

export default function Home() {
  const [folder, setFolder] = useState('Inbox');
  const [composerOpen, setComposerOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => demoMessages.filter((message) =>
    `${message.sender} ${message.email} ${message.subject} ${message.preview}`.toLowerCase().includes(query.toLowerCase())
  ), [query]);

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">AB</div><span>ABEmail</span></div>
        <button className="compose" onClick={() => setComposerOpen(true)}><PenLine size={17} /> Compose</button>
        <nav>
          {[['Inbox', Inbox], ['Sent', Send], ['Starred', Star], ['Trash', Trash2]].map(([name, Icon]) => (
            <button key={String(name)} className={folder === name ? 'nav-item active' : 'nav-item'} onClick={() => setFolder(String(name))}>
              <Icon size={17} /><span>{name}</span>{name === 'Inbox' && <b>2</b>}
            </button>
          ))}
        </nav>
        <button className="nav-item settings"><Settings size={17} /><span>Settings</span></button>
        <div className="account-card"><div className="avatar">AB</div><div><strong>Waste2Light</strong><span>info@waste2light.com</span></div></div>
      </aside>

      <section className="mail-panel">
        <header className="topbar">
          <div><p className="eyebrow">{folder}</p><h1>{folder}</h1></div>
          <label className="search"><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search mail" /></label>
        </header>
        <div className="message-list">
          {filtered.map((message) => (
            <article key={message.id} className={message.unread ? 'message unread' : 'message'}>
              <div className="message-avatar">{message.sender.slice(0, 2).toUpperCase()}</div>
              <div className="message-main"><div className="message-head"><strong>{message.sender}</strong><span>{message.time}</span></div><div className="message-subject">{message.subject}</div><p>{message.preview}</p></div>
            </article>
          ))}
          {!filtered.length && <div className="empty"><Mail size={32} /><strong>No matching mail</strong><span>Try a different search term.</span></div>}
        </div>
      </section>

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
