import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getSupabaseServer } from '@/lib/supabase-server';

const MAX_NAME = 120;
const MAX_EMAIL = 254;
const MAX_COMPANY = 160;
const MAX_PHONE = 40;
const MAX_NOTES = 2000;
const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 40;

function cleanText(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function normalizeEmail(value: unknown) {
  return cleanText(value, MAX_EMAIL).toLowerCase();
}

function cleanTags(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .filter((tag): tag is string => typeof tag === 'string')
    .map((tag) => tag.trim().slice(0, MAX_TAG_LENGTH))
    .filter(Boolean))].slice(0, MAX_TAGS);
}

function validEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function getCurrentUser() {
  const authClient = await getSupabaseServer();
  const { data: { user } } = await authClient.auth.getUser();
  const email = user?.email?.toLowerCase() ?? '';
  return { user, email };
}

export async function GET(request: Request) {
  try {
    const { user, email } = await getCurrentUser();
    if (!user?.id || !email) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const query = new URL(request.url).searchParams.get('q')?.trim().slice(0, 120) ?? '';
    const supabase = getSupabaseAdmin();
    let builder = supabase
      .from('contacts')
      .select('id,name,email,company,phone,notes,tags,created_at,updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(200);

    if (query) {
      const escaped = query.replace(/[\\%_]/g, (match) => `\\${match}`);
      builder = builder.or(`name.ilike.%${escaped}%,email.ilike.%${escaped}%,company.ilike.%${escaped}%,phone.ilike.%${escaped}%`);
    }

    const { data, error } = await builder;
    if (error) throw error;
    return NextResponse.json({ contacts: data ?? [] });
  } catch (error) {
    console.error('contacts list error', error);
    return NextResponse.json({ error: 'Unable to load contacts.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user, email: currentEmail } = await getCurrentUser();
    if (!user?.id || !currentEmail) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const body = await request.json();
    const name = cleanText(body.name, MAX_NAME);
    const email = normalizeEmail(body.email);
    const company = cleanText(body.company, MAX_COMPANY);
    const phone = cleanText(body.phone, MAX_PHONE);
    const notes = cleanText(body.notes, MAX_NOTES);
    const tags = cleanTags(body.tags);

    if (!name) return NextResponse.json({ error: 'Name is required.' }, { status: 400 });
    if (!email || !validEmail(email)) return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('contacts')
      .insert({ user_id: user.id, name, email, company, phone, notes, tags })
      .select('id,name,email,company,phone,notes,tags,created_at,updated_at')
      .single();

    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'A contact with this email already exists.' }, { status: 409 });
      throw error;
    }
    return NextResponse.json({ contact: data }, { status: 201 });
  } catch (error) {
    console.error('contact create error', error);
    return NextResponse.json({ error: 'Unable to create contact.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { user, email: currentEmail } = await getCurrentUser();
    if (!user?.id || !currentEmail) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const body = await request.json();
    const id = typeof body.id === 'string' ? body.id : '';
    if (!id) return NextResponse.json({ error: 'Contact ID is required.' }, { status: 400 });

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if ('name' in body) {
      const name = cleanText(body.name, MAX_NAME);
      if (!name) return NextResponse.json({ error: 'Name is required.' }, { status: 400 });
      updates.name = name;
    }
    if ('email' in body) {
      const email = normalizeEmail(body.email);
      if (!email || !validEmail(email)) return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 });
      updates.email = email;
    }
    if ('company' in body) updates.company = cleanText(body.company, MAX_COMPANY);
    if ('phone' in body) updates.phone = cleanText(body.phone, MAX_PHONE);
    if ('notes' in body) updates.notes = cleanText(body.notes, MAX_NOTES);
    if ('tags' in body) updates.tags = cleanTags(body.tags);

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('contacts')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id,name,email,company,phone,notes,tags,created_at,updated_at')
      .maybeSingle();

    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'A contact with this email already exists.' }, { status: 409 });
      throw error;
    }
    if (!data) return NextResponse.json({ error: 'Contact not found.' }, { status: 404 });
    return NextResponse.json({ contact: data });
  } catch (error) {
    console.error('contact update error', error);
    return NextResponse.json({ error: 'Unable to update contact.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { user, email: currentEmail } = await getCurrentUser();
    if (!user?.id || !currentEmail) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const id = new URL(request.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Contact ID is required.' }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Contact not found.' }, { status: 404 });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error('contact delete error', error);
    return NextResponse.json({ error: 'Unable to delete contact.' }, { status: 500 });
  }
}
