# ABEmail Web Push

This branch adds standards-based Web Push notifications for Waste2Light ABEmail.

## Architecture

```text
Resend inbound webhook
        ↓
email_messages
        ↓
push_subscriptions
        ↓
Web Push service
        ↓
service worker
        ↓
user device
```

## Environment variables

Set these in the deployment environment:

```text
VAPID_SUBJECT=mailto:info@waste2light.com
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
```

Generate the VAPID key pair once with:

```bash
npx web-push generate-vapid-keys
```

Keep the private key secret and do not commit it.

## Database

Apply `supabase/migrations/006_web_push.sql` to the Waste2Light Supabase project before enabling browser notifications in production.

## Browser flow

1. The user opens Settings and enables Browser notifications.
2. The browser asks for notification permission.
3. ABEmail registers `/sw.js` and creates a `PushSubscription`.
4. The subscription is saved through `/api/push/subscribe`.
5. Resend sends an `email.received` webhook to ABEmail.
6. ABEmail saves the email and sends a push to subscriptions belonging to the recipient mailbox.
7. The service worker displays the notification and opens ABEmail when the user taps it.

## iPhone

On iPhone/iPad, Web Push requires ABEmail to be added to the Home Screen and launched as a Home Screen web app before notification permission is requested.

## Fallback

The existing in-app notification watcher remains in place. When Web Push is active it avoids creating duplicate native notifications, while the in-app toast continues to work when the mailbox is open.
