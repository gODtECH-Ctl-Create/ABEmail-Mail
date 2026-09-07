import { NextResponse } from 'next/server';
import { getResend } from '@/lib/resend';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { recordIncident, recordSystemEvent, requestContext } from '@/lib/monitoring';

const normalizeAddresses = (addresses: string[] | null | undefined) =>
  (addresses ?? []).map((address) => address.trim().toLowerCase()).filter(Boolean);

export async function POST(request: Request) {
  const context = requestContext(request);
  let providerEventId: string | null = null;

  try {
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
    if (!webhookSecret) throw new Error('RESEND_WEBHOOK_SECRET is missing');

    const resend = getResend();
    const payload = await request.text();
    const id = request.headers.get('svix-id');
    const timestamp = request.headers.get('svix-timestamp');
    const signature = request.headers.get('svix-signature');
    providerEventId = id;
    if (!id || !timestamp || !signature) throw new Error('Missing webhook signature headers');

    const event = resend.webhooks.verify({
      payload,
      headers: { id, timestamp, signature },
      webhookSecret,
    });

    if (event.type !== 'email.received') {
      await recordSystemEvent({ eventType: 'resend.webhook.ignored', severity: 'info', component: 'resend', action: 'webhook', message: `Ignored event type ${event.type}`, ...context, route: '/api/webhooks/resend', httpStatus: 200, provider: 'resend', providerEventId: id });
      return NextResponse.json({ received: true });
    }

    const { data: email, error } = await resend.emails.receiving.get(event.data.email_id);
    if (error || !email) throw new Error(error?.message ?? 'Received email could not be retrieved');

    const supabase = getSupabaseAdmin();
    const recipients = normalizeAddresses(email.to);
    const { data: existing } = await supabase.from('email_messages').select('id').eq('resend_email_id', email.id).maybeSingle();
    const { error: dbError } = await supabase.from('email_messages').upsert({
      resend_email_id: email.id,
      message_id: email.message_id ?? null,
      direction: 'inbound',
      from_address: email.from.toLowerCase(),
      to_addresses: recipients,
      cc_addresses: normalizeAddresses(email.cc),
      bcc_addresses: normalizeAddresses(email.bcc),
      reply_to: normalizeAddresses(email.reply_to),
      subject: email.subject ?? '(no subject)',
      html_body: email.html ?? null,
      text_body: email.text ?? null,
      headers: email.headers ?? {},
      attachments: email.attachments ?? [],
      status: 'received',
      is_read: false,
      is_starred: false,
      is_trashed: false,
      received_at: email.created_at ?? new Date().toISOString(),
    }, { onConflict: 'resend_email_id' });

    if (dbError) throw dbError;

    await recordSystemEvent({ eventType: existing?.id ? 'email.received.duplicate' : 'email.received', severity: 'info', component: 'resend', action: 'receive', message: existing?.id ? 'Duplicate inbound webhook recorded without creating a new message' : 'Inbound email stored successfully', mailbox: recipients[0] ?? null, ...context, route: '/api/webhooks/resend', httpStatus: 200, provider: 'resend', providerEventId: email.id, metadata: { recipientCount: recipients.length, duplicate: Boolean(existing?.id) } });

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('resend webhook error', error);
    const message = error instanceof Error ? error.message : 'Unknown inbound webhook error';
    await recordSystemEvent({ eventType: 'email.receive.error', severity: 'error', component: 'resend.webhook', action: 'receive', message, ...context, route: '/api/webhooks/resend', httpStatus: 400, provider: 'resend', providerEventId });
    await recordIncident({ incidentKey: 'email.receive.error', title: 'Inbound email processing failure', severity: 'P2', component: 'resend.webhook', summary: 'The inbound Resend webhook could not be verified, retrieved or persisted.', eventType: 'email.receive.error', message, requestId: context.requestId, deploymentId: context.deploymentId, providerEventId, metadata: { provider: 'resend' } });
    return NextResponse.json({ error: 'Invalid or unprocessable webhook.' }, { status: 400 });
  }
}
