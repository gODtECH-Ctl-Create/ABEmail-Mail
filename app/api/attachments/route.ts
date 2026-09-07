import { NextResponse } from 'next/server';
import { getResend } from '@/lib/resend';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getSupabaseServer } from '@/lib/supabase-server';

const MAIL_DOMAIN = 'waste2light.com';
const BUCKET = 'abemail-attachments';

function isAllowedMessage(message: { direction: string; from_address: string; to_addresses: string[] }, userEmail: string) {
  if (message.direction === 'outbound') return message.from_address.toLowerCase().endsWith(`@${MAIL_DOMAIN}`);
  return message.to_addresses.some((address) => address.toLowerCase() === userEmail || address.toLowerCase().endsWith(`@${MAIL_DOMAIN}`));
}

export async function GET(request: Request) {
  try {
    const authClient = await getSupabaseServer();
    const { data: { user } } = await authClient.auth.getUser();
    const userEmail = user?.email?.toLowerCase() ?? '';
    if (!user?.id || !userEmail) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    if (!userEmail.endsWith(`@${MAIL_DOMAIN}`)) return NextResponse.json({ error: 'Mailbox access is restricted.' }, { status: 403 });

    const url = new URL(request.url);
    const messageId = url.searchParams.get('messageId') ?? '';
    const attachmentId = url.searchParams.get('attachmentId') ?? '';
    if (!messageId || !attachmentId) return NextResponse.json({ error: 'Message and attachment are required.' }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data: message, error: messageError } = await supabase
      .from('email_messages')
      .select('id,resend_email_id,direction,from_address,to_addresses,attachments')
      .eq('id', messageId)
      .maybeSingle();
    if (messageError) throw messageError;
    if (!message || !isAllowedMessage(message, userEmail)) return NextResponse.json({ error: 'Attachment not found.' }, { status: 404 });

    if (message.direction === 'outbound') {
      const attachment = Array.isArray(message.attachments)
        ? message.attachments.find((item: { id?: unknown; storage_path?: unknown }) => item?.id === attachmentId || item?.storage_path === attachmentId)
        : null;
      const storagePath = typeof attachment?.storage_path === 'string' ? attachment.storage_path : '';
      if (!storagePath) return NextResponse.json({ error: 'Attachment source unavailable.' }, { status: 404 });

      const { data: signed, error: signedError } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 300);
      if (signedError || !signed?.signedUrl) return NextResponse.json({ error: 'Unable to prepare attachment.' }, { status: 500 });
      return NextResponse.redirect(signed.signedUrl);
    }

    if (!message.resend_email_id) return NextResponse.json({ error: 'Attachment source unavailable.' }, { status: 404 });
    const resend = getResend();
    const { data: attachmentResponse, error: attachmentError } = await resend.emails.receiving.attachments.list({ emailId: message.resend_email_id });
    if (attachmentError) throw attachmentError;
    const attachmentList = Array.isArray(attachmentResponse) ? attachmentResponse : attachmentResponse.data;
    const attachment = attachmentList.find((item: { id?: string }) => item.id === attachmentId);
    if (!attachment) return NextResponse.json({ error: 'Attachment not found.' }, { status: 404 });
    if (!attachment.download_url) return NextResponse.json({ error: 'Attachment download is unavailable.' }, { status: 404 });
    return NextResponse.redirect(attachment.download_url);
  } catch (error) {
    console.error('attachment route error', error);
    return NextResponse.json({ error: 'Unable to access attachment.' }, { status: 500 });
  }
}
