import { NextResponse } from 'next/server';
import { getResend } from '@/lib/resend';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { recordIncident, recordSystemEvent, requestContext } from '@/lib/monitoring';

const normalizeAddresses = (addresses: string[] | null | undefined) =>
  (addresses ?? []).map((address) => address.trim().toLowerCase()).filter(Boolean);

const KNOWN_DELIVERY_EVENTS = new Set([
  'email.sent',
  'email.delivered',
  'email.delivery_delayed',
  'email.bounced',
  'email.complained',
  'email.suppressed',
  'email.failed',
]);

const providerStatusMap: Record<string, string> = {
  'email.sent': 'sent',
  'email.delivered': 'delivered',
  'email.delivery_delayed': 'delayed',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
  'email.suppressed': 'suppressed',
  'email.failed': 'failed',
};

function stringValue(value: unknown) {
  return typeof value === 'string' ? value.slice(0, 5000) : null;
}

function stringArrayValue(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').slice(0, 50) : [];
}

function deliveryReason(data: Record<string, unknown>) {
  const direct = stringValue(data.reason);
  if (direct) return direct;
  for (const key of ['failed', 'bounce', 'suppressed']) {
    const value = data[key];
    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      const message = stringValue(record.message) ?? stringValue(record.reason) ?? stringValue(record.type);
      if (message) return message;
    }
  }
  return null;
}

async function storeDeliveryEvent(event: { type: string; created_at?: string; data?: unknown }, svixId: string, context: ReturnType<typeof requestContext>) {
  const data = event.data && typeof event.data === 'object' ? (event.data as Record<string, unknown>) : {};
  const emailId = stringValue(data.email_id);
  const from = stringValue(data.from);
  const to = stringArrayValue(data.to).map((value) => value.trim().toLowerCase());
  const subject = stringValue(data.subject);
  const reason = deliveryReason(data);
  const eventCreatedAt = stringValue(event.created_at) ?? new Date().toISOString();
  const supabase = getSupabaseAdmin();

  const { error: eventError } = await supabase.from('resend_email_events').insert({
    svix_id: svixId,
    event_type: event.type,
    email_id: emailId,
    event_created_at: eventCreatedAt,
    from_address: from,
    to_addresses: to,
    subject,
    reason,
    metadata: {
      provider: 'resend',
      reason,
      hasSubject: Boolean(subject),
      recipientCount: to.length,
    },
  });

  if (eventError) {
    if (eventError.code === '23505') {
      await recordSystemEvent({ eventType: 'resend.webhook.duplicate', severity: 'info', component: 'resend.webhook', action: 'delivery', message: 'Duplicate webhook ignored', ...context, route: '/api/webhooks/resend', httpStatus: 200, provider: 'resend', providerEventId: svixId, metadata: { eventType: event.type, emailId } });
      return;
    }
    throw eventError;
  }

  const providerStatus = providerStatusMap[event.type] ?? event.type;
  if (emailId) {
    const { error: updateError } = await supabase
      .from('email_messages')
      .update({
        provider_status: providerStatus,
        provider_status_at: eventCreatedAt,
        provider_error: reason,
        provider_event_id: svixId,
      })
      .eq('resend_email_id', emailId);
    if (updateError) throw updateError;
  }

  const severity = event.type === 'email.delivery_delayed' ? 'warning' : (['email.bounced', 'email.failed', 'email.complained', 'email.suppressed'].includes(event.type) ? 'error' : 'info');
  await recordSystemEvent({ eventType: event.type, severity, component: 'resend.delivery', action: providerStatus, message: reason ?? `Resend ${event.type} event recorded`, mailbox: from?.match(/@waste2light\.com$/i) ? from : (to[0]?.match(/@waste2light\.com$/i) ? to[0] : null), ...context, route: '/api/webhooks/resend', httpStatus: 200, provider: 'resend', providerEventId: emailId ?? svixId, metadata: { svixId, emailId, recipientCount: to.length } });
}

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

    if (event.type === 'email.received') {
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
    }

    if (KNOWN_DELIVERY_EVENTS.has(event.type)) {
      await storeDeliveryEvent(event, id, context);
      return NextResponse.json({ received: true });
    }

    await recordSystemEvent({ eventType: 'resend.webhook.ignored', severity: 'info', component: 'resend', action: 'webhook', message: `Ignored event type ${event.type}`, ...context, route: '/api/webhooks/resend', httpStatus: 200, provider: 'resend', providerEventId: id });
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('resend webhook error', error);
    const message = error instanceof Error ? error.message : 'Unknown inbound webhook error';
    await recordSystemEvent({ eventType: 'email.receive.error', severity: 'error', component: 'resend.webhook', action: 'receive', message, ...context, route: '/api/webhooks/resend', httpStatus: 400, provider: 'resend', providerEventId });
    await recordIncident({ incidentKey: 'email.receive.error', title: 'Inbound email processing failure', severity: 'P2', component: 'resend.webhook', summary: 'The inbound Resend webhook could not be verified, retrieved or persisted.', eventType: 'email.receive.error', message, requestId: context.requestId, deploymentId: context.deploymentId, providerEventId, metadata: { provider: 'resend' } });
    return NextResponse.json({ error: 'Invalid or unprocessable webhook.' }, { status: 400 });
  }
}
