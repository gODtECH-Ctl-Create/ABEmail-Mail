import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/admin';

const CYCLES = new Set(['monthly', 'yearly']);
const STATUSES = new Set(['setup', 'active', 'past_due', 'cancelled', 'suspended']);

function authError(error: unknown) {
  const code = error instanceof Error ? error.message : '';
  if (code === 'AUTHENTICATION_REQUIRED') return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  if (code === 'ADMIN_ACCESS_REQUIRED') return NextResponse.json({ error: 'ABE Tech Lab admin access required.' }, { status: 403 });
  return null;
}

function parsePrice(value: unknown) {
  if (value === '' || value === null || value === undefined) return null;
  const price = Number(value);
  if (!Number.isFinite(price) || price < 0 || price > 999999999) return null;
  return Math.round(price * 100) / 100;
}

export async function GET() {
  try {
    await requireAdmin();
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('billing_subscriptions')
      .select('id,organization_name,plan_name,billing_cycle,status,currency,monthly_price,yearly_price,starts_at,renews_at,provider,created_at,updated_at')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return NextResponse.json({ subscription: data ?? null });
  } catch (error) {
    const response = authError(error);
    if (response) return response;
    console.error('admin subscription list error', error);
    return NextResponse.json({ error: 'Unable to load subscription.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await requireAdmin();
    const adminUserId = admin.user?.id;
    if (!adminUserId) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const body = await request.json();
    const id = typeof body.id === 'string' ? body.id : '';
    const planName = typeof body.planName === 'string' ? body.planName.trim() : '';
    const billingCycle = typeof body.billingCycle === 'string' ? body.billingCycle : '';
    const status = typeof body.status === 'string' ? body.status : '';
    const currency = typeof body.currency === 'string' ? body.currency.trim().toUpperCase() : 'NGN';
    const monthlyPrice = parsePrice(body.monthlyPrice);
    const yearlyPrice = parsePrice(body.yearlyPrice);
    const startsAt = typeof body.startsAt === 'string' && body.startsAt ? body.startsAt : null;
    const renewsAt = typeof body.renewsAt === 'string' && body.renewsAt ? body.renewsAt : null;

    if (!id || !planName || !CYCLES.has(billingCycle) || !STATUSES.has(status) || !/^[A-Z]{3}$/.test(currency)) {
      return NextResponse.json({ error: 'Invalid subscription data.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: subscription, error } = await supabase
      .from('billing_subscriptions')
      .update({ plan_name: planName, billing_cycle: billingCycle, status, currency, monthly_price: monthlyPrice, yearly_price: yearlyPrice, starts_at: startsAt, renews_at: renewsAt })
      .eq('id', id)
      .select('id,organization_name,plan_name,billing_cycle,status,currency,monthly_price,yearly_price,starts_at,renews_at,provider,created_at,updated_at')
      .single();
    if (error) throw error;

    await supabase.from('admin_audit_log').insert({
      admin_user_id: adminUserId,
      action: 'subscription.updated',
      target_type: 'billing_subscription',
      target_id: id,
      summary: `Subscription updated: ${planName} (${billingCycle})` ,
      metadata: { billingCycle, status, currency, monthlyPrice, yearlyPrice, startsAt, renewsAt },
    });

    return NextResponse.json({ subscription });
  } catch (error) {
    const response = authError(error);
    if (response) return response;
    console.error('admin subscription update error', error);
    return NextResponse.json({ error: 'Unable to update subscription.' }, { status: 500 });
  }
}
