# ABEmail production security checklist

This checklist records the remaining production verification for issues #11 and
#50. Repository controls should be checked in code review; provider controls must
be checked in the Waste2Light Supabase, Resend, Vercel, and DNS consoles.

## Implemented in the repository

- Authenticated mailbox checks on user-facing API routes.
- Explicit ownership checks before message and attachment operations that use
  the Supabase service role.
- User-owned Row Level Security policies for drafts, preferences, scheduled
  messages, contacts, and saved-signature data.
- Private attachment paths scoped to the authenticated user.
- Signed Resend webhook verification and idempotent delivery-event storage.
- Server-only Resend, Supabase service-role, webhook, and cron secrets.
- Browser security headers including HSTS, frame denial, MIME sniffing
  protection, referrer policy, and permissions policy.
- Database-backed rate limits on direct, multi-recipient, attachment, and
  scheduled-message creation routes.
- Recipient, subject, body, attachment-count, and attachment-size bounds.
- Admin-only mailbox and user management with audit records.

## Production checks still required

- [ ] Confirm Supabase Auth leaked-password protection is enabled.
- [ ] Run Supabase Security and Performance Advisors and resolve applicable
      findings against the deployed schema.
- [ ] Confirm every migration in the repository has been applied in order.
- [ ] Confirm the attachment storage bucket is private and its deployed policies
      match the repository ownership model.
- [ ] Confirm only server runtimes contain `SUPABASE_SERVICE_ROLE_KEY`,
      `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, and `CRON_SECRET`.
- [ ] Confirm the Resend webhook subscribes only to the required inbound and
      delivery events and rejects an invalid test signature.
- [ ] Exercise unauthenticated, cross-mailbox, oversized-input, replay, and
      rate-limit test cases in the production-like environment.
- [ ] Record the deployed commit and verification date on issue #50.

Issue #50 should remain open until these provider-side checks are recorded.
The older issue #11 can be closed as superseded by #50.
