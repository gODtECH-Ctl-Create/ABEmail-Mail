import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getSupabaseServer } from '@/lib/supabase-server';
import { consumeRateLimit } from '@/lib/rate-limit';

const MAIL_DOMAIN = 'waste2light.com';
const MAX_RECIPIENTS = 20;
const MAX_DAYS_AHEAD = 90;
const MAX_SUBJECT_LENGTH = 998;
const MAX_HTML_LENGTH = 1_000_000;
const MAX_TEXT_LENGTH = 500_000;
const MAX_FILES = 10;
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_TOTAL_SIZE = 35 * 1024 * 1024;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ScheduledStatus = 'pending' | 'processing' | 'sent' | 'cancelled' | 'failed';
type ScheduledAttachment = { filename: string; content_type: string; size: number; storage_path: string };

function cleanAddresses(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean))];
}

function parseScheduledAt(value: unknown) {
  if (typeof value !== 'string') return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp) : null;
}

function normalizeAttachments(value: unknown): ScheduledAttachment[] {
  if (!Array.isArray(value) || value.length > MAX_FILES) return [];
  return value
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => ({
      filename: typeof item.filename === 'string' ? item.filename.slice(0, 180) : 'attachment',
      content_type: typeof item.contentType === 'string' ? item.contentType : typeof item.content_type === 'string' ? item.content_type : 'application/octet-stream',
      size: typeof item.size === 'number' && Number.isFinite(item.size) ? item.size : 0,
      storage_path: typeof item.storage_path === 'string' ? item.storage_path : typeof item.path === 'string' ? item.path : '',
    }));
}

function isOwnedAttachmentPath(path: string, userId: string) {
  return path.startsWith(`${userId}/`);
}

async function getCurrentUser() {
  const authClient = await getSupabaseServer();
  const { data: { user } } = await authClient.auth.getUser();
  const email = user?.email?.toLowerCase() ?? '';
  return { user, email };
}

function validateMessageContent(subject: string, html: string, text: string) {
  if (!subject || subject.length > MAX_SUBJECT_LENGTH) return `Subject must be between 1 and ${MAX_SUBJECT_LENGTH} characters.`;
  if (!html || html.length > MAX_HTML_LENGTH) return `Message body exceeds the ${MAX_HTML_LENGTH}-byte limit.`;
  if (text.length > MAX_TEXT_LENGTH) return `Plain-text body exceeds the ${MAX_TEXT_LENGTH}-byte limit.`;
  return null;
}

function validateRecipients(to: string[], cc: string[], bcc: string[]) {
  const all = [...new Set([...to, ...cc, ...bcc])];
  if (!to.length) return 'At least one recipient is required.';
  if (all.length > MAX_RECIPIENTS) return `A scheduled message can have up to ${MAX_RECIPIENTS} recipients.`;
  if (all.some((address) => !EMAIL_RE.test(address))) return 'Every recipient must be a valid email address.';
  return null;
}

function validateAttachments(attachments: ScheduledAttachment[], userId: string) {
  if (attachments.length > MAX_FILES) return `A scheduled message can have up to ${MAX_FILES} attachments.`;
  let total = 0;
  for (const attachment of attachments) {
    if (!attachment.storage_path || !isOwnedAttachmentPath(attachment.storage_path, userId)) return 'Invalid attachment reference.';
    if (attachment.size > MAX_FILE_SIZE) return `${attachment.filename} exceeds the 20 MB file limit.`;
    total += attachment.size;
  }
  if (total > MAX_TOTAL_SIZE) return 'Combined attachments exceed the 35 MB limit.';
  return null;
}

export async function GET() {
  try {
    const { user, email } = await getCurrentUser();
    if (!user?.id || !email) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    if (!email.endsWith(`@${MAIL_DOMAIN}`)) return NextResponse.json({ error: 'Your account is not configured as a Waste2Light mailbox.' }, { status: 403 });

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('scheduled_messages')
      .select('id,from_address,to_addresses,cc_addresses,bcc_addresses,subject,text_body,html_body,attachments,scheduled_at,status,provider_message_id,attempts,last_error,sent_at,created_at,updated_at')
      .eq('user_id', user.id)
      .order('scheduled_at', { ascending: true })
      .limit(100);

    if (error) throw error;
    return NextResponse.json({ scheduled: data ?? [] });
  } catch (error) {
    console.error('scheduled list error', error);
    return NextResponse.json({ error: 'Unable to load scheduled messages.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user, email } = await getCurrentUser();
    if (!user?.id || !email) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    if (!email.endsWith(`@${MAIL_DOMAIN}`)) return NextResponse.json({ error: 'Your account is not configured as a Waste2Light mailbox.' }, { status: 403 });

    const limit = await consumeRateLimit(`schedule:${user.id}`, 20, 60);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: limit.reason === 'limit' ? 'Too many schedule attempts. Please try again shortly.' : 'Scheduling is temporarily unavailable.' },
        { status: limit.reason === 'limit' ? 429 : 503, headers: limit.reason === 'limit' ? { 'Retry-After': '60' } : undefined },
      );
    }

    const body = await request.json();
    const to = cleanAddresses(body.to_addresses ?? body.to);
    const cc = cleanAddresses(body.cc_addresses ?? body.cc);
    const bcc = cleanAddresses(body.bcc_addresses ?? body.bcc);
    const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
    const html = typeof body.html_body === 'string' ? body.html_body : typeof body.html === 'string' ? body.html : '';
    const text = typeof body.text_body === 'string' ? body.text_body : '';
    const scheduledAt = parseScheduledAt(body.scheduled_at);
    const attachments = normalizeAttachments(body.attachments);

    const recipientError = validateRecipients(to, cc, bcc);
    if (recipientError) return NextResponse.json({ error: recipientError }, { status: 400 });
    const contentError = validateMessageContent(subject, html, text);
    if (contentError) return NextResponse.json({ error: contentError }, { status: 400 });
    if (!scheduledAt) return NextResponse.json({ error: 'A valid scheduled time is required.' }, { status: 400 });

    const now = Date.now();
    const scheduledTimestamp = scheduledAt.getTime();
    if (scheduledTimestamp <= now + 30_000) return NextResponse.json({ error: 'Choose a scheduled time at least 30 seconds in the future.' }, { status: 400 });
    if (scheduledTimestamp > now + MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000) return NextResponse.json({ error: `Messages can be scheduled up to ${MAX_DAYS_AHEAD} days ahead.` }, { status: 400 });

    const attachmentError = validateAttachments(attachments, user.id);
    if (attachmentError) return NextResponse.json({ error: attachmentError }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('scheduled_messages')
      .insert({ user_id: user.id, from_address: email, to_addresses: to, cc_addresses: cc, bcc_addresses: bcc, subject, html_body: html, text_body: text, attachments, scheduled_at: scheduledAt.toISOString(), status: 'pending', attempts: 0 })
      .select('id,scheduled_at,status')
      .single();

    if (error) throw error;
    return NextResponse.json({ scheduled: data }, { status: 201 });
  } catch (error) {
    console.error('scheduled create error', error);
    return NextResponse.json({ error: 'Unable to schedule this message.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { user, email } = await getCurrentUser();
    if (!user?.id || !email) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    if (!email.endsWith(`@${MAIL_DOMAIN}`)) return NextResponse.json({ error: 'Your account is not configured as a Waste2Light mailbox.' }, { status: 403 });

    const body = await request.json();
    const id = typeof body.id === 'string' ? body.id : '';
    const action = typeof body.action === 'string' ? body.action : 'update';
    if (!id) return NextResponse.json({ error: 'Scheduled message ID is required.' }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data: current, error: currentError } = await supabase.from('scheduled_messages').select('id,status').eq('id', id).eq('user_id', user.id).maybeSingle();
    if (currentError) throw currentError;
    if (!current) return NextResponse.json({ error: 'Scheduled message not found.' }, { status: 404 });

    if (action === 'cancel') {
      if (!['pending', 'failed'].includes(current.status)) return NextResponse.json({ error: 'Only pending or failed messages can be cancelled.' }, { status: 409 });
      const { data, error } = await supabase.from('scheduled_messages').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', user.id).in('status', ['pending', 'failed']).select('id,status,scheduled_at').maybeSingle();
      if (error) throw error;
      if (!data) return NextResponse.json({ error: 'Scheduled message changed before it could be cancelled.' }, { status: 409 });
      return NextResponse.json({ scheduled: data });
    }

    if (!['pending', 'failed'].includes(current.status)) return NextResponse.json({ error: 'Only pending or failed messages can be edited.' }, { status: 409 });

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString(), status: 'pending', last_error: null, attempts: 0 };
    if ('scheduled_at' in body) {
      const scheduledAt = parseScheduledAt(body.scheduled_at);
      if (!scheduledAt) return NextResponse.json({ error: 'A valid scheduled time is required.' }, { status: 400 });
      if (scheduledAt.getTime() <= Date.now() + 30_000) return NextResponse.json({ error: 'Choose a future scheduled time.' }, { status: 400 });
      if (scheduledAt.getTime() > Date.now() + MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000) return NextResponse.json({ error: `Messages can be scheduled up to ${MAX_DAYS_AHEAD} days ahead.` }, { status: 400 });
      updates.scheduled_at = scheduledAt.toISOString();
    }

    let to = [] as string[];
    let cc = [] as string[];
    let bcc = [] as string[];
    if ('to_addresses' in body || 'to' in body) {
      to = cleanAddresses(body.to_addresses ?? body.to);
      updates.to_addresses = to;
    }
    if ('cc_addresses' in body || 'cc' in body) {
      cc = cleanAddresses(body.cc_addresses ?? body.cc);
      updates.cc_addresses = cc;
    }
    if ('bcc_addresses' in body || 'bcc' in body) {
      bcc = cleanAddresses(body.bcc_addresses ?? body.bcc);
      updates.bcc_addresses = bcc;
    }
    if (to.length || cc.length || bcc.length) {
      const recipientError = validateRecipients(to, cc, bcc);
      if (recipientError) return NextResponse.json({ error: recipientError }, { status: 400 });
    }
    if ('subject' in body) {
      const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
      if (!subject || subject.length > MAX_SUBJECT_LENGTH) return NextResponse.json({ error: `Subject must be between 1 and ${MAX_SUBJECT_LENGTH} characters.` }, { status: 400 });
      updates.subject = subject;
    }
    if ('html_body' in body || 'html' in body) {
      const html = typeof body.html_body === 'string' ? body.html_body : typeof body.html === 'string' ? body.html : '';
      if (!html || html.length > MAX_HTML_LENGTH) return NextResponse.json({ error: `Message body exceeds the ${MAX_HTML_LENGTH}-byte limit.` }, { status: 400 });
      updates.html_body = html;
    }
    if ('text_body' in body) {
      const text = typeof body.text_body === 'string' ? body.text_body : '';
      if (text.length > MAX_TEXT_LENGTH) return NextResponse.json({ error: `Plain-text body exceeds the ${MAX_TEXT_LENGTH}-byte limit.` }, { status: 400 });
      updates.text_body = text;
    }
    if ('attachments' in body) {
      const attachments = normalizeAttachments(body.attachments);
      const attachmentError = validateAttachments(attachments, user.id);
      if (attachmentError) return NextResponse.json({ error: attachmentError }, { status: 400 });
      updates.attachments = attachments;
    }

    const { data, error } = await supabase.from('scheduled_messages').update(updates).eq('id', id).eq('user_id', user.id).in('status', ['pending', 'failed']).select('id,status,scheduled_at,to_addresses,subject,last_error').maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Scheduled message changed before it could be updated.' }, { status: 409 });
    return NextResponse.json({ scheduled: data });
  } catch (error) {
    console.error('scheduled update error', error);
    return NextResponse.json({ error: 'Unable to update the scheduled message.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { user, email } = await getCurrentUser();
    if (!user?.id || !email) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    if (!email.endsWith(`@${MAIL_DOMAIN}`)) return NextResponse.json({ error: 'Your account is not configured as a Waste2Light mailbox.' }, { status: 403 });

    const id = new URL(request.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Scheduled message ID is required.' }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data: current, error: currentError } = await supabase.from('scheduled_messages').select('id,status').eq('id', id).eq('user_id', user.id).maybeSingle();
    if (currentError) throw currentError;
    if (!current) return NextResponse.json({ error: 'Scheduled message not found.' }, { status: 404 });
    if (!['cancelled', 'failed'].includes(current.status)) return NextResponse.json({ error: 'Cancel the scheduled message before deleting it.' }, { status: 409 });

    const { error } = await supabase.from('scheduled_messages').delete().eq('id', id).eq('user_id', user.id);
    if (error) throw error;
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error('scheduled delete error', error);
    return NextResponse.json({ error: 'Unable to delete the scheduled message.' }, { status: 500 });
  }
}

export type { ScheduledStatus };
