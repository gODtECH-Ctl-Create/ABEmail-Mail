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
  FileText,
} from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

type ViewKey = 'primary' | 'all' | 'my-sent' | 'all-sent' | 'drafts';

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

type ComposeSeed = {
  draftId?: string;
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
  drafts: {
    title: 'Drafts',
    eyebrow: 'Mail',
    description: 'Messages you started and have not sent yet.',
  },
};

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

        if (view === 'drafts') {
          const response = await fetch('/api/drafts', { cache: 'no-store' });
          const data = await response.json();

          if (response.status === 401) {
            window.location.href = '/login';
            return;
          }

          if (!response.ok) {
            throw new Error(data.error ?? 'Unable to load drafts.');
          }

          if (!mounted) return;
          setCurrentUserEmail(email);
          setDrafts(data.drafts ?? []);
          setMessages([]);
          setMailboxFilter('');
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

  const filteredDrafts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return drafts;
    return drafts.filter((draft) =>
      `${draft.to_addresses.join(' ')} ${draft.subject} ${draft.text_body}`.toLowerCase().includes(normalized),
    );
  }, [drafts, query]);

  const primaryCount = view === 'primary' ? messages.filter((message) => message.direction === 'inbound').length : null;
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

  function openDraft(draft: Draft) {
    openCompose({
      draftId: draft.id,
      to: draft.to_addresses.join(', '),
      subject: draft.subject,
      body: draft.text_body,
    });
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

  const listCount = view === 'drafts' ? filteredDrafts.length : filtered.length;
  const noContent = view === 'drafts' ? filteredDrafts.length === 0 : filtered.length === 0;

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
          <button type="button" className={`nav-item nav-subitem ${view === 'primary' ? 'active' : ''}`} onClick={() => chooseView('primary')}>
            <Inbox size={16} />
            <span>Primary</span>
            {view === 'primary' && <b>{primaryCount || ''}</b>}
          </button>
          <button type="button" className={`nav-item nav-subitem ${view === 'all' ? 'active' : ''}`} onClick={() => chooseView('all')}>
            <Mail size={16} />
            <span>All Mail</span>
          </button>

          <div className="nav-section-label">Sent</div>
          <button type="button" className={`nav-item nav-subitem ${view === 'my-sent' ? 'active' : ''}`} onClick={() => chooseView('my-sent')}>
            <Send size={16} />
            <span>My Sent</span>
          </button>
          <button type="button" className={`nav-item nav-subitem ${view === 'all-sent' ? 'active' : ''}`} onClick={() => chooseView('all-sent')}>
            <Send size={16} />
            <span>All Sent</span>
          </button>

          <div className="nav-section-label">More</div>
          <button type="button" className={`nav-item nav-subitem ${view === 'drafts' ? 'active' : ''}`} onClick={() => chooseView('drafts')}>
            <FileText size={16} />
            <span>Drafts</span>
            {drafts.length > 0 && <b>{drafts.length}</b>}
          </button>
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
              <span>{loading ? 'Loading' : `${listCount} ${listCount === 1 ? 'message' : 'messages'}`}</span>
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

            {!loading && !error && view === 'drafts' && filteredDrafts.map((draft) => {
              const recipient = draft.to_addresses[0] || 'No recipient';
              const preview = draft.text_body?.replace(/\s+/g, ' ').trim() || 'Empty draft';
              return (
                <article
                  key={draft.id}
                  className="message-row draft-row"
                  onClick={() => openDraft(draft)}
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') openDraft(draft);
                  }}
                  role="button"
                  aria-label={`Open draft ${draft.subject || 'Untitled'}`}
                >
                  <div className="message-avatar">{initials(recipient)}</div>
                  <div className="message-main">
                    <div className="message-head">
                      <strong>{draft.subject || '(no subject)'}</strong>
                      <span>{formatDate(draft.updated_at)}</span>
                    </div>
                    <div className="message-subject draft-tag">Draft · {recipient}</div>
                    <p>{preview}</p>
                  </div>
                </article>
              );
            })}

            {!loading && !error && view !== 'drafts' && filtered.map((message) => {
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

            {!loading && !error && noContent && (
              <div className="empty-state">
                <div className="empty-icon"><Mail size={25} /></div>
                <strong>{query ? 'No messages match your search' : `${meta.title} is empty`}</strong>
                <span>
                  {query
                    ? 'Try a different sender, subject, or keyword.'
                    : view === 'primary'
                      ? `Messages sent to ${currentUserEmail} will appear here.`
                      : view === 'drafts'
                        ? 'Drafts you start composing will appear here automatically.'
                        : hasMailboxFilter
                          ? `No messages for ${activeMailboxLabel.toLowerCase()}.`
                          : 'Messages for your company mailboxes will appear here.'}
                </span>
                {!query && (view === 'primary' || view === 'my-sent' || view === 'drafts') && (
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
          onDraftDeleted={() => {
            setDrafts((current) => current.filter((draft) => draft.id !== composeSeed.draftId));
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

function Compose({
  seed,
  onClose,
  onDraftDeleted,
  onSent,
}: {
  seed: ComposeSeed;
  onClose: () => void;
  onDraftDeleted: () => void;
  onSent: () => void;
}) {
  const [to, setTo] = useState(seed.to ?? '');
  const [subject, setSubject] = useState(seed.subject ?? '');
  const [body, setBody] = useState(seed.body ?? '');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [draftId, setDraftId] = useState(seed.draftId ?? '');
  const [saveTimer, setSaveTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setTo(seed.to ?? '');
    setSubject(seed.subject ?? '');
    setBody(seed.body ?? '');
    setDraftId(seed.draftId ?? '');
    setStatus('');
  }, [seed.draftId, seed.to, seed.subject, seed.body]);

  useEffect(() => {
    const hasContent = to.trim() || subject.trim() || body.trim();
    if (!hasContent || busy) return;

    if (saveTimer) clearTimeout(saveTimer);
    const timer = setTimeout(async () => {
      await saveDraft();
    }, 700);
    setSaveTimer(timer);

    return () => clearTimeout(timer);
    // saveDraft intentionally omitted to avoid recreating the debounce callback on each keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to, subject, body, busy]);

  async function saveDraft() {
    if (busy || (!to.trim() && !subject.trim() && !body.trim())) return;
    setStatus('Saving…');

    try {
      const payload = {
        to_addresses: splitAddresses(to),
        cc_addresses: [],
        bcc_addresses: [],
        subject,
        html_body: toHtml(body),
        text_body: body,
      };

      const response = draftId
        ? await fetch('/api/drafts', {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ id: draftId, ...payload }),
          })
        : await fetch('/api/drafts', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          });

      const data = await response.json();
      if (!response.ok) {
        setStatus('Draft save failed');
        return;
      }

      if (!draftId && data.draft?.id) setDraftId(data.draft.id);
      setStatus('Saved');
    } catch (error) {
      console.error(error);
      setStatus('Draft save failed');
    }
  }

  async function closeComposer() {
    if (busy) return;
    if (to.trim() || subject.trim() || body.trim()) {
      if (saveTimer) clearTimeout(saveTimer);
      await saveDraft();
    }
    onClose();
  }

  async function deleteDraft() {
    if (!draftId || busy) {
      onClose();
      return;
    }

    setBusy(true);
    try {
      const response = await fetch(`/api/drafts?id=${encodeURIComponent(draftId)}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setStatus(data.error ?? 'Unable to delete draft.');
        setBusy(false);
        return;
      }
      onDraftDeleted();
      onClose();
    } catch (error) {
      console.error(error);
      setStatus('Unable to delete draft.');
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    if (!to.trim() || !subject.trim() || !body.trim()) {
      setStatus('To, subject and message are required.');
      return;
    }

    if (saveTimer) clearTimeout(saveTimer);
    setBusy(true);
    setStatus('Sending…');

    try {
      const response = await fetch('/api/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          to: splitAddresses(to)[0] ?? to.trim(),
          subject: subject.trim(),
          html: toHtml(body),
          draftId: draftId || undefined,
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
            <strong>{draftId ? 'Edit draft' : 'New message'}</strong>
          </div>
          <button className="icon-button" type="button" onClick={closeComposer} aria-label="Close composer" disabled={busy}><X size={18} /></button>
        </div>
        <input name="to" type="text" placeholder="To" value={to} onChange={(event) => setTo(event.target.value)} />
        <input name="subject" placeholder="Subject" value={subject} onChange={(event) => setSubject(event.target.value)} />
        <textarea name="body" placeholder="Write your message…" value={body} onChange={(event) => setBody(event.target.value)} />
        <div className="composer-foot">
          <div className="composer-status">
            <span className={status === 'Saved' || status === 'Message sent' ? 'success' : 'status-text'}>{status}</span>
            {draftId && status === 'Saved' && <small>Draft saved</small>}
          </div>
          <div className="composer-actions">
            {draftId && <button className="delete-draft-button" type="button" onClick={deleteDraft} disabled={busy}>Delete draft</button>}
            <button className="send-button" type="submit" disabled={busy}>
              {busy ? 'Sending…' : 'Send'} <Send size={15} />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function splitAddresses(value: string) {
  return value
    .split(/[\n,;]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function toHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br />');
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
