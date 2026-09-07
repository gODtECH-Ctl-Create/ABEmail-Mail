# Waste2Light ABE Tech Lab Operations Status

## Current branch

`feature/waste2light-admin-v2`

## Implemented

- Server-side ABE Tech Lab admin allowlist via `ABEMAIL_ADMIN_EMAILS`.
- Protected `/admin` operations overview.
- Incident and incident-event data model.
- Structured system-event model with request, trace, deployment and provider context.
- Protected incident list/status API with audit logging.
- Dedicated `/admin/incidents` and `/admin/monitoring` views.
- Automatic monitoring signals for outbound send success/failure and inbound Resend webhook success/failure.
- Verified Resend delivery-event ingestion foundation for sent, delivered, delayed, bounced, complained, suppressed and failed events.
- Idempotent Resend event storage keyed by `svix-id` so webhook retries do not create duplicate delivery records.
- Provider-status fields on outbound messages for delivery-state visibility.
- User-facing `Report a problem` component and safe diagnostic report API.
- Reports can attach to a matching active incident or create a P3 user-report incident candidate.

## Not yet production-applied

The Admin database migration `007_admin_operations.sql` and delivery migration `008_resend_delivery_events.sql` remain branch-only. Apply them only as part of the approved Admin rollout.

## Provider portability

The monitoring model is intentionally provider-neutral. Vercel is the current runtime source, while Cloudflare DNS/runtime/security/service signals will be added during the future migration.

## Current external configuration requirements

- Add the approved ABE Tech Lab operator email(s) to `ABEMAIL_ADMIN_EMAILS` in the appropriate Vercel environment before using the Admin console.
- Update the Resend webhook at `https://mail.waste2light.com/api/webhooks/resend` to subscribe to the delivery events needed for monitoring: `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained`, `email.suppressed`, and `email.failed`.

## Remaining implementation

- Connect existing user error states directly to Report a Problem.
- Add automated P1-P4 incident thresholds and alert routing rather than opening incidents for every single delivery event.
- Add deeper Supabase/Vercel health checks and future Cloudflare signals.
- Add full Email Operations, Infrastructure, Security and Capacity sections.
- Add notification routing for critical Admin incidents.
- Add Admin actions for mailbox and subscription management.
