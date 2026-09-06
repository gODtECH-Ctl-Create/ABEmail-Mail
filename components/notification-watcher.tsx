'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import { hasWebPushSubscription } from '@/lib/push-client';

type NotificationPreferences = {
  browser_notifications: boolean;
};

type Message = {
  id: string;
  direction: 'inbound' | 'outbound';
  from_address: string;
  subject: string;
  created_at: string;
  is_trashed: boolean;
};

const POLL_INTERVAL_MS = 30_000;
const NOTIFICATION_KEY_PREFIX = 'abemail:last-notified:';

export default function NotificationWatcher() {
  const [alert, setAlert] = useState<{ id: string; title: string; body: string } | null>(null);
  const lastSeenAtRef = useRef<string | null>(null);
  const pollingRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    let intervalId: number | undefined;

    async function readPreferences(userId: string) {
      const { data } = await getSupabaseBrowser()
        .from('notification_preferences')
        .select('browser_notifications')
        .eq('user_id', userId)
        .maybeSingle<NotificationPreferences>();
      return Boolean(data?.browser_notifications);
    }

    async function poll() {
      if (!mounted || pollingRef.current) return;
      pollingRef.current = true;

      try {
        const supabase = getSupabaseBrowser();
        const { data: userData } = await supabase.auth.getUser();
        const user = userData.user;
        const email = user?.email?.toLowerCase();
        if (!user?.id || !email || !email.endsWith('@waste2light.com')) return;

        const browserEnabled = await readPreferences(user.id);
        const response = await fetch('/api/inbox?view=primary', { cache: 'no-store' });
        if (!response.ok) return;

        const payload = await response.json() as { messages?: Message[] };
        const messages = (payload.messages ?? [])
          .filter((message) => message.direction === 'inbound' && !message.is_trashed)
          .sort((a, b) => a.created_at.localeCompare(b.created_at));

        const storageKey = `${NOTIFICATION_KEY_PREFIX}${email}`;

        if (lastSeenAtRef.current === null) {
          const stored = window.localStorage.getItem(storageKey);
          lastSeenAtRef.current = stored || messages[messages.length - 1]?.created_at || new Date().toISOString();
          if (!stored) window.localStorage.setItem(storageKey, lastSeenAtRef.current);
          return;
        }

        const newMessages = messages.filter((message) => message.created_at > (lastSeenAtRef.current ?? ''));
        if (!newMessages.length) return;

        const newest = newMessages[newMessages.length - 1];
        lastSeenAtRef.current = newest.created_at;
        window.localStorage.setItem(storageKey, newest.created_at);

        const title = newMessages.length === 1 ? 'New email' : `${newMessages.length} new emails`;
        const body = newMessages.length === 1
          ? `${newest.from_address} · ${newest.subject || '(no subject)'}`
          : `New messages are waiting in your inbox for ${email}.`;

        if (mounted && document.visibilityState === 'visible') {
          setAlert({ id: newest.id, title, body });
          window.setTimeout(() => setAlert(null), 6500);
        }

        const pushSubscribed = browserEnabled && await hasWebPushSubscription();
        if (!pushSubscribed && browserEnabled && 'Notification' in window && Notification.permission === 'granted' && document.visibilityState === 'visible') {
          const notification = new Notification(title, {
            body,
            tag: `abemail-${newest.id}`,
            icon: '/favicon.ico',
          });

          notification.onclick = () => {
            window.focus();
            window.location.href = '/';
            notification.close();
          };
        }
      } catch (error) {
        console.error('notification watcher error', error);
      } finally {
        pollingRef.current = false;
      }
    }

    void getSupabaseBrowser().auth.getUser().then(({ data }) => {
      const email = data.user?.email?.toLowerCase() ?? '';
      if (!email.endsWith('@waste2light.com')) return;
      void poll();
      intervalId = window.setInterval(() => void poll(), POLL_INTERVAL_MS);
    });

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void poll();
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      mounted = false;
      pollingRef.current = false;
      if (intervalId !== undefined) window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  if (!alert) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 18,
        right: 18,
        zIndex: 1000,
        width: 'min(390px, calc(100vw - 36px))',
        border: '1px solid rgba(17, 24, 39, 0.12)',
        borderRadius: 16,
        background: '#ffffff',
        boxShadow: '0 18px 50px rgba(15, 23, 42, 0.16)',
        padding: 14,
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 11,
          display: 'grid',
          placeItems: 'center',
          background: '#111827',
          color: '#ffffff',
          flex: '0 0 auto',
        }}
      >
        <Bell size={17} />
      </div>
      <button
        type="button"
        onClick={() => (window.location.href = '/')}
        style={{
          border: 0,
          background: 'transparent',
          padding: 0,
          textAlign: 'left',
          cursor: 'pointer',
          flex: 1,
          color: '#111827',
        }}
      >
        <strong style={{ display: 'block', fontSize: 14, marginBottom: 4 }}>{alert.title}</strong>
        <span style={{ display: 'block', fontSize: 13, lineHeight: 1.45, color: '#4b5563' }}>{alert.body}</span>
      </button>
      <button
        type="button"
        onClick={() => setAlert(null)}
        aria-label="Dismiss notification"
        style={{
          border: 0,
          background: 'transparent',
          color: '#6b7280',
          padding: 4,
          cursor: 'pointer',
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
}
