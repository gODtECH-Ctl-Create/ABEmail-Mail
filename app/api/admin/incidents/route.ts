import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/admin';

function authError(error: unknown) {
  const code = error instanceof Error ? error.message : '';
  if (code === 'AUTHENTICATION_REQUIRED') return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  if (code === 'ADMIN_ACCESS_REQUIRED') return NextResponse.json({ error: 'ABE Tech Lab admin access required.' }, { status: 403 });
  return null;
}

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const severity = url.searchParams.get('severity');
    const parsedLimit = Number(url.searchParams.get('limit') ?? '50');
    const limit = Math.min(Math.max(Number.isFinite(parsedLimit) ? parsedLimit : 50, 1), 100);

    const supabase = getSupabaseAdmin();
    let query = supabase
      .from('incidents')
      .select('id,incident_key,title,severity,status,component,summary,first_seen_at,last_seen_at,resolved_at,closed_at,metadata,created_at,updated_at')
      .order('last_seen_at', { ascending: false })
      .limit(limit);

    if (status) query = query.eq('status', status);
    if (severity) query = query.eq('severity', severity);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ incidents: data ?? [] });
  } catch (error) {
    const response = authError(error);
    if (response) return response;
    console.error('admin incidents list error', error);
    return NextResponse.json({ error: 'Unable to load incidents.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await requireAdmin();
    const adminUserId = admin.user?.id;
    if (!adminUserId) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const body = await request.json();
    const id = typeof body.id === 'string' ? body.id : '';
    const status = typeof body.status === 'string' ? body.status : '';
    const allowed = new Set(['detected', 'investigating', 'mitigated', 'resolved', 'closed']);
    if (!id || !allowed.has(status)) {
      return NextResponse.json({ error: 'Incident ID and valid status are required.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const update: Record<string, unknown> = { status };
    if (status === 'resolved') update.resolved_at = new Date().toISOString();
    if (status === 'closed') update.closed_at = new Date().toISOString();

    const { data: incident, error } = await supabase
      .from('incidents')
      .update(update)
      .eq('id', id)
      .select('id,incident_key,title,severity,status,component,summary,first_seen_at,last_seen_at,resolved_at,closed_at')
      .single();
    if (error) throw error;

    await supabase.from('admin_audit_log').insert({
      admin_user_id: adminUserId,
      action: 'incident.status_updated',
      target_type: 'incident',
      target_id: id,
      summary: `Incident ${incident.incident_key} moved to ${status}`,
      metadata: { status },
    });

    return NextResponse.json({ incident });
  } catch (error) {
    const response = authError(error);
    if (response) return response;
    console.error('admin incident update error', error);
    return NextResponse.json({ error: 'Unable to update incident.' }, { status: 500 });
  }
}
