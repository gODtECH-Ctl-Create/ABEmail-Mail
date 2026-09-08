import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getSupabaseServer } from '@/lib/supabase-server';

const MAX_NAME = 100;
const MAX_HTML = 20000;
const MAX_TEXT = 10000;
const MAX_MAILBOX = 254;

function clean(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

async function currentUser() {
  const auth = await getSupabaseServer();
  const { data: { user } } = await auth.auth.getUser();
  const email = user?.email?.toLowerCase() ?? '';
  return { user, email };
}

function isValidMailbox(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validateBody(name: string, mailbox: string, html: string, text: string) {
  if (!name) return 'Signature name is required.';
  if (!mailbox || !isValidMailbox(mailbox)) return 'A valid mailbox address is required.';
  if (!html && !text) return 'Add signature content before saving.';
  if (html.length > MAX_HTML) return 'HTML signature is too large.';
  if (text.length > MAX_TEXT) return 'Plain-text signature is too large.';
  return null;
}

async function clearOtherDefaults(userId: string, mailbox: string, exceptId?: string) {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from('email_signatures')
    .update({ is_default: false, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('mailbox_address', mailbox.toLowerCase())
    .eq('is_default', true);
  if (exceptId) query = query.neq('id', exceptId);
  const { error } = await query;
  if (error) throw error;
}

export async function GET() {
  try {
    const { user } = await currentUser();
    if (!user?.id) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    const { data, error } = await getSupabaseAdmin()
      .from('email_signatures')
      .select('id,mailbox_address,name,html_body,text_body,enabled,is_default,created_at,updated_at')
      .eq('user_id', user.id)
      .order('mailbox_address', { ascending: true })
      .order('is_default', { ascending: false })
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ signatures: data ?? [] });
  } catch (error) {
    console.error('signatures GET error', error);
    return NextResponse.json({ error: 'Unable to load signatures.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await currentUser();
    if (!user?.id) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    const body = await request.json();
    const name = clean(body.name, MAX_NAME);
    const mailbox = clean(body.mailbox_address ?? body.mailbox, MAX_MAILBOX).toLowerCase();
    const html = typeof body.html_body === 'string' ? body.html_body.slice(0, MAX_HTML) : '';
    const text = typeof body.text_body === 'string' ? body.text_body.slice(0, MAX_TEXT) : '';
    const enabled = body.enabled !== false;
    const isDefault = body.is_default === true;
    const validation = validateBody(name, mailbox, html, text);
    if (validation) return NextResponse.json({ error: validation }, { status: 400 });

    if (isDefault) await clearOtherDefaults(user.id, mailbox);
    const { data, error } = await getSupabaseAdmin()
      .from('email_signatures')
      .insert({ user_id: user.id, mailbox_address: mailbox, name, html_body: html, text_body: text, enabled, is_default: isDefault })
      .select('id,mailbox_address,name,html_body,text_body,enabled,is_default,created_at,updated_at')
      .single();
    if (error) throw error;
    return NextResponse.json({ signature: data }, { status: 201 });
  } catch (error) {
    console.error('signatures POST error', error);
    return NextResponse.json({ error: 'Unable to create signature.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { user } = await currentUser();
    if (!user?.id) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    const body = await request.json();
    const id = typeof body.id === 'string' ? body.id : '';
    if (!id) return NextResponse.json({ error: 'Signature ID is required.' }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data: existing, error: existingError } = await supabase
      .from('email_signatures')
      .select('id,mailbox_address')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (existingError) throw existingError;
    if (!existing) return NextResponse.json({ error: 'Signature not found.' }, { status: 404 });

    const mailbox = clean(body.mailbox_address ?? existing.mailbox_address, MAX_MAILBOX).toLowerCase();
    if (!isValidMailbox(mailbox)) return NextResponse.json({ error: 'A valid mailbox address is required.' }, { status: 400 });

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString(), mailbox_address: mailbox };
    if ('name' in body) updates.name = clean(body.name, MAX_NAME);
    if ('html_body' in body) updates.html_body = typeof body.html_body === 'string' ? body.html_body.slice(0, MAX_HTML) : '';
    if ('text_body' in body) updates.text_body = typeof body.text_body === 'string' ? body.text_body.slice(0, MAX_TEXT) : '';
    if ('enabled' in body) updates.enabled = body.enabled !== false;
    if ('is_default' in body) updates.is_default = body.is_default === true;

    if (updates.name === '') return NextResponse.json({ error: 'Signature name is required.' }, { status: 400 });
    if (updates.is_default === true) await clearOtherDefaults(user.id, mailbox, id);

    const { data, error } = await supabase
      .from('email_signatures')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id,mailbox_address,name,html_body,text_body,enabled,is_default,created_at,updated_at')
      .single();
    if (error) throw error;
    return NextResponse.json({ signature: data });
  } catch (error) {
    console.error('signatures PATCH error', error);
    return NextResponse.json({ error: 'Unable to update signature.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { user } = await currentUser();
    if (!user?.id) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Signature ID is required.' }, { status: 400 });
    const { data, error } = await getSupabaseAdmin()
      .from('email_signatures')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Signature not found.' }, { status: 404 });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error('signatures DELETE error', error);
    return NextResponse.json({ error: 'Unable to delete signature.' }, { status: 500 });
  }
}
