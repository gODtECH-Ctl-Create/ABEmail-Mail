'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ChevronDown,
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

type ViewKey = 'primary' | 'all' | 'my-sent' | 'all-sent';

type Mailbox = {
  id: string;
  address: string;
  display_name: string | null;
  active: boolean;
};

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

const viewMeta: Record<ViewKey, { title: string; eyebrow: string; description: string }> = {
  primary: {
    title: 'Primary',
    eyebrow: 'Inbox',
    description: 'Messages addressed to your mailbox.',
  },
  all: {
    title: 'All Mail',
    eyebrow: 'Inbox',
    description: 'Messages addressed to any company mailbox.',
  },
  'my-sent': {
    title: 'My Sent',
    eyebrow: 'Sent',
    description: 'Messages sent from your mailbox.',
  },
  'all-sent': {
    title: 'All Sent',
    eyebrow: 'Sent',
    description: 'Messages sent by any company mailbox.',
  },
};

export default function Home() {
  const [view, setView] = useState<ViewKey>('primary');
  const [mailboxFilter, setMailboxFilter] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [selected, setSelected] = useState<Message | null>(null);
  const [composeSeed, setComposeSeed] = useState<ComposeSeed>({});
  const [loading, setLoading] = useState(true);
  const [currentUserEmail, setCurrentUserEmail] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError('');

      try {
        const supabase = getSupabaseBrowser();
        const { data: userData } = await supabase.auth.getUser();
        const email = userData.user?.email?.toLowerCase();

        if (!email) {
          window.location.href = '/login';
          return;
        }

        const params = new URLSearchParams({ view });
        if (mailboxFilter && (view === 'all' || view === 'all-sent')) {
          params.set('mailbox', mailboxFilter);
        }

        const response = await fetch(`/api/inbox?${params.toString()}`, { cache: 'no-store' });
        const data = await response.json();

        if (response.status === 401) {
          window.location.href = '/login';
          return;
        }

        if (!response.ok) {
          throw new Error(data.error ?? 'Unable to load mailbox.');
        }

        if (!mounted) return;
        setCurrentUserEmail(email);
        setMessages(data.messages ?? []);
        setMailboxes(data.mailboxes ?? []);
      } catch (loadError) {
        console.error(loadError);
        if (mounted) setError('Unable to load this mailbox right now.');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    setSelected(null);

    return () => {
      mounted = false;
    };
  }, [view, mailboxFilter]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return messages;

    return messages.filter((message) =>
      `${message.from_address} ${message.to_addresses.join(' ')} ${message.subject} ${message.text_body ?? ''}`
        .toLowerCase()
        .includes(normalized),
    );
  }, [messages, query]);

  const primaryCount = messages.filter((message) => message.direction === 'inbound').length;
  const meta = viewMeta[view];
  const hasMailboxFilter = view === 'all' || view === 'all-sent';

  function chooseView(nextView: ViewKey) {
    setView(nextView);
    setMailboxFilter('');
    setSelected(null);
    setMobileNavOpen(false);
    setQuery('');
  }

  function chooseMailbox(address: string) {
    setMailboxFilter(address === mailboxFilter ? '' : address);
    setSelected(null);
  }

  function openMessage(message: Message) {
    setSelected(message);
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

  const mailboxLabel = (mailbox: Mailbox) => mailbox.display_name || mailbox.address.split('@')[0];
  const activeMailboxLabel = mailboxFilter
    ? mailboxLabel(mailboxes.find((mailbox) => mailbox.address.toLowerCase() === mailboxFilter) ?? {
        id: '',
        address: mailboxFilter,
        display_name: null,
        active: true,
      })
    : 'All mailboxes';

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

        <nav className="folder-nav" aria-label="Mail folders">
          <div className="nav-section-label">Inbox</div>
          <button
            type="button"
            className={`nav-item nav-subitem ${view === 'primary' ? 'active' : ''}`}
            onClick={() => chooseView('primary')}
          >
            <Inbox size={16} />
            <span>Primary</span>
            {view === 'primary' && <b>{primaryCount || ''}</b>}
          </button>
          <button
            type="button"
            className={`nav-item nav-subitem ${view === 'all' ? 'active' : ''}`}
            onClick={() => chooseView('all')}
          >
            <Mail size={16} />
            <span>All Mail</span>
          </button>

          <div className="nav-section-label">Sent</div>
          <button
            type="button"
            className={`nav-item nav-subitem ${view === 'my-sent' ? 'active' : ''}`}
            onClick={() => chooseView('my-sent')}
          >
            <Send size={16} />
            <span>My Sent</span>
          </button>
          <button
            type="button"
            className={`nav-item nav-subitem ${view === 'all-sent' ? 'active' : ''}`}
            onClick={() => chooseView('all-sent')}
          >
            <Send size={16} />
            <span>All Sent</span>
          </button>

          <div className="nav-section-label nav-section-label-muted">More</div>
          <button type="button" className="nav-item disabled" disabled>
            <Star size={16} />
            <span>Starred</span>
          </button>
          <button type="button" className="nav-item disabled" disabled>
            <Trash2 size={16} />
            <span>Trash</span>
          </button>
        </nav>

        <div className="sidebar-bottom">
          <button className="nav-item" type="button" onClick={() => { window.location.href = '/settings'; }}>
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
              <p className="eyebrow">{meta.eyebrow}</p>
              <h1>{meta.title}</h1>
              <span className="view-description">{meta.description}</span>
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
              <MoreHorizontal size={18} aria-hidden="true" />
            </div>

            {hasMailboxFilter && !loading && (
              <div className="mailbox-filter-bar" aria-label="Filter by mailbox">
                <span className="mailbox-filter-label">Mailbox</span>
                <div className="mailbox-filter-scroll">
                  <button type="button" className={`mailbox-chip ${!mailboxFilter ? 'active' : ''}`} onClick={() => setMailboxFilter('')}>
                    All
                  </button>
                  {mailboxes.map((mailbox) => (
                    <button
                      key={mailbox.id}
                      type="button"
                      className={`mailbox-chip ${mailbox.address.toLowerCase() === mailboxFilter ? 'active' : ''}`}
                      onClick={() => chooseMailbox(mailbox.address.toLowerCase())}
                      title={mailbox.address}
                    >
                      {mailboxLabel(mailbox)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {loading && (
              <div className="empty-state loading-state">
                <div className="loading-line" />
                <div className="loading-line" />
                <div className="loading-line short" />
              </div>
            )}

            {!loading && error && (
              <div className="empty-state">
                <div className="empty-icon"><Mail size={25} /></div>
                <strong>{error}</strong>
                <span>Refresh the page and try again.</span>
              </div>
            )}

            {!loading && !error && filtered.map((message) => {
              const otherParty = message.direction === 'outbound' ? message.to_addresses[0] ?? 'Recipient' : message.from_address;
              const recipientText = message.direction === 'inbound'
                ? `to ${message.to_addresses.length > 1 ? `${message.to_addresses.length} mailboxes` : message.to_addresses[0] ?? 'your mailbox'}`
                : `from ${message.from_address}`;
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
                    <small className="message-context">{recipientText}</small>
                  </div>
                </article>
              );
            })}

            {!loading && !error && !filtered.length && (
              <div className="empty-state">
                <div className="empty-icon"><Mail size={25} /></div>
                <strong>{query ? 'No messages match your search' : `${meta.title} is empty`}</strong>
                <span>
                  {query
                    ? 'Try a different sender, subject, or keyword.'
                    : view === 'primary'
                      ? `Messages sent to ${currentUserEmail} will appear here.`
                      : hasMailboxFilter
                        ? `No messages for ${activeMailboxLabel.toLowerCase()}.`
                        : 'Messages for your company mailboxes will appear here.'}
                </span>
                {!query && (view === 'primary' || view === 'my-sent') && (
                  <button type="button" className="ghost-action" onClick={() => openCompose()}>Compose a message</button>
                )}
              </div>
            )}
          </div>

          <section className="message-detail" aria-label="Email reading pane">
            <div className="detail-toolbar">
              {selected ? (
                <button className="icon-button mobile-back" type="button" onClick={() => setSelected(null)} aria-label="Back to message list">
                  <ArrowLeft size={19} />
                </button>
              ) : (
                <span />
              )}
              <div className="detail-actions">
                <button className="icon-button" type="button" aria-label="Star message" disabled={!selected}><Star size={17} /></button>
                <button className="icon-button" type="button" aria-label="More message actions" disabled={!selected}><MoreHorizontal size={18} /></button>
              </div>
            </div>

            {selected ? (
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
            ) : (
              <div className="detail-empty">
                <div className="empty-icon"><Mail size={26} /></div>
                <strong>Select a message</strong>
                <span>Choose an email from the list to read it here.</span>
              </div>
            )}
          </section>
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
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;');
}
