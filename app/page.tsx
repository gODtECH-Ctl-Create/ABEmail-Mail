'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CalendarClock,
  FileText,
  Forward,
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
  ShieldAlert,
  Star,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

type ViewKey = 'primary' | 'all' | 'my-sent' | 'all-sent' | 'drafts' | 'starred' | 'trash' | 'spam' | 'scheduled';

type Mailbox = { id: string; address: string; display_name: string | null; active: boolean };

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
  is_read: boolean;
  is_starred: boolean;
  is_trashed: boolean;
  is_spam: boolean;
};

type Draft = {
  id: string;
  user_id: string;
  from_address: string;
  to_addresses: string[];
  cc_addresses: string[];
  bcc_addresses: string[];
  subject: string;
  html_body: string;
  text_body: string;
  created_at: string;
  updated_at: string;
};

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

type ComposeSeed = { draftId?: string; to?: string; subject?: string; body?: string };

const viewMeta: Record<ViewKey, { title: string; eyebrow: string; description: string }> = {
  primary: { title: 'Primary', eyebrow: 'Inbox', description: 'Messages addressed to your mailbox.' },
  all: { title: 'All Mail', eyebrow: 'Inbox', description: 'Messages addressed to any company mailbox.' },
  'my-sent': { title: 'My Sent', eyebrow: 'Sent', description: 'Messages sent from your mailbox.' },
  'all-sent': { title: 'All Sent', eyebrow: 'Sent', description: 'Messages sent by any company mailbox.' },
  drafts: { title: 'Drafts', eyebrow: 'Mail', description: 'Messages you started and have not sent yet.' },
  starred: { title: 'Starred', eyebrow: 'Mail', description: 'Messages you marked for quick access.' },
  trash: { title: 'Trash', eyebrow: 'Mail', description: 'Messages moved out of your active mailboxes.' },
  spam: { title: 'Spam', eyebrow: 'Mail', description: 'Messages you marked as unwanted.' },
  scheduled: { title: 'Scheduled Messages', eyebrow: 'Mail', description: 'Messages waiting to be sent automatically later.' },
};

function localInputValue(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function displayDate(value: string) {
  return new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function initialScheduledForm() {
  return { to: '', subject: '', body: '', scheduledAt: localInputValue(new Date(Date.now() + 60 * 60 * 1000)) };
}

export default function Home() {
  const [view, setView] = useState<ViewKey>('primary');
  const [mailboxFilter, setMailboxFilter] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [selected, setSelected] = useState<Message | null>(null);
  const [composeSeed, setComposeSeed] = useState<ComposeSeed>({});
  const [loading, setLoading] = useState(true);
  const [currentUserEmail, setCurrentUserEmail] = useState('');
  const [error, setError] = useState('');
  const [actionBusy, setActionBusy] = useState(false);

  useEffect(() => {
    const requestedView = new URLSearchParams(window.location.search).get('view');
    if (requestedView === 'scheduled') setView('scheduled');
  }, []);

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
        if (view === 'scheduled') {
          if (mounted) {
            setCurrentUserEmail(email);
            setMessages([]);
            setDrafts([]);
            setMailboxes([]);
          }
          return;
        }

        if (view === 'drafts') {
          const response = await fetch('/api/drafts', { cache: 'no-store' });
          const data = await response.json();
          if (response.status === 401) {
            window.location.href = '/login';
            return;
          }
          if (!response.ok) throw new Error(data.error ?? 'Unable to load drafts.');
          if (!mounted) return;
          setCurrentUserEmail(email);
          setDrafts(data.drafts ?? []);
          setMessages([]);
          return;
        }

        const params = new URLSearchParams({ view });
        if (mailboxFilter && (view === 'all' || view === 'all-sent')) params.set('mailbox', mailboxFilter);
        const response = await fetch(`/api/inbox?${params.toString()}`, { cache: 'no-store' });
        const data = await response.json();
        if (response.status === 401) {
          window.location.href = '/login';
          return;
        }
        if (!response.ok) throw new Error(data.error ?? 'Unable to load mailbox.');
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
    return () => { mounted = false; };
  }, [view, mailboxFilter]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return messages;
    return messages.filter((message) =>
      `${message.from_address} ${message.to_addresses.join(' ')} ${message.subject} ${message.text_body ?? ''}`.toLowerCase().includes(normalized),
    );
  }, [messages, query]);

  const filteredDrafts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return drafts;
    return drafts.filter((draft) => `${draft.to_addresses.join(' ')} ${draft.subject} ${draft.text_body}`.toLowerCase().includes(normalized));
  }, [drafts, query]);

  const primaryUnreadCount = messages.filter((message) => message.direction === 'inbound' && !message.is_read).length;
  const meta = viewMeta[view];
  const hasMailboxFilter = view === 'all' || view === 'all-sent';
  const listCount = view === 'drafts' ? filteredDrafts.length : filtered.length;
  const noContent = listCount === 0;

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

  async function updateMessageState(id: string, action: 'read' | 'unread' | 'star' | 'unstar' | 'spam' | 'notspam' | 'trash' | 'restore') {
    if (actionBusy) return;
    setActionBusy(true);
    try {
      const response = await fetch('/api/messages', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Unable to update message.');
      const changed = data.message as Pick<Message, 'id' | 'is_read' | 'is_starred' | 'is_trashed' | 'is_spam'>;
      setMessages((current) => current
        .map((message) => message.id === id ? { ...message, ...changed } : message)
        .filter((message) => {
          if (view === 'spam') return action === 'notspam' ? message.id !== id : message.is_spam;
          if (view === 'trash') return action === 'restore' ? message.id !== id : true;
          if (action === 'spam' && message.id === id) return false;
          if (action === 'trash' && message.id === id) return false;
          if (view === 'starred' && action === 'unstar' && message.id === id) return false;
          return true;
        }));
      if (selected?.id === id) {
        const updated = { ...selected, ...changed };
        if ((action === 'trash' && view !== 'trash') || (action === 'spam' && view !== 'spam') || (action === 'notspam' && view === 'spam') || (view === 'starred' && action === 'unstar') || (view === 'trash' && action === 'restore')) {
          setSelected(null);
        } else {
          setSelected(updated);
        }
      }
    } catch (stateError) {
      console.error(stateError);
      setError('Unable to update that message.');
    } finally {
      setActionBusy(false);
    }
  }

  async function permanentlyDelete(id: string) {
    if (actionBusy || !window.confirm('Permanently delete this message?')) return;
    setActionBusy(true);
    try {
      const response = await fetch(`/api/messages?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Unable to delete message.');
      setMessages((current) => current.filter((message) => message.id !== id));
      setSelected(null);
    } catch (deleteError) {
      console.error(deleteError);
      setError('Unable to permanently delete that message.');
    } finally {
      setActionBusy(false);
    }
  }

  function openMessage(message: Message) {
    setSelected(message);
    setMobileNavOpen(false);
    if (!message.is_read && message.direction === 'inbound') {
      void updateMessageState(message.id, 'read');
    }
  }

  function openCompose(seed: ComposeSeed = {}) {
    setComposeSeed(seed);
    setComposerOpen(true);
  }

  function openDraft(draft: Draft) {
    openCompose({ draftId: draft.id, to: draft.to_addresses.join(', '), subject: draft.subject, body: draft.text_body });
  }

  async function logout() {
    await getSupabaseBrowser().auth.signOut();
    window.location.href = '/login';
  }

  const mailboxLabel = (mailbox: Mailbox) => mailbox.display_name || mailbox.address.split('@')[0];
  const activeMailboxLabel = mailboxFilter
    ? mailboxLabel(mailboxes.find((mailbox) => mailbox.address.toLowerCase() === mailboxFilter) ?? { id: '', address: mailboxFilter, display_name: null, active: true })
    : 'All mailboxes';

  function handleScheduled() {
    setComposerOpen(false);
    setComposeSeed({});
    chooseView('scheduled');
  }

  return (
    <main className={`app-shell ${mobileNavOpen ? 'nav-open' : ''} ${selected ? 'detail-open' : ''}`}>
      <div className="mobile-backdrop" onClick={() => setMobileNavOpen(false)} aria-hidden="true" />

      <aside className="sidebar" aria-label="Mailbox navigation">
        <div className="sidebar-top">
          <div className="brand">
            <div className="brand-mark">AB</div>
            <div><strong>ABEmail</strong><span>Business Mail</span></div>
          </div>
          <button className="icon-button mobile-close" type="button" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation"><X size={18} /></button>
        </div>

        <button className="compose primary-action" type="button" onClick={() => openCompose()}><PenLine size={17} /><span>Compose</span></button>

        <nav className="folder-nav" aria-label="Mail folders">
          <div className="nav-section-label">Inbox</div>
          <button type="button" className={`nav-item nav-subitem ${view === 'primary' ? 'active' : ''}`} onClick={() => chooseView('primary')}>
            <Inbox size={16} /><span>Primary</span>{primaryUnreadCount > 0 && <b>{primaryUnreadCount}</b>}
          </button>
          <button type="button" className={`nav-item nav-subitem ${view === 'all' ? 'active' : ''}`} onClick={() => chooseView('all')}>
            <Mail size={16} /><span>All Mail</span>
          </button>

          <div className="nav-section-label">Sent</div>
          <button type="button" className={`nav-item nav-subitem ${view === 'my-sent' ? 'active' : ''}`} onClick={() => chooseView('my-sent')}>
            <Send size={16} /><span>My Sent</span>
          </button>
          <button type="button" className={`nav-item nav-subitem ${view === 'all-sent' ? 'active' : ''}`} onClick={() => chooseView('all-sent')}>
            <Send size={16} /><span>All Sent</span>
          </button>

          <div className="nav-section-label">More</div>
          <button type="button" className={`nav-item nav-subitem ${view === 'drafts' ? 'active' : ''}`} onClick={() => chooseView('drafts')}>
            <FileText size={16} /><span>Drafts</span>{drafts.length > 0 && <b>{drafts.length}</b>}
          </button>
          <button type="button" className={`nav-item nav-subitem ${view === 'starred' ? 'active' : ''}`} onClick={() => chooseView('starred')}>
            <Star size={16} /><span>Starred</span>
          </button>
          <button type="button" className={`nav-item nav-subitem ${view === 'trash' ? 'active' : ''}`} onClick={() => chooseView('trash')}>
            <Trash2 size={16} /><span>Trash</span>
          </button>
          <button type="button" className={`nav-item nav-subitem ${view === 'spam' ? 'active' : ''}`} onClick={() => chooseView('spam')}>
            <ShieldAlert size={16} /><span>Spam</span>
          </button>
          <button type="button" className={`nav-item nav-subitem ${view === 'scheduled' ? 'active' : ''}`} onClick={() => chooseView('scheduled')}>
            <CalendarClock size={16} /><span>Scheduled</span>
          </button>
        </nav>

        <div className="sidebar-bottom">
          <button className="nav-item" type="button" onClick={() => { window.location.href = '/settings'; }}><Settings size={17} /><span>Settings</span></button>
          <button className="account-card" type="button" onClick={logout} title="Sign out">
            <div className="avatar">{initials(currentUserEmail || 'AB')}</div>
            <div className="account-copy"><strong>{currentUserEmail || 'ABEmail'}</strong><span>Sign out</span></div>
            <LogOut size={15} />
          </button>
        </div>
      </aside>

      <section className="mail-panel">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-menu" type="button" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation"><Menu size={20} /></button>
            <div><p className="eyebrow">{meta.eyebrow}</p><h1>{meta.title}</h1><span className="view-description">{meta.description}</span></div>
          </div>
          <label className="search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search mail" aria-label="Search mail" /><span className="search-shortcut">⌘ K</span></label>
        </header>

        {view === 'scheduled' ? (
          <ScheduledPanel />
        ) : (
          <div className="mail-content">
            <div className={`message-list ${selected ? 'hide-on-mobile' : ''}`}>
              <div className="list-toolbar"><span>{loading ? 'Loading' : `${listCount} ${listCount === 1 ? 'message' : 'messages'}`}</span><MoreHorizontal size={18} aria-hidden="true" /></div>

              {hasMailboxFilter && !loading && (
                <div className="mailbox-filter-bar" aria-label="Filter by mailbox">
                  <span className="mailbox-filter-label">Mailbox</span>
                  <div className="mailbox-filter-scroll">
                    <button type="button" className={`mailbox-chip ${!mailboxFilter ? 'active' : ''}`} onClick={() => setMailboxFilter('')}>All</button>
                    {mailboxes.map((mailbox) => <button key={mailbox.id} type="button" className={`mailbox-chip ${mailbox.address.toLowerCase() === mailboxFilter ? 'active' : ''}`} onClick={() => chooseMailbox(mailbox.address.toLowerCase())}>{mailboxLabel(mailbox)}</button>)}
                  </div>
                </div>
              )}

              {loading && <div className="empty-state loading-state"><div className="loading-line" /><div className="loading-line" /><div className="loading-line short" /></div>}
              {!loading && error && <div className="empty-state"><div className="empty-icon"><Mail size={25} /></div><strong>{error}</strong><span>Refresh the page and try again.</span></div>}

              {!loading && !error && view === 'drafts' && filteredDrafts.map((draft) => {
                const recipient = draft.to_addresses[0] || 'No recipient';
                const preview = draft.text_body?.replace(/\s+/g, ' ').trim() || 'Empty draft';
                return <article key={draft.id} className="message-row draft-row" onClick={() => openDraft(draft)} tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') openDraft(draft); }} role="button" aria-label={`Open draft ${draft.subject || 'Untitled'}`}>
                  <div className="message-avatar">{initials(recipient)}</div>
                  <div className="message-main"><div className="message-head"><strong>{draft.subject || '(no subject)'}</strong><span>{formatDate(draft.updated_at)}</span></div><div className="message-subject draft-tag">Draft · {recipient}</div><p>{preview}</p></div>
                </article>;
              })}

              {!loading && !error && view !== 'drafts' && filtered.map((message) => {
                const otherParty = message.direction === 'outbound' ? message.to_addresses[0] ?? 'Recipient' : message.from_address;
                const recipientText = message.direction === 'inbound' ? `to ${message.to_addresses.length > 1 ? `${message.to_addresses.length} mailboxes` : message.to_addresses[0] ?? 'your mailbox'}` : `from ${message.from_address}`;
                const preview = message.text_body?.replace(/\s+/g, ' ').trim() || 'Open message to view the content.';
                return <article key={message.id} className={`message-row ${selected?.id === message.id ? 'selected' : ''} ${!message.is_read && message.direction === 'inbound' ? 'unread' : ''}`} onClick={() => openMessage(message)} tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') openMessage(message); }} role="button" aria-label={`Open email from ${otherParty}`}>
                  <div className="message-avatar">{initials(otherParty)}</div>
                  <div className="message-main"><div className="message-head"><strong>{otherParty}</strong><span>{formatDate(message.created_at)}</span></div><div className="message-subject">{message.subject || '(no subject)'}</div><p>{preview}</p><small className="message-context">{recipientText}</small></div>
                  {!message.is_read && message.direction === 'inbound' && <span className="unread-dot" aria-label="Unread" />}
                  {message.is_starred && <Star className="message-star" size={14} fill="currentColor" aria-label="Starred" />}
                </article>;
              })}

              {!loading && !error && noContent && <div className="empty-state"><div className="empty-icon"><Mail size={25} /></div><strong>{query ? `No ${view === 'drafts' ? 'drafts' : 'messages'} match your search` : `${meta.title} is empty`}</strong><span>{query ? 'Try a different sender, subject, or keyword.' : view === 'primary' ? `Messages sent to ${currentUserEmail} will appear here.` : view === 'drafts' ? 'Drafts you start composing will appear here automatically.' : view === 'starred' ? 'Star a message to keep it here.' : view === 'trash' ? 'Deleted messages will appear here until permanently removed.' : view === 'spam' ? 'Messages marked as Spam will appear here.' : hasMailboxFilter ? `No messages for ${activeMailboxLabel.toLowerCase()}.` : 'Messages for your company mailboxes will appear here.'}</span>{!query && (view === 'primary' || view === 'my-sent' || view === 'drafts') && <button type="button" className="ghost-action" onClick={() => openCompose()}>Compose a message</button>}</div>}
            </div>

            <section className="message-detail" aria-label="Email reading pane">
              <div className="detail-toolbar">
                {selected ? <button className="icon-button mobile-back" type="button" onClick={() => setSelected(null)} aria-label="Back to message list"><ArrowLeft size={19} /></button> : <span />}
                <div className="detail-actions">
                  {selected && <button className="icon-button" type="button" aria-label={selected.is_starred ? 'Remove star' : 'Star message'} disabled={actionBusy} onClick={() => updateMessageState(selected.id, selected.is_starred ? 'unstar' : 'star')}><Star size={17} fill={selected.is_starred ? 'currentColor' : 'none'} /></button>}
                  {selected && selected.is_spam && <button className="icon-button" type="button" aria-label="Mark as Not Spam" disabled={actionBusy} onClick={() => updateMessageState(selected.id, 'notspam')}><Mail size={17} /></button>}
                  {selected && selected.direction === 'inbound' && !selected.is_spam && !selected.is_trashed && <button className="icon-button" type="button" aria-label="Mark as Spam" disabled={actionBusy} onClick={() => updateMessageState(selected.id, 'spam')}><ShieldAlert size={17} /></button>}
                  {selected && selected.is_trashed && <button className="icon-button" type="button" aria-label="Restore message" disabled={actionBusy} onClick={() => updateMessageState(selected.id, 'restore')}><Undo2 size={17} /></button>}
                  {selected && !selected.is_trashed && !selected.is_spam && <button className="icon-button" type="button" aria-label="Move to trash" disabled={actionBusy} onClick={() => updateMessageState(selected.id, 'trash')}><Trash2 size={17} /></button>}
                  {selected && selected.is_trashed && <button className="icon-button" type="button" aria-label="Permanently delete message" disabled={actionBusy} onClick={() => permanentlyDelete(selected.id)}><Trash2 size={17} /></button>}
                  {selected && <button className="icon-button" type="button" aria-label={selected.is_read ? 'Mark unread' : 'Mark read'} disabled={actionBusy} onClick={() => updateMessageState(selected.id, selected.is_read ? 'unread' : 'read')}><Mail size={17} /></button>}
                </div>
              </div>

              {selected ? <div className="detail-scroll">
                <div className="detail-heading"><h2>{selected.subject || '(no subject)'}</h2><div className="detail-meta-row"><div className="large-avatar">{initials(selected.from_address)}</div><div className="detail-meta"><strong>{selected.from_address}</strong><span>to {selected.to_addresses.join(', ') || 'this mailbox'}</span></div><time>{formatDate(selected.created_at, true)}</time></div></div>
                <div className="message-content" dangerouslySetInnerHTML={{ __html: selected.html_body || `<p>${escapeHtml(selected.text_body || '')}</p>` }} />
                <div className="detail-reply-actions"><button type="button" className="reply-button" onClick={() => openCompose({ to: selected.from_address, subject: replySubject(selected.subject), body: `\n\nOn ${formatDate(selected.created_at, true)}, ${selected.from_address} wrote:\n${selected.text_body || ''}` })}><Reply size={16} /> Reply</button><button type="button" className="reply-button secondary" onClick={() => openCompose({ to: selected.to_addresses[0], subject: `Fwd: ${selected.subject}`, body: `\n\n---------- Forwarded message ----------\nFrom: ${selected.from_address}\nSubject: ${selected.subject}\n\n${selected.text_body || ''}` })}><Forward size={16} /> Forward</button></div>
              </div> : <div className="detail-empty"><div className="empty-icon"><Mail size={26} /></div><strong>Select a message</strong><span>Choose an email from the list to read it here.</span></div>}
            </section>
          </div>
        )}
      </section>

      {composerOpen && <Compose seed={composeSeed} onClose={() => { setComposerOpen(false); setComposeSeed({}); }} onDraftDeleted={() => { setDrafts((current) => current.filter((draft) => draft.id !== composeSeed.draftId)); }} onSent={() => { setComposerOpen(false); setComposeSeed({}); window.location.reload(); }} onScheduled={handleScheduled} />}
    </main>
  );
}

function ScheduledPanel() {
  const [scheduled, setScheduled] = useState<ScheduledMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [status, setStatus] = useState('');
  const [form, setForm] = useState(initialScheduledForm);
  const [query, setQuery] = useState('');

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

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return scheduled;
    return scheduled.filter((message) => `${message.subject} ${message.to_addresses.join(' ')} ${message.text_body}`.toLowerCase().includes(normalized));
  }, [scheduled, query]);

  const active = visible.filter((message) => ['pending', 'processing', 'failed'].includes(message.status));
  const completed = visible.filter((message) => ['sent', 'cancelled'].includes(message.status));

  function resetForm() {
    setEditingId('');
    setForm(initialScheduledForm());
  }

  function editMessage(message: ScheduledMessage) {
    setEditingId(message.id);
    setForm({ to: message.to_addresses.join(', '), subject: message.subject, body: message.text_body, scheduledAt: localInputValue(message.scheduled_at) });
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
        to_addresses: splitAddresses(form.to),
        subject: form.subject.trim(),
        text_body: form.body,
        html_body: toHtml(form.body),
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
      if (editingId === id) resetForm();
      setStatus('Message cancelled.');
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
    <div style={{ padding: 24, minWidth: 0, overflowY: 'auto' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', display: 'grid', gap: 16 }}>
        <section style={{ background: '#fff', border: '1px solid #e4e6ea', borderRadius: 16, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
            <div><p className="eyebrow">{editingId ? 'Edit schedule' : 'New schedule'}</p><h2 style={{ margin: '4px 0 0', fontSize: 20 }}>{editingId ? 'Update scheduled email' : 'Schedule an email'}</h2></div>
            {editingId && <button type="button" onClick={resetForm} className="ghost-action">Cancel edit</button>}
          </div>
          <form onSubmit={submit} style={{ display: 'grid', gap: 10 }}>
            <label style={scheduledLabel}>To<input required value={form.to} onChange={(event) => setForm((current) => ({ ...current, to: event.target.value }))} placeholder="customer@example.com" style={scheduledInput} /></label>
            <label style={scheduledLabel}>Subject<input required value={form.subject} onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))} placeholder="Subject" style={scheduledInput} /></label>
            <label style={scheduledLabel}>Message<textarea required value={form.body} onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))} placeholder="Write your message…" style={{ ...scheduledInput, minHeight: 150, resize: 'vertical', lineHeight: 1.6 }} /></label>
            <label style={scheduledLabel}>Send at<input required type="datetime-local" value={form.scheduledAt} min={localInputValue(new Date())} onChange={(event) => setForm((current) => ({ ...current, scheduledAt: event.target.value }))} style={scheduledInput} /></label>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', paddingTop: 4 }}>
              <span style={{ fontSize: 11, color: status.includes('Unable') || status.includes('Invalid') ? '#a12d2d' : '#6f757e' }}>{status}</span>
              <button type="submit" disabled={busy} className="send-button">{busy ? 'Saving…' : editingId ? 'Update schedule' : 'Schedule send'} <CalendarClock size={15} /></button>
            </div>
          </form>
        </section>

        <section style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
            <div><p className="eyebrow">Queue</p><h2 style={{ margin: '4px 0 0', fontSize: 18 }}>Scheduled messages</h2></div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search scheduled" style={{ ...scheduledInput, width: 180, padding: '9px 11px' }} />
              <button type="button" onClick={() => void load()} disabled={loading} className="ghost-action">Refresh</button>
            </div>
          </div>

          {loading ? <div className="empty-state"><strong>Loading scheduled messages…</strong></div> : active.length === 0 ? <div className="empty-state"><div className="empty-icon"><CalendarClock size={25} /></div><strong>{query ? 'No scheduled messages match your search' : 'No active scheduled messages'}</strong><span>Messages scheduled from Compose will appear here immediately.</span></div> : active.map((message) => (
            <article key={message.id} style={scheduledCard}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}><strong style={{ fontSize: 14 }}>{message.subject || '(no subject)'}</strong><span style={statusPill(message.status)}>{message.status}</span></div>
                <div style={{ marginTop: 6, fontSize: 11, color: '#737983', overflowWrap: 'anywhere' }}>{message.to_addresses.join(', ')}</div>
                <div style={{ marginTop: 8, fontSize: 12, color: '#4e545d' }}><CalendarClock size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />{displayDate(message.scheduled_at)}</div>
                {message.last_error && <div style={{ marginTop: 7, color: '#a12d2d', fontSize: 11 }}>{message.last_error}</div>}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" onClick={() => editMessage(message)} disabled={busy || message.status === 'processing'} className="ghost-action">Edit / Reschedule</button>
                <button type="button" onClick={() => void cancelMessage(message.id)} disabled={busy || message.status === 'processing'} className="ghost-action">Cancel</button>
                {message.status === 'failed' && <button type="button" onClick={() => editMessage(message)} disabled={busy} className="send-button">Retry</button>}
              </div>
            </article>
          ))}

          {completed.length > 0 && <div style={{ display: 'grid', gap: 10, marginTop: 4 }}><p className="eyebrow" style={{ margin: 0 }}>History</p>{completed.map((message) => <article key={message.id} style={{ ...scheduledCard, gridTemplateColumns: '1fr auto' }}><div style={{ minWidth: 0 }}><strong style={{ display: 'block', fontSize: 12 }}>{message.subject || '(no subject)'}</strong><span style={{ display: 'block', marginTop: 4, fontSize: 10, color: '#858a92' }}>{message.status} · {message.sent_at ? displayDate(message.sent_at) : displayDate(message.updated_at)}</span></div><button type="button" onClick={() => void deleteMessage(message.id)} disabled={busy} className="ghost-action">Delete</button></article>)}</div>}
        </section>
      </div>
    </div>
  );
}

const scheduledLabel: React.CSSProperties = { display: 'grid', gap: 5, fontSize: 11, color: '#666c75', fontWeight: 700 };
const scheduledInput: React.CSSProperties = { padding: '11px 12px', border: '1px solid #dfe2e6', borderRadius: 10, outline: 0, background: '#fff', color: '#20242a' };
const scheduledCard: React.CSSProperties = { background: '#fff', border: '1px solid #e4e6ea', borderRadius: 16, padding: 18, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 14, alignItems: 'center' };
function statusPill(status: string): React.CSSProperties { return { borderRadius: 999, padding: '5px 8px', background: status === 'failed' ? '#fff0ef' : status === 'processing' ? '#eef1f6' : '#eef8f2', color: status === 'failed' ? '#aa3a32' : '#4f5966', fontSize: 10, textTransform: 'uppercase', fontWeight: 800 }; }

function Compose({ seed, onClose, onDraftDeleted, onSent, onScheduled }: { seed: ComposeSeed; onClose: () => void; onDraftDeleted: () => void; onSent: () => void; onScheduled: () => void }) {
  const [to, setTo] = useState(seed.to ?? '');
  const [subject, setSubject] = useState(seed.subject ?? '');
  const [body, setBody] = useState(seed.body ?? '');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [draftId, setDraftId] = useState(seed.draftId ?? '');
  const [saveTimer, setSaveTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduledAt, setScheduledAt] = useState(localInputValue(new Date(Date.now() + 60 * 60 * 1000)));

  useEffect(() => {
    setTo(seed.to ?? ''); setSubject(seed.subject ?? ''); setBody(seed.body ?? ''); setDraftId(seed.draftId ?? ''); setStatus(''); setScheduleOpen(false); setScheduledAt(localInputValue(new Date(Date.now() + 60 * 60 * 1000)));
  }, [seed.draftId, seed.to, seed.subject, seed.body]);

  useEffect(() => {
    const hasContent = to.trim() || subject.trim() || body.trim();
    if (!hasContent || busy) return;
    if (saveTimer) clearTimeout(saveTimer);
    const timer = setTimeout(() => { void saveDraft(); }, 700);
    setSaveTimer(timer);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to, subject, body, busy]);

  async function saveDraft() {
    if (busy || (!to.trim() && !subject.trim() && !body.trim())) return;
    setStatus('Saving…');
    try {
      const payload = { to_addresses: splitAddresses(to), cc_addresses: [], bcc_addresses: [], subject, html_body: toHtml(body), text_body: body };
      const response = draftId
        ? await fetch('/api/drafts', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: draftId, ...payload }) })
        : await fetch('/api/drafts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) { setStatus('Draft save failed'); return; }
      if (!draftId && data.draft?.id) setDraftId(data.draft.id);
      setStatus('Saved');
    } catch (saveError) { console.error(saveError); setStatus('Draft save failed'); }
  }

  async function closeComposer() {
    if (busy) return;
    if (to.trim() || subject.trim() || body.trim()) { if (saveTimer) clearTimeout(saveTimer); await saveDraft(); }
    onClose();
  }

  async function deleteDraft() {
    if (!draftId || busy) { onClose(); return; }
    setBusy(true);
    try {
      const response = await fetch(`/api/drafts?id=${encodeURIComponent(draftId)}`, { method: 'DELETE' });
      if (!response.ok) { const data = await response.json().catch(() => ({})); setStatus(data.error ?? 'Unable to delete draft.'); setBusy(false); return; }
      onDraftDeleted(); onClose();
    } catch (deleteError) { console.error(deleteError); setStatus('Unable to delete draft.'); setBusy(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!to.trim() || !subject.trim() || !body.trim()) { setStatus('To, subject and message are required.'); return; }
    if (saveTimer) clearTimeout(saveTimer);
    setBusy(true); setStatus('Sending…');
    try {
      const response = await fetch('/api/send', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ to: splitAddresses(to)[0] ?? to.trim(), subject: subject.trim(), html: toHtml(body), draftId: draftId || undefined }) });
      const data = await response.json();
      if (!response.ok) { setStatus(data.error ?? 'Unable to send message.'); setBusy(false); return; }
      setStatus('Message sent'); window.setTimeout(onSent, 550);
    } catch (sendError) { console.error(sendError); setStatus('Unable to send message.'); setBusy(false); }
  }

  async function scheduleMessage() {
    if (busy) return;
    if (!to.trim() || !subject.trim() || !body.trim()) { setStatus('To, subject and message are required.'); return; }
    const timestamp = Date.parse(scheduledAt);
    if (!Number.isFinite(timestamp) || timestamp <= Date.now()) { setStatus('Choose a future date and time.'); return; }
    if (saveTimer) clearTimeout(saveTimer);
    setBusy(true); setStatus('Scheduling…');
    try {
      const response = await fetch('/api/scheduled', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          to_addresses: splitAddresses(to),
          subject: subject.trim(),
          text_body: body,
          html_body: toHtml(body),
          scheduled_at: new Date(timestamp).toISOString(),
        }),
      });
      const data = await response.json();
      if (!response.ok) { setStatus(data.error ?? 'Unable to schedule message.'); setBusy(false); return; }
      if (draftId) await fetch(`/api/drafts?id=${encodeURIComponent(draftId)}`, { method: 'DELETE' }).catch(() => null);
      setStatus('Message scheduled');
      window.setTimeout(onScheduled, 350);
    } catch (scheduleError) { console.error(scheduleError); setStatus('Unable to schedule message.'); setBusy(false); }
  }

  return <div className="overlay" role="dialog" aria-modal="true" aria-label="Compose email">
    <form className="composer-window" onSubmit={submit}>
      <div className="composer-head"><div><span className="eyebrow">ABEmail</span><strong>{draftId ? 'Edit draft' : 'New message'}</strong></div><button className="icon-button" type="button" onClick={closeComposer} aria-label="Close composer" disabled={busy}><X size={18} /></button></div>
      <input name="to" type="text" placeholder="To" value={to} onChange={(event) => setTo(event.target.value)} />
      <input name="subject" placeholder="Subject" value={subject} onChange={(event) => setSubject(event.target.value)} />
      <textarea name="body" placeholder="Write your message…" value={body} onChange={(event) => setBody(event.target.value)} />
      {scheduleOpen && <div style={{ margin: '0 18px 8px', padding: 12, border: '1px solid #e1e4e8', borderRadius: 12, background: '#fafbfc', display: 'grid', gap: 8 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}><strong style={{ fontSize: 12 }}>Schedule send</strong><button type="button" className="icon-button" onClick={() => setScheduleOpen(false)} disabled={busy} aria-label="Close schedule picker"><X size={15} /></button></div><label style={scheduledLabel}>Send at<input type="datetime-local" value={scheduledAt} min={localInputValue(new Date())} onChange={(event) => setScheduledAt(event.target.value)} style={scheduledInput} /></label><button type="button" className="send-button" onClick={() => void scheduleMessage()} disabled={busy}>{busy ? 'Scheduling…' : 'Schedule message'} <CalendarClock size={15} /></button></div>}
      <div className="composer-foot"><div className="composer-status"><span className={status === 'Saved' || status === 'Message sent' || status === 'Message scheduled' ? 'success' : 'status-text'}>{status}</span>{draftId && status === 'Saved' && <small>Draft saved</small>}</div><div className="composer-actions">{draftId && <button className="delete-draft-button" type="button" onClick={deleteDraft} disabled={busy}>Delete draft</button>}<button className="ghost-action" type="button" onClick={() => setScheduleOpen((open) => !open)} disabled={busy}><CalendarClock size={15} /> Schedule</button><button className="send-button" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send'} <Send size={15} /></button></div></div>
    </form>
  </div>;
}

function splitAddresses(value: string) { return value.split(/[\n,;]+/).map((item) => item.trim().toLowerCase()).filter(Boolean); }
function toHtml(value: string) { return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br />'); }
function initials(value: string) { const clean = value.includes('@') ? value.split('@')[0] : value; return clean.split(/[._\s-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'AB'; }
function formatDate(value: string, detailed = false) { return new Date(value).toLocaleString([], detailed ? { dateStyle: 'medium', timeStyle: 'short' } : { month: 'short', day: 'numeric' }); }
function replySubject(subject: string) { return subject.toLowerCase().startsWith('re:') ? subject : `Re: ${subject}`; }
function escapeHtml(value: string) { return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;'); }
