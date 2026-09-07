import { NextResponse } from 'next/server';
import { getResend } from '@/lib/resend';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getSupabaseServer } from '@/lib/supabase-server';

const MAIL_DOMAIN = 'waste2light.com';

function normalizeAddresses(value: unknown) {
  const values = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[\n,;]+/) : [];
  return [...new Set(values.map((item) => String(item).trim().toLowerCase()).filter(Boolean))];
}

export async function POST(request: Request) {
  try {
    const authClient = await getSupabaseServer();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user?.id || !user.email) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const from = user.email.toLowerCase();
    if (!from.endsWith(`@${MAIL_DOMAIN}`)) {
      return NextResponse.json({ error: 'Your account is not configured as a Waste2Light mailbox.' }, { status: 403 });
    }

    const body = await request.json();
    const to = normalizeAddresses(body.to);
    const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
    const html = typeof body.html === 'string' ? body.html : '';
    const text = typeof body.text === 'string' ? body.text : '';
    const replyTo = typeof body.replyTo === 'string' ? body.replyTo.trim().toLowerCase() : undefined;

    if (!to.length || !subject || !html) {
      return NextResponse.json({ error: 'At least one recipient, subject and message are required.' }, { status: 400 });
    }

    const resend = getResend();
    const { data: sent, error: sendError } = await resend.emails.send({
      from,
      to,
      replyTo: replyTo ? [replyTo] : undefined,
      subject,
      html,
    });

    if (sendError || !sent?.id) {
      return NextResponse.json({ error: sendError?.message ?? 'Resend rejected the message.' }, { status: 502 });
    }

    const supabase = getSupabaseAdmin();
    const { error: insertError } = await supabase.from('email_messages').insert({
      resend_email_id: sent.id,
      direction: 'outbound',
      from_address: from,
      to_addresses: to,
      subject,
      html_body: html,
      text_body: text || null,
      status: 'sent',
      created_by: user.id,
      is_read: true,
      is_starred: false,
      is_trashed: false,
    });

    if (insertError) console.error('failed to save multi-recipient sent message', insertError);

    return NextResponse.json({ id: sent.id, to });
  } catch (error) {
    console.error('send-many error', error);
    return NextResponse.json({ error: 'Unable to send message.' }, { status: 500 });
  }
}
