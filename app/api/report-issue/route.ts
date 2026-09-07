import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getSupabaseServer } from '@/lib/supabase-server';
import { recordIncident, recordSystemEvent, requestContext } from '@/lib/monitoring';

const MAX_TEXT = 2000;

const cleanText = (value: unknown, max = MAX_TEXT) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
};

export async function POST(request: Request) {
  const context = requestContext(request);

  try {
    const authClient = await getSupabaseServer();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user?.id || !user.email) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const body = await request.json();
    const mailbox = cleanText(body.mailbox, 320)?.toLowerCase() ?? user.email.toLowerCase();
    const route = cleanText(body.route, 300);
    const action = cleanText(body.action, 120);
    const description = cleanText(body.description);
    const safeErrorCode = cleanText(body.errorCode, 120);
    const safeErrorMessage = cleanText(body.errorMessage);
    const httpStatus = typeof body.httpStatus === 'number' && Number.isInteger(body.httpStatus) ? body.httpStatus : null;
    const browser = cleanText(body.browser, 160);
    const device = cleanText(body.device, 160);
    const timezone = cleanText(body.timezone, 100);
    const incidentKey = cleanText(body.incidentKey, 180);

    if (!description && !safeErrorMessage && !action) {
      return NextResponse.json({ error: 'Please describe what went wrong.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    let incidentId: string | null = null;

    if (incidentKey) {
      const { data: incident } = await supabase
        .from('incidents')
        .select('id,status')
        .eq('incident_key', incidentKey)
        .not('status', 'in', '(resolved,closed)')
        .maybeSingle();
      incidentId = incident?.id ?? null;
    }

    const reportKey = `RPT-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const { data: report, error } = await supabase.from('user_issue_reports').insert({
      report_key: reportKey,
      user_id: user.id,
      mailbox,
      incident_id: incidentId,
      route,
      action,
      description,
      safe_error_code: safeErrorCode,
      safe_error_message: safeErrorMessage,
      http_status: httpStatus,
      request_id: cleanText(context.requestId, 300),
      trace_id: cleanText(context.traceId, 500),
      deployment_id: cleanText(context.deploymentId, 300),
      browser,
      device,
      timezone,
      status: 'new',
    }).select('id,report_key').single();

    if (error || !report) throw error ?? new Error('Issue report could not be created');

    if (!incidentId) {
      incidentId = await recordIncident({
        incidentKey: `user_report.${reportKey.toLowerCase()}`,
        title: 'User-reported application problem',
        severity: 'P3',
        component: 'user_report',
        summary: description ?? safeErrorMessage ?? action ?? 'A user reported a problem.',
        eventType: 'user.issue_reported',
        message: description ?? safeErrorMessage ?? action ?? undefined,
        requestId: context.requestId,
        deploymentId: context.deploymentId,
        metadata: { reportKey, mailbox },
      });

      if (incidentId) {
        await supabase.from('user_issue_reports').update({ incident_id: incidentId }).eq('id', report.id);
      }
    }

    await recordSystemEvent({
      eventType: 'user.issue_reported',
      severity: 'warning',
      component: 'user_report',
      action: action ?? 'report',
      message: description ?? safeErrorMessage ?? 'User reported a problem.',
      userId: user.id,
      mailbox,
      ...context,
      route: route ?? '/report-issue',
      httpStatus: 201,
      metadata: { reportKey, incidentId },
    });

    return NextResponse.json({ reportKey, incidentId }, { status: 201 });
  } catch (error) {
    console.error('issue report error', error);
    return NextResponse.json({ error: 'Unable to submit issue report.' }, { status: 500 });
  }
}
