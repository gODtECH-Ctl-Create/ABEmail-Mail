self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'New email', body: event.data?.text() || 'You have a new message.' };
  }

  const title = typeof payload.title === 'string' ? payload.title : 'New email';
  const options = {
    body: typeof payload.body === 'string' ? payload.body : 'You have a new message.',
    tag: typeof payload.tag === 'string' ? payload.tag : `abemail-${Date.now()}`,
    icon: typeof payload.icon === 'string' ? payload.icon : '/favicon.ico',
    badge: typeof payload.badge === 'string' ? payload.badge : '/favicon.ico',
    data: {
      url: typeof payload.url === 'string' ? payload.url : '/',
      messageId: typeof payload.messageId === 'string' ? payload.messageId : '',
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => 'focus' in client);
      if (existing) {
        existing.focus();
        if ('navigate' in existing) return existing.navigate(targetUrl);
      }
      return self.clients.openWindow(targetUrl);
    }),
  );
});

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager.subscribe(event.oldSubscription?.options || {})
      .then(async (subscription) => {
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(subscription.toJSON()),
        });
      })
      .catch(() => undefined),
  );
});
