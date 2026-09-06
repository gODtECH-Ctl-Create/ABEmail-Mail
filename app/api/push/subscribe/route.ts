import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const MAIL_DOMAIN = 'waste2light.com';

type PushSubscriptionPayload = {
  endpoint?: unknown;
  expirationTime?: unknown;
  keys?: {
    p256dh?: unknown;
    auth?: unknown;
  };
};

async function getUser() {
  const authClient = await getSupabaseServer();
  const { data: { user } } = await authClient.auth.getUser();
  const email = user?.email?.toLowerCase();

  if (!user?.id || !email) {
    return { error: NextResponse.json({ error: 'Authentication required.' }, { status: 401 }) };
  }

  if (!email.endsWith(`@${MAIL_DOMAIN}`)) {
    return { error: NextResponse.json({ error: 'Your account is not configured as a Waste2Light mailbox.' }, { status: 403 }) };
  }

  return { user, email };
}

export async function POST(request: Request) {
  try {
    const auth = await getUser();
    if ('error' in auth) return auth.error;

    const payload = await request.json() as PushSubscriptionPayload;
    const endpoint = typeof payload.endpoint === 'string' ? payload.endpoint.trim() : '';
    const p256dh = typeof payload.keys?.p256dh === 'string' ? payload.keys.p256dh.trim() : '';
    const authKey = typeof payload.keys?.auth === 'string' ? payload.keys.auth.trim() : '';

    if (!endpoint || !p256dh || !authKey) {
      return NextResponse.json({ error: 'Invalid push subscription.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('push_subscriptions').upsert({
      user_id: auth.user.id,
      mailbox_address: auth.email,
      endpoint,
      p256dh,
      auth: authKey,
      user_agent: request.headers.get('user-agent'),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'endpoint' });

    if (error) throw error;
    return NextResponse.json({ saved: true });
  } catch (error) {
    console.error('push subscription error', error);
    return NextResponse.json({ error: 'Unable to save push subscription.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await getUser();
    if ('error' in auth) return auth.error;

    const payload = await request.json() as { endpoint?: unknown };
    const endpoint = typeof payload.endpoint === 'string' ? payload.endpoint.trim() : '';
    if (!endpoint) return NextResponse.json({ error: 'Endpoint is required.' }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', auth.user.id)
      .eq('endpoint', endpoint);

    if (error) throw error;
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error('push unsubscribe error', error);
    return NextResponse.json({ error: 'Unable to remove push subscription.' }, { status: 500 });
  }
}
