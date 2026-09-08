import { NextResponse } from 'next/server';
import { getResend, getMailboxFromAddress } from '@/lib/resend';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getSupabaseServer } from '@/lib/supabase-server';
import { consumeRateLimit } from '@/lib/rate-limit';

const MAIL_DOMAIN = 'waste2light.com';
const MAX_RECIPIENTS = 50;
const MAX_SUBJECT_LENGTH = 998;
const MAX_HTML_LENGTH = 1_000_000;
const MAX_TEXT_LENGTH = 500_000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeAddresses(value: unknown) {
  const values = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[\n,;]+/) : [];
  return [...new Set(values
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean))];
}

export async function POST(request: Request) {
  try {
    const authClient = await getSupabaseServer();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user?.id || !user.email) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const from = user.email.toLowerCase();
    if (!from.endsWith(`@${MAIL_DOMAIN}`)) return NextResponse.json({ error: 'Your account is not configured as a Waste2Light mailbox.' }, { status: 403 });

    const limit = await consumeRateLimit(`send-many:${user.id}`, 10, 60);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: limit.reason === 'limit' ? 'Too many multi-recipient send attempts. Please try again shortly.' : 'Sending is temporarily unavailable.' },
        { status: limit.reason === 'limit' ? 429 : 503, headers: limit.reason === 'limit' ? { 'Retry-After': '60' } : undefined },
      );
    }

    const body = await request.json();
    const to = normalizeAddresses(body.to);
    const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
    const html = typeof body.html === 'string' ? body.html : '';
    const text = typeof body.text === 'string' ? body.text : '';
    const replyTo = typeof body.replyTo === 'string' ? body.replyTo.trim().toLowerCase() : undefined;

    if (!to.length || to.length > MAX_RECIPIENTS) return NextResponse.json({ error: `Provide between 1 and ${MAX_RECIPIENTS} recipients.` }, { status: 400 });
    if (to.some((address) => !EMAIL_RE.test(address))) return NextResponse.json({ error: 'Every recipient must be a valid email address.' }, { status: 400 });
    if (!subject || subject.length > MAX_SUBJECT_LENGTH) return NextResponse.json({ error: `Subject must be between 1 and ${MAX_SUBJECT_LENGTH} characters.` }, { status: 400 });
    if (!html || html.length > MAX_HTML_LENGTH) return NextResponse.json({ error: `Message body exceeds the ${MAX_HTML_LENGTH}-byte limit.` }, { status: 400 });
    if (text.length > MAX_TEXT_LENGTH) return NextResponse.json({ error: `Plain-text body exceeds the ${MAX_TEXT_LENGTH}-byte limit.` }, { status: 400 });
    if (replyTo && !EMAIL_RE.test(replyTo)) return NextResponse.json({ error: 'Reply-To must be a valid email address.' }, { status: 400 });

    const resend = getResend();
    const { data: sent, error: sendError } = await resend.emails.send({
      from: getMailboxFromAddress(from),
      to,
      replyTo: replyTo ? [replyTo] : undefined,
      subject,
      html,
    });

    if (sendError || !sent?.id) return NextResponse.json({ error: sendError?.message ?? 'Resend rejected the message.' }, { status: 502 });

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
