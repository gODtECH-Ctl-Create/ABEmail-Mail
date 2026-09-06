import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getSupabaseServer } from '@/lib/supabase-server';

const MAIL_DOMAIN = 'waste2light.com';

export async function PATCH(request: Request) {
  try {
    const authClient = await getSupabaseServer();
    const { data: { user } } = await authClient.auth.getUser();
    const userEmail = user?.email?.toLowerCase();

    if (!user?.id || !userEmail) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    if (!userEmail.endsWith(`@${MAIL_DOMAIN}`)) {
      return NextResponse.json({ error: 'Your account is not configured as a Waste2Light mailbox.' }, { status: 403 });
    }

    const body = await request.json();
    const id = typeof body.id === 'string' ? body.id : '';
    const action = typeof body.action === 'string' ? body.action : '';

    if (!id) return NextResponse.json({ error: 'Message ID is required.' }, { status: 400 });

    const updates: Record<string, boolean> = {};
    if (action === 'read') updates.is_read = true;
    else if (action === 'unread') updates.is_read = false;
    else if (action === 'star') updates.is_starred = true;
    else if (action === 'unstar') updates.is_starred = false;
    else if (action === 'trash') updates.is_trashed = true;
    else if (action === 'restore') updates.is_trashed = false;
    else return NextResponse.json({ error: 'Unsupported message action.' }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data: message, error: updateError } = await supabase
      .from('email_messages')
      .update(updates)
      .eq('id', id)
      .select('id,is_read,is_starred,is_trashed')
      .maybeSingle();

    if (updateError) throw updateError;
    if (!message) return NextResponse.json({ error: 'Message not found.' }, { status: 404 });

    return NextResponse.json({ message });
  } catch (error) {
    console.error('message state error', error);
    return NextResponse.json({ error: 'Unable to update message.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const authClient = await getSupabaseServer();
    const { data: { user } } = await authClient.auth.getUser();
    const userEmail = user?.email?.toLowerCase();

    if (!user?.id || !userEmail) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    if (!userEmail.endsWith(`@${MAIL_DOMAIN}`)) {
      return NextResponse.json({ error: 'Your account is not configured as a Waste2Light mailbox.' }, { status: 403 });
    }

    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Message ID is required.' }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('email_messages').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error('message delete error', error);
    return NextResponse.json({ error: 'Unable to permanently delete message.' }, { status: 500 });
  }
}
