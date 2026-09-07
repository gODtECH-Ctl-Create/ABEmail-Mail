# ABEmail Web Push

ABEmail uses the browser Push API and a root-scoped service worker for background new-mail notifications.

## Vercel environment variables

Add these to the Waste2Light production environment:

- `VAPID_SUBJECT`: a contact URI such as `mailto:info@waste2light.com`
- `VAPID_PUBLIC_KEY`: public VAPID key
- `VAPID_PRIVATE_KEY`: private VAPID key

Generate a key pair locally with:

```bash
npx web-push generate-vapid-keys --json
```

Keep `VAPID_PRIVATE_KEY` secret. The public key is returned to the browser by `/api/push/vapid-public-key`.

## Runtime flow

1. The user enables Browser notifications in Settings.
2. The app requests notification permission.
3. The browser registers `/sw.js` and creates a PushSubscription.
4. The subscription is stored against the authenticated Waste2Light mailbox.
5. An `email.received` Resend webhook stores the message and sends a push to subscriptions for the addressed mailbox.
6. The service worker displays the notification even when the page is not in the foreground.
7. Clicking the notification opens ABEmail.

## Important browser behavior

Notification sound is controlled by the browser and operating system notification settings. ABEmail requests a visible notification but does not force a sound.

On iPhone/iPad, Web Push requires the site to be installed as a Home Screen web app before push can be enabled.
