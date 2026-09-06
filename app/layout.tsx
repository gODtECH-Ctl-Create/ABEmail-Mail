import type { Metadata } from 'next';
import './globals.css';
import './responsive-fix.css';
import './mail-view.css';
import NotificationWatcher from '@/components/notification-watcher';
import SearchNavigator from '@/components/search-navigator';

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
        <SearchNavigator />
      </body>
    </html>
  );
}
