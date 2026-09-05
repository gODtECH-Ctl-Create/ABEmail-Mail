import { NextResponse } from 'next/server';
import { getResend } from '@/lib/resend';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: Request) {
  try {
    const resend = getResend();
    const payload = await request.text();
    const signature = {
      id: request.headers.get('svix-id'),
      timestamp: request.headers.get('svix-timestamp'),
      signature: request.headers.get('svix-signature'),
    };

    const event = resend.webhooks.verify({
      payload,
      headers: signature,
      webhookSecret: process.env.RESEND_WEBHOOK_SECRET,
    });

    if (event.type !== 'email.received') return NextResponse.json({ received: true });

    const { data: email, error } = await resend.emails.receiving.get(event.data.email_id);
    if (error || !email) throw new Error(error?.message ?? 'Received email could not be retrieved');

    const supabase = getSupabaseAdmin();
    const { error: dbError } = await supabase.from('email_messages').upsert({
      resend_email_id: email.id,
      message_id: email.message_id ?? null,
      direction: 'inbound',
      from_address: email.from,
      to_addresses: email.to ?? [],
      cc_addresses: email.cc ?? [],
      bcc_addresses: email.bcc ?? [],
      reply_to: email.reply_to ?? [],
      subject: email.subject ?? '(no subject)',
      html_body: email.html ?? null,
      text_body: email.text ?? null,
      headers: email.headers ?? {},
      attachments: email.attachments ?? [],
      status: 'received',
      received_at: email.created_at ?? new Date().toISOString(),
    }, { onConflict: 'resend_email_id' });

    if (dbError) throw dbError;
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('resend webhook error', error);
    return NextResponse.json({ error: 'Invalid or unprocessable webhook.' }, { status: 400 });
  }
}
