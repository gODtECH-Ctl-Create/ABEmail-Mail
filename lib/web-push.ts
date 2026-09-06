import webpush from 'web-push';

let configured = false;

export function getWebPush() {
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!subject || !publicKey || !privateKey) {
    throw new Error('VAPID configuration is missing.');
  }

  if (!configured) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
  }

  return webpush;
}

export function getVapidPublicKey() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  if (!publicKey) throw new Error('VAPID_PUBLIC_KEY is missing.');
  return publicKey;
}
