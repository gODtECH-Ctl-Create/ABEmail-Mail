import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getAdminContext, requireAdmin } from '@/lib/admin';

const parseAdminEmails = () =>
  (process.env.ABEMAIL_ADMIN_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

function authError(error: unknown) {
  const code = error instanceof Error ? error.message : '';
  if (code === 'AUTHENTICATION_REQUIRED') return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  if (code === 'ADMIN_ACCESS_REQUIRED') return NextResponse.json({ error: 'ABE Tech Lab admin access required.' }, { status: 403 });
  return null;
}

function isSuspended(bannedUntil?: string | null) {
  return Boolean(bannedUntil && Date.parse(bannedUntil) > Date.now());
}

export async function GET() {
  try {
    const admin = await requireAdmin();
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) throw error;

    const adminEmails = new Set(parseAdminEmails());
    const users = (data.users ?? [])
      .map((user) => ({
        id: user.id,
        email: user.email ?? null,
        createdAt: user.created_at,
        lastSignInAt: user.last_sign_in_at ?? null,
        emailConfirmedAt: user.email_confirmed_at ?? null,
        bannedUntil: user.banned_until ?? null,
        suspended: isSuspended(user.banned_until),
        isAdmin: Boolean(user.email && adminEmails.has(user.email.toLowerCase())),
        isCurrentAdmin: user.id === admin.user?.id,
      }))
      .filter((user) => !user.email || user.email.toLowerCase().endsWith('@waste2light.com'));

    return NextResponse.json({ users });
  } catch (error) {
    const response = authError(error);
    if (response) return response;
    console.error('admin user list error', error);
    return NextResponse.json({ error: 'Unable to load users.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await requireAdmin();
    const currentUserId = admin.user?.id;
    if (!currentUserId) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const body = await request.json();
    const userId = typeof body.id === 'string' ? body.id : '';
    const action = body.action === 'suspend' || body.action === 'restore' ? body.action : '';
    if (!userId || !action) return NextResponse.json({ error: 'User ID and valid action are required.' }, { status: 400 });
    if (userId === currentUserId) return NextResponse.json({ error: 'You cannot change your own admin access here.' }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data: targetResult, error: targetError } = await supabase.auth.admin.getUserById(userId);
    if (targetError || !targetResult.user) throw targetError ?? new Error('User not found');

    const targetEmail = targetResult.user.email?.toLowerCase() ?? '';
    if (parseAdminEmails().includes(targetEmail)) {
      return NextResponse.json({ error: 'Admin accounts cannot be suspended from this console.' }, { status: 400 });
    }
    if (!targetEmail.endsWith('@waste2light.com')) {
      return NextResponse.json({ error: 'Only Waste2Light users can be managed here.' }, { status: 400 });
    }

    const ban_duration = action === 'suspend' ? '24h' : 'none';
    const { data: updatedResult, error: updateError } = await supabase.auth.admin.updateUserById(userId, { ban_duration });
    if (updateError || !updatedResult.user) throw updateError ?? new Error('User update failed');

    const suspended = isSuspended(updatedResult.user.banned_until);
    await supabase.from('admin_audit_log').insert({
      admin_user_id: currentUserId,
      action: suspended ? 'user.suspended' : 'user.restored',
      target_type: 'auth_user',
      target_id: userId,
      summary: `${targetEmail} ${suspended ? 'suspended for 24 hours' : 'restored'}`,
      metadata: { suspended, ban_duration },
    });

    return NextResponse.json({
      user: {
        id: updatedResult.user.id,
        email: updatedResult.user.email ?? null,
        bannedUntil: updatedResult.user.banned_until ?? null,
        suspended,
      },
    });
  } catch (error) {
    const response = authError(error);
    if (response) return response;
    console.error('admin user update error', error);
    return NextResponse.json({ error: 'Unable to update user.' }, { status: 500 });
  }
}
