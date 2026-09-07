import type { Metadata } from 'next';
import './globals.css';
import './responsive-fix.css';
import './mail-view.css';
import './reply-forward.css';
import NotificationWatcher from '@/components/notification-watcher';
import ReplyForwardController from '@/components/reply-forward-controller';

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
      </body>
    </html>
  );
}
