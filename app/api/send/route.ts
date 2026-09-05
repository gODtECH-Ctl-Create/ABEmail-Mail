import { NextResponse } from 'next/server';
import { getResend, getFromAddress } from '@/lib/resend';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getSupabaseServer } from '@/lib/supabase-server';

export async function POST(request: Request) {
  try {
    const authClient = await getSupabaseServer();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const body = await request.json();
    const to = typeof body.to === 'string' ? body.to.trim() : '';
    const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
    const html = typeof body.html === 'string' ? body.html : '';

    if (!to || !subject || !html) {
      return NextResponse.json({ error: 'To, subject and message are required.' }, { status: 400 });
    }

    const resend = getResend();
    const { data, error } = await resend.emails.send({
      from: getFromAddress(),
      to: [to],
      subject,
      html,
    });

    if (error || !data?.id) {
      return NextResponse.json({ error: error?.message ?? 'Resend rejected the message.' }, { status: 502 });
    }

    const supabase = getSupabaseAdmin();
    await supabase.from('email_messages').insert({
      resend_email_id: data.id,
      direction: 'outbound',
      from_address: getFromAddress(),
      to_addresses: [to],
      subject,
      html_body: html,
      status: 'sent',
      created_by: user.id,
    });

    return NextResponse.json({ id: data.id });
  } catch (error) {
    console.error('send email error', error);
    return NextResponse.json({ error: 'Unable to send message.' }, { status: 500 });
  }
}
