import { NextResponse } from 'next/server';
import { getMailboxFromAddress, getResend } from '@/lib/resend';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { recordIncident, recordSystemEvent } from '@/lib/monitoring';

const MAX_BATCH = 20;
const MAX_ATTEMPTS = 3;
const PROCESSING_LEASE_MINUTES = 15;
const BUCKET = 'abemail-attachments';
const MAIL_DOMAIN = 'waste2light.com';

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get('authorization') === `Bearer ${secret}`);
}

function attachmentRecord(value: unknown) {
  if (typeof value !== 'object' || value === null) return null;
  const row = value as Record<string, unknown>;
  const storagePath = typeof row.storage_path === 'string' ? row.storage_path : '';
  if (!storagePath) return null;
  return {
    storage_path: storagePath,
    filename: typeof row.filename === 'string' ? row.filename.slice(0, 180) : 'attachment',
    content_type: typeof row.content_type === 'string' ? row.content_type : 'application/octet-stream',
    size: typeof row.size === 'number' && Number.isFinite(row.size) ? row.size : 0,
  };
}

async function prepareAttachments(supabase: ReturnType<typeof getSupabaseAdmin>, value: unknown, userId: string) {
  if (!Array.isArray(value) || !value.length) return { files: [], metadata: [] };
  const files: Array<{ filename: string; content: string }> = [];
  const metadata: Array<{ id: string; filename: string; content_type: string; size: number; storage_path: string; content_disposition: string }> = [];

  for (const item of value) {
    const attachment = attachmentRecord(item);
    if (!attachment || !attachment.storage_path.startsWith(`${userId}/`)) throw new Error('Invalid scheduled attachment reference.');
    const { data: file, error } = await supabase.storage.from(BUCKET).download(attachment.storage_path);
    if (error || !file) throw new Error(`Unable to read scheduled attachment ${attachment.filename}.`);
    const buffer = Buffer.from(await file.arrayBuffer());
    files.push({ filename: attachment.filename, content: buffer.toString('base64') });
    metadata.push({ id: attachment.storage_path, filename: attachment.filename, content_type: attachment.content_type, size: buffer.byteLength, storage_path: attachment.storage_path, content_disposition: 'attachment' });
  }

  return { files, metadata };
}

async function processOne(job: Record<string, unknown>) {
  const id = String(job.id);
  const userId = String(job.user_id);
  const from = String(job.from_address).toLowerCase();
  const to = Array.isArray(job.to_addresses) ? job.to_addresses.filter((item): item is string => typeof item === 'string') : [];
  const cc = Array.isArray(job.cc_addresses) ? job.cc_addresses.filter((item): item is string => typeof item === 'string') : [];
  const bcc = Array.isArray(job.bcc_addresses) ? job.bcc_addresses.filter((item): item is string => typeof item === 'string') : [];
  const replyTo = Array.isArray(job.reply_to) ? job.reply_to.filter((item): item is string => typeof item === 'string') : [];
  const subject = String(job.subject || '(no subject)');
  const html = String(job.html_body || '');
  const text = String(job.text_body || '');
  const supabase = getSupabaseAdmin();
  const resend = getResend();

  if (!from.endsWith(`@${MAIL_DOMAIN}`) || !to.length || !subject || !html) throw new Error('Scheduled message data is invalid.');

  const prepared = await prepareAttachments(supabase, job.attachments, userId);
  const payload = {
    from: getMailboxFromAddress(from),
    to,
    cc: cc.length ? cc : undefined,
    bcc: bcc.length ? bcc : undefined,
    replyTo: replyTo.length ? replyTo : undefined,
    subject,
    html,
    text: text || undefined,
    attachments: prepared.files.length ? prepared.files : undefined,
  };

  const { data, error } = await resend.emails.send(payload, { idempotencyKey: `scheduled/${id}` });
  if (error || !data?.id) throw new Error(error?.message ?? 'Resend rejected the scheduled message.');

  const { error: messageError } = await supabase.from('email_messages').insert({
    resend_email_id: data.id,
    direction: 'outbound',
    from_address: from,
    to_addresses: to,
    cc_addresses: cc,
    bcc_addresses: bcc,
    reply_to: replyTo,
    subject,
    html_body: html,
    text_body: text,
    attachments: prepared.metadata,
    status: 'sent',
    created_by: userId,
    is_read: true,
    is_starred: false,
    is_trashed: false,
    is_spam: false,
  });
  if (messageError) console.error('scheduled sent message persistence failed', messageError);

  await supabase.from('scheduled_messages').update({
    status: 'sent',
    provider_message_id: data.id,
    sent_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_error: null,
  }).eq('id', id).eq('status', 'processing');

  await recordSystemEvent({
    eventType: 'email.scheduled.sent',
    severity: 'info',
    component: 'scheduled.email',
    action: 'send',
    message: 'Scheduled email accepted by provider',
    userId,
    mailbox: from,
    route: '/api/cron/scheduled',
    httpStatus: 200,
    provider: 'resend',
    providerEventId: data.id,
    metadata: { scheduledMessageId: id, recipientCount: to.length + cc.length + bcc.length },
  });
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return new Response('Unauthorized', { status: 401 });

  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const staleBefore = new Date(Date.now() - PROCESSING_LEASE_MINUTES * 60 * 1000).toISOString();

  // A serverless invocation can stop after claiming a row but before it updates
  // the final state. Return abandoned claims to the queue. Resend's stable
  // idempotency key prevents the same scheduled row from being submitted twice
  // when a prior provider request already succeeded.
  const { error: recoveryError } = await supabase
    .from('scheduled_messages')
    .update({ status: 'pending', updated_at: now, last_error: 'Recovered after an interrupted scheduler run.' })
    .eq('status', 'processing')
    .lt('updated_at', staleBefore);

  if (recoveryError) {
    return NextResponse.json({ ok: false, error: 'Unable to recover interrupted scheduled messages.' }, { status: 500 });
  }

  const { data: candidates, error } = await supabase
    .from('scheduled_messages')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_at', now)
    .order('scheduled_at', { ascending: true })
    .limit(MAX_BATCH);

  if (error) return NextResponse.json({ ok: false, error: 'Unable to load scheduled messages.' }, { status: 500 });

  let processed = 0;
  let skipped = 0;
  let failed = 0;

  for (const candidate of candidates ?? []) {
    const { data: claimed, error: claimError } = await supabase
      .from('scheduled_messages')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', candidate.id)
      .eq('status', 'pending')
      .select('*')
      .maybeSingle();

    if (claimError) {
      failed += 1;
      continue;
    }
    if (!claimed) {
      skipped += 1;
      continue;
    }

    try {
      await processOne(claimed);
      processed += 1;
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : 'Unknown scheduled send error';
      const nextAttempts = Number(claimed.attempts ?? 0) + 1;
      const terminal = nextAttempts >= MAX_ATTEMPTS;

      await supabase.from('scheduled_messages').update({
        status: terminal ? 'failed' : 'pending',
        attempts: nextAttempts,
        last_error: message.slice(0, 1000),
        updated_at: new Date().toISOString(),
      }).eq('id', claimed.id).eq('status', 'processing');

      await recordSystemEvent({
        eventType: 'email.scheduled.failed',
        severity: terminal ? 'error' : 'warning',
        component: 'scheduled.email',
        action: 'send',
        message,
        userId: String(claimed.user_id),
        mailbox: String(claimed.from_address),
        route: '/api/cron/scheduled',
        httpStatus: 502,
        provider: 'resend',
        metadata: { scheduledMessageId: claimed.id, attempts: nextAttempts, terminal },
      });
      if (terminal) {
        await recordIncident({
          incidentKey: 'email.scheduled.failed',
          title: 'Scheduled email permanently failed',
          severity: 'P2',
          component: 'scheduled.email',
          summary: 'A scheduled email reached the maximum retry count.',
          eventType: 'email.scheduled.failed',
          message,
          metadata: { scheduledMessageId: claimed.id, attempts: nextAttempts, mailbox: claimed.from_address },
        });
      }
    }
  }

  return NextResponse.json({ ok: failed === 0, processed, skipped, failed, checkedAt: new Date().toISOString() }, { status: failed ? 207 : 200 });
}
