import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getSupabaseServer } from '@/lib/supabase-server';

const MAIL_DOMAIN = 'waste2light.com';

export async function GET(request: Request) {
  try {
    const authClient = await getSupabaseServer();
    const { data: { user } } = await authClient.auth.getUser();
    const userEmail = user?.email?.toLowerCase() ?? '';
    if (!user?.id || !userEmail) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    if (!userEmail.endsWith(`@${MAIL_DOMAIN}`)) return NextResponse.json({ error: 'Mailbox access is restricted.' }, { status: 403 });

    const url = new URL(request.url);
    const from = (url.searchParams.get('from') ?? '').trim().toLowerCase();
    const subject = (url.searchParams.get('subject') ?? '').trim();
    const bodySnippet = (url.searchParams.get('body') ?? '').trim().slice(0, 180);
    if (!from || !subject) return NextResponse.json({ error: 'Message details are required.' }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data: candidates, error } = await supabase
      .from('email_messages')
      .select('id,resend_email_id,direction,from_address,to_addresses,subject,text_body,attachments,created_at')
      .eq('from_address', from)
      .eq('subject', subject)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) throw error;

    const accessible = (candidates ?? []).filter((message) =>
      (message.direction === 'outbound' && message.from_address.endsWith(`@${MAIL_DOMAIN}`)) ||
      (message.direction === 'inbound' && message.to_addresses.some((address: string) => address.endsWith(`@${MAIL_DOMAIN}`))),
    );

    const selected = bodySnippet
      ? accessible.find((message) => (message.text_body ?? '').includes(bodySnippet)) ?? accessible[0]
      : accessible[0];

    if (!selected) return NextResponse.json({ error: 'Message not found.' }, { status: 404 });
    return NextResponse.json({
      messageId: selected.id,
      resendEmailId: selected.resend_email_id,
      direction: selected.direction,
      attachments: Array.isArray(selected.attachments) ? selected.attachments : [],
    });
  } catch (error) {
    console.error('attachment resolve error', error);
    return NextResponse.json({ error: 'Unable to resolve message attachments.' }, { status: 500 });
  }
}
