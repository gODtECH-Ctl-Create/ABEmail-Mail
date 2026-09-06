import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getWebPush } from '@/lib/web-push';

type IncomingEmailPush = {
  id: string;
  from: string;
  subject: string;
  to: string[];
};

function normalizeAddress(value: string) {
  const match = value.match(/<([^>]+)>/);
  return (match?.[1] ?? value).trim().toLowerCase();
}

export async function sendIncomingEmailPush(input: IncomingEmailPush) {
  try {
    const recipients = [...new Set(input.to.map(normalizeAddress).filter((value) => value.endsWith('@waste2light.com')))];
    if (!recipients.length) return;

    const supabase = getSupabaseAdmin();
    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('id,endpoint,p256dh,auth,mailbox_address')
      .in('mailbox_address', recipients);

    if (error) throw error;
    if (!subscriptions?.length) return;

    const webPush = getWebPush();
    const title = 'New email';
    const body = `${normalizeAddress(input.from)} · ${input.subject || '(no subject)'}`;
    const payload = JSON.stringify({
      title,
      body,
      url: '/',
      tag: `abemail-${input.id}`,
    });

    await Promise.all(subscriptions.map(async (subscription) => {
      try {
        await webPush.sendNotification({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        }, payload, { TTL: 60 });
      } catch (error) {
        const statusCode = typeof error === 'object' && error !== null && 'statusCode' in error
          ? Number(error.statusCode)
          : 0;

        if (statusCode === 404 || statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', subscription.id);
          return;
        }

        console.error('web push delivery error', error);
      }
    }));
  } catch (error) {
    console.error('incoming email push error', error);
  }
}
