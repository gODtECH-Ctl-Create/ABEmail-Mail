import { NextResponse } from 'next/server';
import { getResend } from '@/lib/resend';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getSupabaseServer } from '@/lib/supabase-server';

const MAIL_DOMAIN = 'waste2light.com';

export async function POST(request: Request) {
  try {
    const authClient = await getSupabaseServer();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user?.email) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const from = user.email.toLowerCase();
    if (!from.endsWith(`@${MAIL_DOMAIN}`)) {
      return NextResponse.json({ error: 'Your account is not configured as a Waste2Light mailbox.' }, { status: 403 });
    }

    const body = await request.json();
    const to = typeof body.to === 'string' ? body.to.trim() : '';
    const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
    const html = typeof body.html === 'string' ? body.html : '';
    const replyTo = typeof body.replyTo === 'string' ? body.replyTo.trim() : undefined;
    const draftId = typeof body.draftId === 'string' ? body.draftId : '';

    if (!to || !subject || !html) {
      return NextResponse.json({ error: 'To, subject and message are required.' }, { status: 400 });
    }

    const resend = getResend();
    const { data, error } = await resend.emails.send({
      from,
      to: [to],
      replyTo: replyTo ? [replyTo] : undefined,
      subject,
      html,
    });

    if (error || !data?.id) {
      return NextResponse.json({ error: error?.message ?? 'Resend rejected the message.' }, { status: 502 });
    }

    const supabase = getSupabaseAdmin();
    const { error: insertError } = await supabase.from('email_messages').insert({
      resend_email_id: data.id,
      direction: 'outbound',
      from_address: from,
      to_addresses: [to],
      subject,
      html_body: html,
      status: 'sent',
      created_by: user.id,
    });

    if (insertError) console.error('failed to save sent message', insertError);

    if (draftId) {
      const { error: draftDeleteError } = await supabase
        .from('email_drafts')
        .delete()
        .eq('id', draftId)
        .eq('user_id', user.id);
      if (draftDeleteError) console.error('failed to delete sent draft', draftDeleteError);
    }

    return NextResponse.json({ id: data.id });
  } catch (error) {
    console.error('send email error', error);
    return NextResponse.json({ error: 'Unable to send message.' }, { status: 500 });
  }
}
