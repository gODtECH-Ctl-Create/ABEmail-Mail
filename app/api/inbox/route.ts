import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  try {
    const authClient = await getSupabaseServer();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user?.email) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('email_messages')
      .select('id,resend_email_id,direction,from_address,to_addresses,subject,html_body,text_body,status,created_at,received_at,message_id,attachments')
      .or(`to_addresses.cs.{${user.email}},created_by.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;
    return NextResponse.json({ messages: data ?? [] });
  } catch (error) {
    console.error('inbox error', error);
    return NextResponse.json({ error: 'Unable to load inbox.' }, { status: 500 });
  }
}
