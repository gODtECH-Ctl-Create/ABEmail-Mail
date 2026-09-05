'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Inbox,
  LogOut,
  Mail,
  Menu,
  MoreHorizontal,
  PenLine,
  Reply,
  Search,
  Send,
  Settings,
  Star,
  Trash2,
  X,
  Forward,
} from 'lucide-react';
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

type ComposeSeed = {
  to?: string;
  subject?: string;
  body?: string;
};

const folders = [
  { name: 'Inbox', icon: Inbox },
  { name: 'Sent', icon: Send },
  { name: 'Starred', icon: Star, inactive: true },
  { name: 'Trash', icon: Trash2, inactive: true },
];

export default function Home() {
  const [folder, setFolder] = useState('Inbox');
  const [composerOpen, setComposerOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [selected, setSelected] = useState<Message | null>(null);
  const [composeSeed, setComposeSeed] = useState<ComposeSeed>({});
  const [loading, setLoading] = useState(true);
  const [currentUserEmail, setCurrentUserEmail] = useState('');

  useEffect(() => {
    let mounted = true;

    async function load() {
      const supabase = getSupabaseBrowser();
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user?.email) {
        window.location.href = '/login';
        return;
      }
      if (mounted) setCurrentUserEmail(userData.user.email);

      const response = await fetch('/api/inbox');
      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }
      const data = await response.json();
      if (mounted) setMessages(data.messages ?? []);
      if (mounted) setLoading(false);
    }

    load().catch((error) => {
      console.error(error);
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const folderMessages = messages.filter((message) => {
      if (folder === 'Inbox') return message.direction === 'inbound';
      if (folder === 'Sent') return message.direction === 'outbound';
      return false;
    });

    const normalized = query.trim().toLowerCase();
    if (!normalized) return folderMessages;

    return folderMessages.filter((message) =>
      `${message.from_address} ${message.to_addresses.join(' ')} ${message.subject} ${message.text_body ?? ''}`
        .toLowerCase()
        .includes(normalized),
    );
  }, [folder, messages, query]);

  const inboxCount = messages.filter((message) => message.direction === 'inbound').length;

  function openMessage(message: Message) {
    setSelected(message);
    setMobileNavOpen(false);
  }

  function chooseFolder(name: string) {
    if (name === 'Starred' || name === 'Trash') return;
    setFolder(name);
    setSelected(null);
    setMobileNavOpen(false);
  }

  function openCompose(seed: ComposeSeed = {}) {
    setComposeSeed(seed);
    setComposerOpen(true);
  }

  async function logout() {
    await getSupabaseBrowser().auth.signOut();
    window.location.href = '/login';
  }

  return (
    <main className={`app-shell ${mobileNavOpen ? 'nav-open' : ''} ${selected ? 'detail-open' : ''}`}>
      <div className="mobile-backdrop" onClick={() => setMobileNavOpen(false)} aria-hidden="true" />

      <aside className="sidebar" aria-label="Mailbox navigation">
        <div className="sidebar-top">
          <div className="brand">
            <div className="brand-mark">AB</div>
            <div>
              <strong>ABEmail</strong>
              <span>Business Mail</span>
            </div>
          </div>
          <button className="icon-button mobile-close" type="button" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation">
            <X size={18} />
          </button>
        </div>

        <button className="compose primary-action" type="button" onClick={() => openCompose()}>
          <PenLine size={17} />
          <span>Compose</span>
        </button>

        <nav className="folder-nav">
          {folders.map(({ name, icon: Icon, inactive }) => (
            <button
              key={name}
              type="button"
              className={`nav-item ${folder === name ? 'active' : ''} ${inactive ? 'disabled' : ''}`}
              onClick={() => chooseFolder(name)}
              disabled={inactive}
              title={inactive ? `${name} is not available yet` : undefined}
            >
              <Icon size={17} />
              <span>{name}</span>
              {name === 'Inbox' && <b>{inboxCount || ''}</b>}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <button className="nav-item" type="button">
            <Settings size={17} />
            <span>Settings</span>
          </button>
          <button className="account-card" type="button" onClick={logout} title="Sign out">
            <div className="avatar">{initials(currentUserEmail || 'AB')}</div>
            <div className="account-copy">
              <strong>{currentUserEmail || 'ABEmail'}</strong>
              <span>Sign out</span>
            </div>
            <LogOut size={15} />
          </button>
        </div>
      </aside>

      <section className="mail-panel">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-menu" type="button" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation">
              <Menu size={20} />
            </button>
            <div>
              <p className="eyebrow">ABEmail</p>
              <h1>{folder}</h1>
            </div>
          </div>

          <label className="search">
            <Search size={17} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search mail" aria-label="Search mail" />
            <span className="search-shortcut">⌘ K</span>
          </label>
        </header>

        <div className="mail-content">
          <div className={`message-list ${selected ? 'hide-on-mobile' : ''}`}>
            <div className="list-toolbar">
              <span>{loading ? 'Loading' : `${filtered.length} ${filtered.length === 1 ? 'message' : 'messages'}`}</span>
              <button className="icon-button" type="button" aria-label="More inbox actions">
                <MoreHorizontal size={18} />
              </button>
            </div>

            {loading && (
              <div className="empty-state loading-state">
                <div className="loading-line" />
                <div className="loading-line" />
                <div className="loading-line short" />
              </div>
            )}

            {!loading && filtered.map((message) => {
              const otherParty = message.direction === 'outbound' ? message.to_addresses[0] ?? 'Recipient' : message.from_address;
              const preview = message.text_body?.replace(/\s+/g, ' ').trim() || 'Open message to view the content.';
              return (
                <article
                  key={message.id}
                  className={`message-row ${selected?.id === message.id ? 'selected' : ''}`}
                  onClick={() => openMessage(message)}
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') openMessage(message);
                  }}
                  role="button"
                  aria-label={`Open email from ${otherParty}`}
                >
                  <div className="message-avatar">{initials(otherParty)}</div>
                  <div className="message-main">
                    <div className="message-head">
                      <strong>{otherParty}</strong>
                      <span>{formatDate(message.created_at)}</span>
                    </div>
                    <div className="message-subject">{message.subject || '(no subject)'}</div>
                    <p>{preview}</p>
                  </div>
                </article>
              );
            })}

            {!loading && !filtered.length && (
              <div className="empty-state">
                <div className="empty-icon"><Mail size={25} /></div>
                <strong>{query ? 'No messages match your search' : 'Your inbox is empty'}</strong>
                <span>{query ? 'Try a different sender, subject, or keyword.' : 'Messages received by Resend will appear here.'}</span>
                {!query && folder === 'Inbox' && <button type="button" className="ghost-action" onClick={() => openCompose()}>Compose a message</button>}
              </div>
            )}
          </div>

          {selected && (
            <section className="message-detail" aria-label="Email message">
              <div className="detail-toolbar">
                <button className="icon-button mobile-back" type="button" onClick={() => setSelected(null)} aria-label="Back to message list">
                  <ArrowLeft size={19} />
                </button>
                <div className="detail-actions">
                  <button className="icon-button" type="button" aria-label="Star message"><Star size={17} /></button>
                  <button className="icon-button" type="button" aria-label="More message actions"><MoreHorizontal size={18} /></button>
                </div>
              </div>

              <div className="detail-scroll">
                <div className="detail-heading">
                  <h2>{selected.subject || '(no subject)'}</h2>
                  <div className="detail-meta-row">
                    <div className="large-avatar">{initials(selected.from_address)}</div>
                    <div className="detail-meta">
                      <strong>{selected.from_address}</strong>
                      <span>to {selected.to_addresses.join(', ') || 'this mailbox'}</span>
                    </div>
                    <time>{formatDate(selected.created_at, true)}</time>
                  </div>
                </div>

                <div className="message-content" dangerouslySetInnerHTML={{ __html: selected.html_body || `<p>${escapeHtml(selected.text_body || '')}</p>` }} />

                <div className="detail-reply-actions">
                  <button type="button" className="reply-button" onClick={() => openCompose({ to: selected.from_address, subject: replySubject(selected.subject), body: `\n\nOn ${formatDate(selected.created_at, true)}, ${selected.from_address} wrote:\n${selected.text_body || ''}` })}>
                    <Reply size={16} /> Reply
                  </button>
                  <button type="button" className="reply-button secondary" onClick={() => openCompose({ to: selected.to_addresses[0], subject: `Fwd: ${selected.subject}`, body: `\n\n---------- Forwarded message ----------\nFrom: ${selected.from_address}\nSubject: ${selected.subject}\n\n${selected.text_body || ''}` })}>
                    <Forward size={16} /> Forward
                  </button>
                </div>
              </div>
            </section>
          )}
        </div>
      </section>

      {composerOpen && (
        <Compose
          seed={composeSeed}
          onClose={() => {
            setComposerOpen(false);
            setComposeSeed({});
          }}
          onSent={() => {
            setComposerOpen(false);
            setComposeSeed({});
            window.location.reload();
          }}
        />
      )}
    </main>
  );
}

function Compose({ seed, onClose, onSent }: { seed: ComposeSeed; onClose: () => void; onSent: () => void }) {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setStatus('');

    try {
      const body = String(form.get('body') || '');
      const response = await fetch('/api/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          to: form.get('to'),
          subject: form.get('subject'),
          html: body.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br />'),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setStatus(data.error ?? 'Unable to send message.');
        setBusy(false);
        return;
      }
      setStatus('Message sent');
      window.setTimeout(onSent, 550);
    } catch (error) {
      console.error(error);
      setStatus('Unable to send message.');
      setBusy(false);
    }
  }

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Compose email">
      <form className="composer-window" onSubmit={submit}>
        <div className="composer-head">
          <div>
            <span className="eyebrow">ABEmail</span>
            <strong>New message</strong>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close composer"><X size={18} /></button>
        </div>
        <input name="to" type="email" placeholder="To" defaultValue={seed.to} required autoFocus />
        <input name="subject" placeholder="Subject" defaultValue={seed.subject} required />
        <textarea name="body" placeholder="Write your message…" defaultValue={seed.body} required />
        <div className="composer-foot">
          <span className={status === 'Message sent' ? 'success' : 'status-text'}>{status}</span>
          <button className="send-button" type="submit" disabled={busy}>
            {busy ? 'Sending…' : 'Send'} <Send size={15} />
          </button>
        </div>
      </form>
    </div>
  );
}

function initials(value: string) {
  const clean = value.includes('@') ? value.split('@')[0] : value;
  return clean
    .split(/[._\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'AB';
}

function formatDate(value: string, detailed = false) {
  return new Date(value).toLocaleString([], detailed ? { dateStyle: 'medium', timeStyle: 'short' } : { month: 'short', day: 'numeric' });
}

function replySubject(subject: string) {
  return subject.toLowerCase().startsWith('re:') ? subject : `Re: ${subject}`;
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
