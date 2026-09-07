import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/admin';

function authError(error: unknown) {
  const code = error instanceof Error ? error.message : '';
  if (code === 'AUTHENTICATION_REQUIRED') return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  if (code === 'ADMIN_ACCESS_REQUIRED') return NextResponse.json({ error: 'ABE Tech Lab admin access required.' }, { status: 403 });
  return null;
}

export async function GET() {
  try {
    await requireAdmin();
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('mailboxes')
      .select('id,address,display_name,active,created_at')
      .order('address');
    if (error) throw error;
    return NextResponse.json({ mailboxes: data ?? [] });
  } catch (error) {
    const response = authError(error);
    if (response) return response;
    console.error('admin mailbox list error', error);
    return NextResponse.json({ error: 'Unable to load mailboxes.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await requireAdmin();
    const adminUserId = admin.user?.id;
    if (!adminUserId) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const body = await request.json();
    const id = typeof body.id === 'string' ? body.id : '';
    const active = typeof body.active === 'boolean' ? body.active : null;
    if (!id || active === null) {
      return NextResponse.json({ error: 'Mailbox ID and active state are required.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: mailbox, error } = await supabase
      .from('mailboxes')
      .update({ active })
      .eq('id', id)
      .select('id,address,display_name,active,created_at')
      .single();
    if (error) throw error;

    await supabase.from('admin_audit_log').insert({
      admin_user_id: adminUserId,
      action: active ? 'mailbox.enabled' : 'mailbox.disabled',
      target_type: 'mailbox',
      target_id: id,
      summary: `${mailbox.address} ${active ? 'enabled' : 'disabled'} for application access`,
      metadata: { active },
    });

    return NextResponse.json({ mailbox });
  } catch (error) {
    const response = authError(error);
    if (response) return response;
    console.error('admin mailbox update error', error);
    return NextResponse.json({ error: 'Unable to update mailbox.' }, { status: 500 });
  }
}
