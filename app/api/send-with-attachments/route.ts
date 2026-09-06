import { NextResponse } from 'next/server';
import { getResend } from '@/lib/resend';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getSupabaseServer } from '@/lib/supabase-server';

const MAIL_DOMAIN = 'waste2light.com';
const MAX_FILES = 10;
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_TOTAL_SIZE = 35 * 1024 * 1024;
const BUCKET = 'abemail-attachments';

type AttachmentInput = {
  path?: unknown;
  filename?: unknown;
  contentType?: unknown;
  size?: unknown;
};

function cleanAddresses(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean))];
}

function safeFilename(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 180) || 'attachment';
}

export async function POST(request: Request) {
  try {
    const authClient = await getSupabaseServer();
    const { data: { user } } = await authClient.auth.getUser();
    const from = user?.email?.toLowerCase() ?? '';
    if (!user?.id || !from) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    if (!from.endsWith(`@${MAIL_DOMAIN}`)) return NextResponse.json({ error: 'Your account is not configured as a Waste2Light mailbox.' }, { status: 403 });

    const body = await request.json();
    const to = cleanAddresses(body.to);
    const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
    const html = typeof body.html === 'string' ? body.html : '';
    const attachments = Array.isArray(body.attachments) ? body.attachments as AttachmentInput[] : [];

    if (!to.length || !subject || !html) return NextResponse.json({ error: 'To, subject and message are required.' }, { status: 400 });
    if (attachments.length < 1 || attachments.length > MAX_FILES) return NextResponse.json({ error: `Attach between 1 and ${MAX_FILES} files.` }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const prepared: Array<{ filename: string; content: string; contentType: string; size: number; path: string }> = [];
    let totalSize = 0;

    for (const item of attachments) {
      const path = typeof item.path === 'string' ? item.path.trim() : '';
      const filename = safeFilename(typeof item.filename === 'string' ? item.filename : 'attachment');
      const contentType = typeof item.contentType === 'string' && item.contentType ? item.contentType : 'application/octet-stream';
      const declaredSize = typeof item.size === 'number' && Number.isFinite(item.size) ? item.size : 0;

      if (!path || !path.startsWith(`${user.id}/`)) return NextResponse.json({ error: 'Invalid attachment reference.' }, { status: 400 });
      if (declaredSize > MAX_FILE_SIZE) return NextResponse.json({ error: `${filename} exceeds the 20 MB file limit.` }, { status: 413 });

      const { data: file, error: downloadError } = await supabase.storage.from(BUCKET).download(path);
      if (downloadError || !file) return NextResponse.json({ error: `Unable to read ${filename}.` }, { status: 400 });

      const buffer = Buffer.from(await file.arrayBuffer());
      const size = buffer.byteLength;
      if (size > MAX_FILE_SIZE) return NextResponse.json({ error: `${filename} exceeds the 20 MB file limit.` }, { status: 413 });
      totalSize += size;
      if (totalSize > MAX_TOTAL_SIZE) return NextResponse.json({ error: 'Combined attachments exceed the 35 MB limit.' }, { status: 413 });

      prepared.push({ filename, content: buffer.toString('base64'), contentType, size, path });
    }

    const resend = getResend();
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      html,
      attachments: prepared.map((attachment) => ({ filename: attachment.filename, content: attachment.content })),
    });

    if (error || !data?.id) return NextResponse.json({ error: error?.message ?? 'Resend rejected the message.' }, { status: 502 });

    const attachmentMetadata = prepared.map(({ filename, contentType, size, path }) => ({
      id: path,
      filename,
      content_type: contentType,
      size,
      storage_path: path,
      content_disposition: 'attachment',
    }));

    const { error: insertError } = await supabase.from('email_messages').insert({
      resend_email_id: data.id,
      direction: 'outbound',
      from_address: from,
      to_addresses: to,
      subject,
      html_body: html,
      status: 'sent',
      attachments: attachmentMetadata,
      created_by: user.id,
      is_read: true,
      is_starred: false,
      is_trashed: false,
    });

    if (insertError) console.error('failed to save sent message with attachments', insertError);

    return NextResponse.json({ id: data.id, attachments: attachmentMetadata });
  } catch (error) {
    console.error('send with attachments error', error);
    return NextResponse.json({ error: 'Unable to send message with attachments.' }, { status: 500 });
  }
}
