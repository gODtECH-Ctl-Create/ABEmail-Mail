import { notFound } from 'next/navigation';
import ThemeControls from '@/components/theme-controls';
import {
  Archive,
  Bell,
  BookUser,
  CalendarClock,
  FileText,
  Forward,
  Inbox,
  Mail,
  MoreHorizontal,
  Paperclip,
  PenLine,
  Reply,
  Search,
  Send,
  Settings,
  ShieldAlert,
  Star,
  Trash2,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

const sampleMessages = [
  {
    initials: 'ML',
    sender: 'Morgan Lee',
    email: 'morgan@northstar.example',
    time: '10:42 AM',
    subject: 'Welcome to the new shared design system',
    preview: 'Here is a first look at the new theme and the shared color tokens...',
    selected: true,
  },
  {
    initials: 'TO',
    sender: 'Tomi Okafor',
    email: 'tomi@studio.example',
    time: '9:18 AM',
    subject: 'Project handover notes',
    preview: 'I have added the outstanding items and the latest delivery notes...',
    selected: false,
  },
  {
    initials: 'AC',
    sender: 'Ada Consulting',
    email: 'team@ada-consulting.example',
    time: 'Yesterday',
    subject: 'Updated proposal for review',
    preview: 'Thanks for the feedback. The revised proposal is attached...',
    selected: false,
  },
];

export default function DesignPreviewPage() {
  // Keep this mock-data route out of the live production application.
  if (process.env.VERCEL_ENV === 'production') notFound();

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Visual preview mailbox navigation">
        <div className="sidebar-top">
          <div className="brand">
            <div className="brand-mark">AB</div>
            <div>
              <strong>ABEmail</strong>
              <span>Design preview</span>
            </div>
          </div>
        </div>

        <button className="compose primary-action" type="button" disabled>
          <PenLine size={17} />
          <span>Compose</span>
        </button>

        <nav className="folder-nav" aria-label="Sample mail folders">
          <div className="nav-section-label">Inbox</div>
          <div className="nav-item active"><Inbox size={16} /><span>Primary</span><b>3</b></div>
          <div className="nav-item"><Mail size={16} /><span>All Mail</span></div>
          <div className="nav-section-label">Sent</div>
          <div className="nav-item"><Send size={16} /><span>My Sent</span></div>
          <div className="nav-item"><Send size={16} /><span>All Sent</span></div>
          <div className="nav-section-label">More</div>
          <div className="nav-item"><FileText size={16} /><span>Drafts</span></div>
          <div className="nav-item"><Star size={16} /><span>Starred</span></div>
          <div className="nav-item"><Trash2 size={16} /><span>Trash</span></div>
          <div className="nav-item"><ShieldAlert size={16} /><span>Spam</span></div>
          <div className="nav-item"><CalendarClock size={16} /><span>Scheduled</span></div>
          <div className="nav-section-label">Business</div>
          <div className="nav-item"><BookUser size={16} /><span>Contacts</span></div>
        </nav>

        <div className="sidebar-bottom">
          <div className="nav-item"><Settings size={17} /><span>Settings</span></div>
          <div className="account-card" aria-label="Preview account">
            <div className="avatar">AP</div>
            <div className="account-copy">
              <strong>Sample Account</strong>
              <span>Visual preview only</span>
            </div>
            <MoreHorizontal size={16} />
          </div>
        </div>
      </aside>

      <section className="mail-panel">
        <header className="topbar">
          <div className="topbar-left">
            <div>
              <p className="eyebrow">Design system · Preview lab</p>
              <h1>Primary</h1>
              <span className="view-description">Sample messages only. No live mail or account changes.</span>
            </div>
          </div>
          <label className="search">
            <Search size={17} />
            <input aria-label="Sample search" placeholder="Search sample mail" readOnly />
            <span className="search-shortcut">Ctrl K</span>
          </label>
        </header>

        <ThemeControls variant="preview" />

        <div className="mail-content">
          <section className="message-list" aria-label="Sample message list">
            <div className="list-toolbar">
              <span>3 sample messages</span>
              <span>Latest first</span>
            </div>

            {sampleMessages.map((message) => (
              <div
                key={message.email}
                className={`message-row ${message.selected ? 'selected' : ''}`}
                aria-current={message.selected ? 'true' : undefined}
              >
                <div className="message-avatar">{message.initials}</div>
                <div className="message-main">
                  <div className="message-head">
                    <strong>{message.sender}</strong>
                    <span>{message.time}</span>
                  </div>
                  <div className="message-subject">{message.subject}</div>
                  <p>{message.preview}</p>
                </div>
              </div>
            ))}
          </section>

          <section className="message-detail" aria-label="Sample message reading pane">
            <div className="detail-toolbar">
              <span className="status-text">Sample message</span>
              <div className="detail-actions">
                <button className="icon-button" type="button" disabled aria-label="Archive sample message"><Archive size={17} /></button>
                <button className="icon-button" type="button" disabled aria-label="More sample message actions"><MoreHorizontal size={17} /></button>
              </div>
            </div>

            <div className="detail-scroll">
              <div className="detail-heading">
                <h2>Welcome to the new shared design system</h2>
              </div>

              <div className="detail-meta-row">
                <div className="large-avatar">ML</div>
                <div className="detail-meta">
                  <strong>Morgan Lee</strong>
                  <span>morgan@northstar.example · to Sample Account</span>
                </div>
                <time>10:42 AM</time>
              </div>

              <div className="message-content">
                <p>Hi there,</p>
                <p>This is a sample reading pane for the ABE TechLab Design System pilot.</p>
                <p>The selected palette supplies shared background, surface, border, muted text, focus, and action colors while the existing mail layout stays in place.</p>
                <p>This preview uses fictional content only. Sending, replying, attachments, search, and mailbox changes are intentionally disabled here.</p>
                <p>Thanks,<br />Morgan</p>
              </div>

              <div className="detail-reply-actions">
                <button className="reply-button" type="button" disabled><Reply size={15} /> Reply</button>
                <button className="reply-button secondary" type="button" disabled><Forward size={15} /> Forward</button>
                <button className="reply-button secondary" type="button" disabled><Paperclip size={15} /> Attachments</button>
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
