import { NextResponse } from 'next/server';
import { getResend } from '@/lib/resend';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const normalizeAddresses = (addresses: string[] | null | undefined) =>
  (addresses ?? []).map((address) => address.trim().toLowerCase()).filter(Boolean);

export async function POST(request: Request) {
  try {
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
    if (!webhookSecret) throw new Error('RESEND_WEBHOOK_SECRET is missing');

    const resend = getResend();
    const payload = await request.text();
    const id = request.headers.get('svix-id');
    const timestamp = request.headers.get('svix-timestamp');
    const signature = request.headers.get('svix-signature');
    if (!id || !timestamp || !signature) throw new Error('Missing webhook signature headers');

    const event = resend.webhooks.verify({
      payload,
      headers: { id, timestamp, signature },
      webhookSecret,
    });

    if (event.type !== 'email.received') return NextResponse.json({ received: true });

    const { data: email, error } = await resend.emails.receiving.get(event.data.email_id);
    if (error || !email) throw new Error(error?.message ?? 'Received email could not be retrieved');

    const supabase = getSupabaseAdmin();
    const { error: dbError } = await supabase.from('email_messages').upsert({
      resend_email_id: email.id,
      message_id: email.message_id ?? null,
      direction: 'inbound',
      from_address: email.from.toLowerCase(),
      to_addresses: normalizeAddresses(email.to),
      cc_addresses: normalizeAddresses(email.cc),
      bcc_addresses: normalizeAddresses(email.bcc),
      reply_to: normalizeAddresses(email.reply_to),
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
