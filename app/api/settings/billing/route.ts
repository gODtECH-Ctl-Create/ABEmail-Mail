import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getSupabaseServer } from '@/lib/supabase-server';

const ADMIN_EMAIL = 'admin@waste2light.com';
const VALID_CYCLES = new Set(['monthly', 'yearly']);

export async function PATCH(request: Request) {
  try {
    const authClient = await getSupabaseServer();
    const { data: { user } } = await authClient.auth.getUser();
    const email = user?.email?.toLowerCase();

    if (!user || !email) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    if (email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Only the Waste2Light admin mailbox can change billing.' }, { status: 403 });
    }

    const body = await request.json();
    const billingCycle = typeof body.billing_cycle === 'string' ? body.billing_cycle.toLowerCase() : '';

    if (!VALID_CYCLES.has(billingCycle)) {
      return NextResponse.json({ error: 'Billing cycle must be monthly or yearly.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: subscription, error: findError } = await supabase
      .from('billing_subscriptions')
      .select('id')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (findError) throw findError;
    if (!subscription?.id) {
      return NextResponse.json({ error: 'Waste2Light subscription record was not found.' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('billing_subscriptions')
      .update({ billing_cycle: billingCycle, updated_at: new Date().toISOString() })
      .eq('id', subscription.id)
      .select('plan_name,billing_cycle,status,currency,monthly_price,yearly_price,starts_at,renews_at')
      .single();

    if (error) throw error;
    return NextResponse.json({ subscription: data });
  } catch (error) {
    console.error('billing settings error', error);
    return NextResponse.json({ error: 'Unable to update billing settings.' }, { status: 500 });
  }
}
