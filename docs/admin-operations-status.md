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
- Resend delivery-event ingestion foundation for sent, delivered, delayed, bounced, complained, suppressed and failed events.
- Idempotent Resend delivery-event storage keyed by `svix-id` so webhook retries do not create duplicate delivery records.
- Provider-status fields on email messages for delivery-state visibility.
- Delivery health metrics in the Admin Monitoring view.
- User-facing `Report a problem` component and safe diagnostic report API.
- Reports can attach to a matching active incident or create a P3 user-report incident candidate.
- Automatic incident detection for critical signals and repeated matching warning/error signals.
- Deduplicated Admin alert records tied to detected incidents.
- Admin overview now surfaces new automatic alerts.

## Not yet production-applied

The Admin database migrations `007_admin_operations.sql`, `008_resend_delivery_events.sql`, and `009_incident_alerts.sql` remain branch-only. Apply them only as part of the approved Admin rollout.

## Provider portability

The monitoring model is intentionally provider-neutral. Vercel is the current runtime source, while Cloudflare DNS/runtime/security/service signals will be added during the future migration.

## Current external configuration requirements

- Add the approved ABE Tech Lab operator email(s) to `ABEMAIL_ADMIN_EMAILS` in the appropriate Vercel environment before using the Admin console.
- Update the Resend webhook at `https://mail.waste2light.com/api/webhooks/resend` to subscribe to the delivery events needed for monitoring: `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained`, `email.suppressed`, and `email.failed`.

## Remaining implementation

- Connect existing user error states directly to Report a Problem.
- Add scheduled/health-check based detection for silent failures such as a stalled inbound pipeline.
- Add deeper Supabase/Vercel health checks and future Cloudflare signals.
- Add full Infrastructure, Security and Capacity sections.
- Add notification routing for critical Admin alerts through email/web push.
- Add Admin actions for mailbox and subscription management.
