import type { Metadata } from 'next';
import './globals.css';
import '@abe-techlab/abe-techlab-design-system/styles/themes/light-green.css';
import './responsive-fix.css';
import './mail-view.css';
import './contacts-view.css';
import '../reply-forward.css';
import './design-system-adapter.css';
import NotificationWatcher from '@/components/notification-watcher';
import ReplyForwardController from '@/components/reply-forward-controller';
import AttachmentsController from '@/components/attachments-controller';
import SearchNavigator from '@/components/search-navigator';
import MarkAllRead from '@/components/mark-all-read';
import ReportIssue from '@/components/report-issue';
import ContactsBridge from '@/components/contacts-bridge';

export const metadata: Metadata = {
  title: 'ABEmail Mail',
  description: 'ABEmail business mail workspace',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="light-green">
      <body>
        {children}
        <NotificationWatcher />
        <ReplyForwardController />
        <AttachmentsController />
        <SearchNavigator />
        <MarkAllRead />
        <ReportIssue />
        <ContactsBridge />
      </body>
    </html>
  );
}
