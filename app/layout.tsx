import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import type { ThemeId } from '@abe-techlab/abe-techlab-design-system/react';
import '@abe-techlab/abe-techlab-design-system/styles.css';
import './globals.css';
import './responsive-fix.css';
import './mail-view.css';
import './contacts-view.css';
import '../reply-forward.css';
import './design-system-adapter.css';
import AppThemeProvider from '@/components/app-theme-provider';
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

const VALID_THEME_IDS: readonly ThemeId[] = [
  'claude',
  'discord',
  'supabase',
  'vercel',
  'mono',
  'notebook',
  'light-green',
  'zen',
  'astro-vista',
  'whatsapp',
];

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const savedTheme = cookieStore.get('active_theme')?.value;
  const initialTheme = VALID_THEME_IDS.find((theme) => theme === savedTheme) ?? 'light-green';
  const isDark = cookieStore.get('active_color_mode')?.value === 'dark';

  return (
    <html lang="en" data-theme={initialTheme} className={isDark ? 'dark' : undefined}>
      <body>
        <AppThemeProvider initialTheme={initialTheme}>
          {children}
        </AppThemeProvider>
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
