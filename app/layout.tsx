import type { Metadata } from 'next';
import './globals.css';
import './responsive-fix.css';
import './mail-view.css';
import '../reply-forward.css';
import NotificationWatcher from '@/components/notification-watcher';
import ReplyForwardController from '@/components/reply-forward-controller';
import AttachmentsController from '@/components/attachments-controller';
import SearchNavigator from '@/components/search-navigator';
import MarkAllRead from '@/components/mark-all-read';
import ReportIssue from '@/components/report-issue';
import ScheduledNavLink from '@/components/scheduled-nav-link';

export const metadata: Metadata = {
  title: 'ABEmail Mail',
  description: 'ABEmail business mail workspace',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <NotificationWatcher />
        <ReplyForwardController />
        <AttachmentsController />
        <SearchNavigator />
        <MarkAllRead />
        <ReportIssue />
        <ScheduledNavLink />
      </body>
    </html>
  );
}
