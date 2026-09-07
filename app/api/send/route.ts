import { NextResponse } from 'next/server';
import { getResend } from '@/lib/resend';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getSupabaseServer } from '@/lib/supabase-server';
import { recordIncident, recordSystemEvent, requestContext } from '@/lib/monitoring';

const MAIL_DOMAIN = 'waste2light.com';

export async function POST(request: Request) {
  const context = requestContext(request);
  let userId: string | null = null;
  let from = '';

  try {
    const authClient = await getSupabaseServer();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user?.email) {
      await recordSystemEvent({ eventType: 'email.send.rejected', severity: 'warning', component: 'email.send', action: 'authenticate', message: 'Authentication required', ...context, route: '/api/send', httpStatus: 401 });
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    userId = user.id;
    from = user.email.toLowerCase();
    if (!from.endsWith(`@${MAIL_DOMAIN}`)) {
      await recordSystemEvent({ eventType: 'email.send.rejected', severity: 'warning', component: 'email.send', action: 'authorize', message: 'Account is not configured as a Waste2Light mailbox', userId, mailbox: from, ...context, route: '/api/send', httpStatus: 403 });
      return NextResponse.json({ error: 'Your account is not configured as a Waste2Light mailbox.' }, { status: 403 });
    }

    const body = await request.json();
    const to = typeof body.to === 'string' ? body.to.trim().toLowerCase() : '';
    const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
    const html = typeof body.html === 'string' ? body.html : '';
    const replyTo = typeof body.replyTo === 'string' ? body.replyTo.trim().toLowerCase() : undefined;
    const draftId = typeof body.draftId === 'string' ? body.draftId : '';

    if (!to || !subject || !html) {
      await recordSystemEvent({ eventType: 'email.send.rejected', severity: 'warning', component: 'email.send', action: 'validate', message: 'Required message fields are missing', userId, mailbox: from, ...context, route: '/api/send', httpStatus: 400 });
      return NextResponse.json({ error: 'To, subject and message are required.' }, { status: 400 });
    }

    const resend = getResend();
    const { data, error } = await resend.emails.send({
      from,
      to: [to],
      replyTo: replyTo ? [replyTo] : undefined,
      subject,
      html,
    });

    if (error || !data?.id) {
      await recordSystemEvent({ eventType: 'email.send.failed', severity: 'error', component: 'resend', action: 'send', message: error?.message ?? 'Resend rejected the message', userId, mailbox: from, ...context, route: '/api/send', httpStatus: 502, provider: 'resend' });
      await recordIncident({ incidentKey: 'email.send.failed', title: 'Outbound email sending failure', severity: 'P2', component: 'resend', summary: 'Resend rejected or failed an outbound email request.', eventType: 'email.send.failed', message: error?.message ?? 'Resend rejected the message', requestId: context.requestId, deploymentId: context.deploymentId, metadata: { mailbox: from, provider: 'resend' } });
      return NextResponse.json({ error: error?.message ?? 'Resend rejected the message.' }, { status: 502 });
    }

    const supabase = getSupabaseAdmin();
    const { error: insertError } = await supabase.from('email_messages').insert({
      resend_email_id: data.id,
      direction: 'outbound',
      from_address: from,
      to_addresses: [to],
      subject,
      html_body: html,
      status: 'sent',
      created_by: user.id,
      is_read: true,
      is_starred: false,
      is_trashed: false,
    });

    if (insertError) {
      console.error('failed to save sent message', insertError);
      await recordSystemEvent({ eventType: 'email.send.persistence_failed', severity: 'error', component: 'supabase', action: 'save_outbound_message', message: 'Email sent but message record could not be stored', userId, mailbox: from, ...context, route: '/api/send', httpStatus: 500, provider: 'supabase', providerEventId: data.id });
      await recordIncident({ incidentKey: 'email.send.persistence_failed', title: 'Sent email was not saved', severity: 'P2', component: 'supabase', summary: 'Resend accepted an email but ABEmail could not persist the sent-message record.', eventType: 'email.send.persistence_failed', message: 'Outbound message persistence failed after provider acceptance.', requestId: context.requestId, deploymentId: context.deploymentId, providerEventId: data.id, metadata: { mailbox: from } });
    }

    if (draftId) {
      const { error: draftDeleteError } = await supabase
        .from('email_drafts')
        .delete()
        .eq('id', draftId)
        .eq('user_id', user.id);
      if (draftDeleteError) {
        console.error('failed to delete sent draft', draftDeleteError);
        await recordSystemEvent({ eventType: 'draft.delete_after_send.failed', severity: 'warning', component: 'supabase', action: 'delete_draft', message: 'Sent message succeeded but draft cleanup failed', userId, mailbox: from, ...context, route: '/api/send', httpStatus: 500, provider: 'supabase' });
      }
    }

    await recordSystemEvent({ eventType: 'email.sent', severity: 'info', component: 'resend', action: 'send', message: 'Outbound email accepted by provider', userId, mailbox: from, ...context, route: '/api/send', httpStatus: 200, provider: 'resend', providerEventId: data.id, metadata: { recipientCount: 1 } });

    return NextResponse.json({ id: data.id });
  } catch (error) {
    console.error('send email error', error);
    const message = error instanceof Error ? error.message : 'Unknown send error';
    await recordSystemEvent({ eventType: 'email.send.error', severity: 'error', component: 'email.send', action: 'request', message, userId, mailbox: from || null, ...context, route: '/api/send', httpStatus: 500 });
    await recordIncident({ incidentKey: 'email.send.error', title: 'Outbound email API error', severity: 'P2', component: 'email.send', summary: 'The outbound email API encountered an unexpected error.', eventType: 'email.send.error', message, requestId: context.requestId, deploymentId: context.deploymentId, metadata: { mailbox: from || null } });
    return NextResponse.json({ error: 'Unable to send message.' }, { status: 500 });
  }
}
