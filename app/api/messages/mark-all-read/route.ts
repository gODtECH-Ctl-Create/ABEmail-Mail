import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getSupabaseServer } from '@/lib/supabase-server';

const MAIL_DOMAIN = 'waste2light.com';
const SUPPORTED_VIEWS = new Set(['primary', 'all', 'starred']);

export async function POST(request: Request) {
  try {
    const authClient = await getSupabaseServer();
    const { data: { user } } = await authClient.auth.getUser();
    const userEmail = user?.email?.toLowerCase();

    if (!user?.id || !userEmail) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    if (!userEmail.endsWith(`@${MAIL_DOMAIN}`)) {
      return NextResponse.json({ error: 'Your account is not configured as a Waste2Light mailbox.' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const view = typeof body.view === 'string' ? body.view : 'primary';
    const requestedMailbox = typeof body.mailbox === 'string' ? body.mailbox.trim().toLowerCase() : '';

    if (!SUPPORTED_VIEWS.has(view)) {
      return NextResponse.json({ error: 'Mark all as read is not available in this mailbox view.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const baseFilter = supabase
      .from('email_messages')
      .update({ is_read: true })
      .eq('direction', 'inbound')
      .eq('is_read', false)
      .eq('is_trashed', false);

    let query = baseFilter;

    if (view === 'primary') {
      query = query.contains('to_addresses', [userEmail]);
    } else if (view === 'all') {
      if (requestedMailbox) {
        const { data: mailbox } = await supabase
          .from('mailboxes')
          .select('address,active')
          .eq('active', true)
          .ilike('address', requestedMailbox)
          .maybeSingle();

        if (!mailbox?.address) {
          return NextResponse.json({ error: 'Unknown mailbox filter.' }, { status: 400 });
        }

        query = query.contains('to_addresses', [mailbox.address.toLowerCase()]);
      }
    } else if (view === 'starred') {
      query = query.eq('is_starred', true);
    }

    const { data, error } = await query.select('id');
    if (error) throw error;

    return NextResponse.json({ updated: data?.length ?? 0 });
  } catch (error) {
    console.error('mark all read error', error);
    return NextResponse.json({ error: 'Unable to mark messages as read.' }, { status: 500 });
  }
}
