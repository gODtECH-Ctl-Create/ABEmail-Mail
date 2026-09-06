'use client';

type StoredSubscription = PushSubscriptionJSON;

function urlBase64ToUint8Array(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let index = 0; index < rawData.length; index += 1) {
    output[index] = rawData.charCodeAt(index);
  }
  return output;
}

export async function registerWebPush(): Promise<{ ok: boolean; reason?: string }> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return { ok: false, reason: 'Web Push is not supported in this browser.' };
  }

  try {
    const response = await fetch('/api/push/vapid-public-key', { cache: 'no-store' });
    if (!response.ok) return { ok: false, reason: 'Web Push is not configured on the server.' };
    const { publicKey } = await response.json() as { publicKey?: string };
    if (!publicKey) return { ok: false, reason: 'Web Push public key is unavailable.' };

    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    const existing = await registration.pushManager.getSubscription();
    const subscription = existing ?? await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    const saveResponse = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(subscription.toJSON() as StoredSubscription),
    });

    if (!saveResponse.ok) return { ok: false, reason: 'The device subscription could not be saved.' };
    return { ok: true };
  } catch (error) {
    console.error('web push registration error', error);
    return { ok: false, reason: 'Web Push could not be enabled on this device.' };
  }
}

export async function unregisterWebPush(): Promise<{ ok: boolean }> {
  if (!('serviceWorker' in navigator)) return { ok: true };

  try {
    const registration = await navigator.serviceWorker.getRegistration('/');
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return { ok: true };

    await fetch('/api/push/subscribe', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });

    await subscription.unsubscribe();
    return { ok: true };
  } catch (error) {
    console.error('web push unregistration error', error);
    return { ok: false };
  }
}

export async function hasWebPushSubscription() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  try {
    const registration = await navigator.serviceWorker.getRegistration('/');
    return Boolean(await registration?.pushManager.getSubscription());
  } catch {
    return false;
  }
}
