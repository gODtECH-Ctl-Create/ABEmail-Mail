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

function safeHtml(value: unknown) {
  if (typeof value !== 'string') return '';
  return value.slice(0, MAX_HTML)
    .replace(/<\/?(script|style|iframe|object|embed|form|svg|math)[^>]*>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*')/gi, '')
    .replace(/\s(href|src)\s*=\s*("\s*javascript:[^"]*"|'\s*javascript:[^']*')/gi, '')
    .trim();
}

function plainText(value: unknown, html: string) {
  const supplied = clean(value, MAX_TEXT);
  if (supplied) return supplied;
  return html
    .replace(/<br\s*\/?>(\s*)/gi, '\n')
    .replace(/<\/(p|div)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n')
    .trim()
    .slice(0, MAX_TEXT);
}

async function currentUser() {
  const auth = await getSupabaseServer();
  const { data: { user } } = await auth.auth.getUser();
  return { user, email: user?.email?.toLowerCase() ?? '' };
}

async function clearOtherDefaults(userId: string, mailbox: string, exceptId?: string) {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from('email_signatures')
    .update({ is_default: false, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('mailbox_address', mailbox)
    .eq('is_default', true);
  if (exceptId) query = query.neq('id', exceptId);
  const { error } = await query;
  if (error) throw error;
}

function validate(name: string, mailbox: string, html: string, text: string) {
  if (!name) return 'Signature name is required.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mailbox)) return 'A valid mailbox address is required.';
  if (!html && !text) return 'Add signature content before saving.';
  return null;
}

export async function GET() {
  try {
    const { user, email } = await currentUser();
    if (!user?.id || !email) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    const { data, error } = await getSupabaseAdmin()
      .from('email_signatures')
      .select('id,mailbox_address,name,html_body,text_body,enabled,is_default,created_at,updated_at')
      .eq('user_id', user.id)
      .eq('mailbox_address', email)
      .order('is_default', { ascending: false })
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ mailbox: email, signatures: data ?? [] });
  } catch (error) {
    console.error('signatures GET error', error);
    return NextResponse.json({ error: 'Unable to load signatures.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user, email } = await currentUser();
    if (!user?.id || !email) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    const body = await request.json();
    const name = clean(body.name, MAX_NAME);
    const mailbox = clean(body.mailbox_address ?? email, MAX_MAILBOX).toLowerCase();
    if (mailbox !== email) return NextResponse.json({ error: 'You can only manage your own mailbox signature.' }, { status: 403 });
    const html = safeHtml(body.html_body);
    const text = plainText(body.text_body, html);
    const enabled = body.enabled !== false;
    const isDefault = body.is_default === true;
    const validation = validate(name, mailbox, html, text);
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
    const { user, email } = await currentUser();
    if (!user?.id || !email) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    const body = await request.json();
    const id = typeof body.id === 'string' ? body.id : '';
    if (!id) return NextResponse.json({ error: 'Signature ID is required.' }, { status: 400 });
    const supabase = getSupabaseAdmin();
    const { data: existing, error: existingError } = await supabase
      .from('email_signatures')
      .select('id,mailbox_address,name,html_body,text_body,enabled,is_default')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (existingError) throw existingError;
    if (!existing) return NextResponse.json({ error: 'Signature not found.' }, { status: 404 });
    if (existing.mailbox_address !== email) return NextResponse.json({ error: 'You can only manage your own mailbox signature.' }, { status: 403 });
    const name = 'name' in body ? clean(body.name, MAX_NAME) : existing.name;
    const html = 'html_body' in body ? safeHtml(body.html_body) : existing.html_body;
    const text = 'text_body' in body || 'html_body' in body ? plainText(body.text_body, html) : existing.text_body;
    const enabled = 'enabled' in body ? body.enabled !== false : existing.enabled;
    const isDefault = 'is_default' in body ? body.is_default === true : existing.is_default;
    const validation = validate(name, email, html, text);
    if (validation) return NextResponse.json({ error: validation }, { status: 400 });
    if (isDefault) await clearOtherDefaults(user.id, email, id);
    const { data, error } = await supabase
      .from('email_signatures')
      .update({ name, mailbox_address: email, html_body: html, text_body: text, enabled, is_default: isDefault, updated_at: new Date().toISOString() })
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
