self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }

  const title = typeof data.title === 'string' ? data.title : 'ABEmail';
  const body = typeof data.body === 'string' ? data.body : 'You have a new email.';
  const url = typeof data.url === 'string' ? data.url : '/';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: typeof data.icon === 'string' ? data.icon : '/favicon.ico',
      badge: typeof data.badge === 'string' ? data.badge : '/favicon.ico',
      tag: typeof data.tag === 'string' ? data.tag : 'abemail-mail',
      renotify: true,
      data: { url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = typeof event.notification?.data?.url === 'string' ? event.notification.data.url : '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
      const sameOriginClient = clients.find((client) => client.url.startsWith(self.location.origin));
      if (sameOriginClient) {
        await sameOriginClient.focus();
        if ('navigate' in sameOriginClient) await sameOriginClient.navigate(targetUrl);
        return;
      }
      await self.clients.openWindow(targetUrl);
    }),
  );
});

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
