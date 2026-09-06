import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const MAIL_DOMAIN = 'waste2light.com';
const MAILBOX_SELECT = 'id,address,display_name,active';
const MESSAGE_SELECT = 'id,resend_email_id,direction,from_address,to_addresses,subject,html_body,text_body,status,created_at,received_at,message_id,attachments';
const VIEWS = new Set(['primary', 'all', 'my-sent', 'all-sent']);

export async function GET(request: Request) {
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

    const url = new URL(request.url);
    const requestedView = url.searchParams.get('view') ?? 'primary';
    const view = VIEWS.has(requestedView) ? requestedView : 'primary';
    const requestedMailbox = url.searchParams.get('mailbox')?.toLowerCase() ?? '';

    const supabase = getSupabaseAdmin();
    const { data: mailboxData, error: mailboxError } = await supabase
      .from('mailboxes')
      .select(MAILBOX_SELECT)
      .eq('active', true)
      .ilike('address', `%@${MAIL_DOMAIN}`)
      .order('address', { ascending: true });

    if (mailboxError) throw mailboxError;

    const mailboxes = mailboxData ?? [];
    const knownMailbox = requestedMailbox
      ? mailboxes.find((mailbox) => mailbox.address.toLowerCase() === requestedMailbox)
      : null;
    const mailboxFilter = knownMailbox?.address.toLowerCase() ?? '';

    let query = supabase
      .from('email_messages')
      .select(MESSAGE_SELECT)
      .order('created_at', { ascending: false })
      .limit(200);

    if (view === 'primary') {
      query = query.eq('direction', 'inbound').contains('to_addresses', [userEmail]);
    } else if (view === 'all') {
      query = query.eq('direction', 'inbound');
      if (mailboxFilter) query = query.contains('to_addresses', [mailboxFilter]);
    } else if (view === 'my-sent') {
      query = query.eq('direction', 'outbound').eq('from_address', userEmail);
    } else {
      query = query.eq('direction', 'outbound');
      if (mailboxFilter) query = query.eq('from_address', mailboxFilter);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({
      view,
      mailboxFilter: mailboxFilter || null,
      currentMailbox: userEmail,
      mailboxes,
      messages: data ?? [],
    });
  } catch (error) {
    console.error('inbox error', error);
    return NextResponse.json({ error: 'Unable to load mailbox.' }, { status: 500 });
  }
}
