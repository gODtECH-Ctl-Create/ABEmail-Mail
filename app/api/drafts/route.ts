import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getSupabaseServer } from '@/lib/supabase-server';

const MAIL_DOMAIN = 'waste2light.com';
const DRAFT_SELECT = 'id,user_id,from_address,to_addresses,cc_addresses,bcc_addresses,subject,html_body,text_body,attachments,created_at,updated_at';

async function getAuthenticatedUser() {
  const authClient = await getSupabaseServer();
  const { data: { user } } = await authClient.auth.getUser();
  const email = user?.email?.toLowerCase();
  if (!user?.id || !email || !email.endsWith(`@${MAIL_DOMAIN}`)) return null;
  return { user, email };
}

function cleanAddresses(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean))];
}

function cleanAttachments(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => ({
      id: typeof item.id === 'string' ? item.id : '',
      filename: typeof item.filename === 'string' ? item.filename : 'Attachment',
      content_type: typeof item.content_type === 'string' ? item.content_type : 'application/octet-stream',
      size: typeof item.size === 'number' && Number.isFinite(item.size) ? item.size : 0,
      storage_path: typeof item.storage_path === 'string' ? item.storage_path : '',
    }))
    .filter((item) => item.id && item.storage_path);
}

function sameDraft(a: Record<string, unknown>, b: Record<string, unknown>) {
  return JSON.stringify({
    to_addresses: a.to_addresses ?? [],
    cc_addresses: a.cc_addresses ?? [],
    bcc_addresses: a.bcc_addresses ?? [],
    subject: a.subject ?? '',
    html_body: a.html_body ?? '',
    text_body: a.text_body ?? '',
    attachments: a.attachments ?? [],
  }) === JSON.stringify({
    to_addresses: b.to_addresses ?? [],
    cc_addresses: b.cc_addresses ?? [],
    bcc_addresses: b.bcc_addresses ?? [],
    subject: b.subject ?? '',
    html_body: b.html_body ?? '',
    text_body: b.text_body ?? '',
    attachments: b.attachments ?? [],
  });
}

export async function GET() {
  try {
    const auth = await getAuthenticatedUser();
    if (!auth) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('email_drafts')
      .select(DRAFT_SELECT)
      .eq('user_id', auth.user.id)
      .order('updated_at', { ascending: false })
      .limit(200);

    if (error) throw error;
    return NextResponse.json({ drafts: data ?? [], currentMailbox: auth.email });
  } catch (error) {
    console.error('draft list error', error);
    return NextResponse.json({ error: 'Unable to load drafts.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthenticatedUser();
    if (!auth) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const body = await request.json();
    const payload = {
      user_id: auth.user.id,
      from_address: auth.email,
      to_addresses: cleanAddresses(body.to_addresses),
      cc_addresses: cleanAddresses(body.cc_addresses),
      bcc_addresses: cleanAddresses(body.bcc_addresses),
      subject: typeof body.subject === 'string' ? body.subject : '',
      html_body: typeof body.html_body === 'string' ? body.html_body : '',
      text_body: typeof body.text_body === 'string' ? body.text_body : '',
      attachments: cleanAttachments(body.attachments),
    };

    const supabase = getSupabaseAdmin();
    const { data: recentDrafts, error: recentError } = await supabase
      .from('email_drafts')
      .select(DRAFT_SELECT)
      .eq('user_id', auth.user.id)
      .order('updated_at', { ascending: false })
      .limit(5);
    if (recentError) throw recentError;

    const now = Date.now();
    const duplicate = (recentDrafts ?? []).find((draft) => {
      const updatedAt = new Date(draft.updated_at).getTime();
      return Number.isFinite(updatedAt) && now - updatedAt < 10000 && sameDraft(draft as Record<string, unknown>, payload as Record<string, unknown>);
    });

    if (duplicate) return NextResponse.json({ draft: duplicate, deduplicated: true });

    const { data, error } = await supabase
      .from('email_drafts')
      .insert(payload)
      .select(DRAFT_SELECT)
      .single();

    if (error) throw error;
    return NextResponse.json({ draft: data });
  } catch (error) {
    console.error('draft create error', error);
    return NextResponse.json({ error: 'Unable to save draft.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await getAuthenticatedUser();
    if (!auth) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const body = await request.json();
    const id = typeof body.id === 'string' ? body.id : '';
    if (!id) return NextResponse.json({ error: 'Draft id is required.' }, { status: 400 });

    const payload = {
      to_addresses: cleanAddresses(body.to_addresses),
      cc_addresses: cleanAddresses(body.cc_addresses),
      bcc_addresses: cleanAddresses(body.bcc_addresses),
      subject: typeof body.subject === 'string' ? body.subject : '',
      html_body: typeof body.html_body === 'string' ? body.html_body : '',
      text_body: typeof body.text_body === 'string' ? body.text_body : '',
      attachments: cleanAttachments(body.attachments),
      updated_at: new Date().toISOString(),
    };

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('email_drafts')
      .update(payload)
      .eq('id', id)
      .eq('user_id', auth.user.id)
      .select(DRAFT_SELECT)
      .single();

    if (error) throw error;
    return NextResponse.json({ draft: data });
  } catch (error) {
    console.error('draft update error', error);
    return NextResponse.json({ error: 'Unable to update draft.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await getAuthenticatedUser();
    if (!auth) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const url = new URL(request.url);
    const id = url.searchParams.get('id') ?? '';
    if (!id) return NextResponse.json({ error: 'Draft id is required.' }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('email_drafts')
      .delete()
      .eq('id', id)
      .eq('user_id', auth.user.id);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('draft delete error', error);
    return NextResponse.json({ error: 'Unable to delete draft.' }, { status: 500 });
  }
}
