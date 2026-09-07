import 'server-only';

import { getSupabaseServer } from '@/lib/supabase-server';

const parseAdminEmails = () =>
  (process.env.ABEMAIL_ADMIN_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

export async function getAdminContext() {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  const email = user?.email?.toLowerCase() ?? '';
  const isAdmin = Boolean(email && parseAdminEmails().includes(email));

  return {
    user,
    email,
    isAdmin,
  };
}

export async function requireAdmin() {
  const context = await getAdminContext();
  if (!context.user) throw new Error('AUTHENTICATION_REQUIRED');
  if (!context.isAdmin) throw new Error('ADMIN_ACCESS_REQUIRED');
  return context;
}
