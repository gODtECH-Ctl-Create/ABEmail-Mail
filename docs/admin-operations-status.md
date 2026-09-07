# Waste2Light ABE Tech Lab Operations Status

## Current branch

`feature/waste2light-admin-v2`

## Implemented

- Server-side ABE Tech Lab admin allowlist via `ABEMAIL_ADMIN_EMAILS`.
- Protected `/admin` operations overview.
- Incident and incident-event data model.
- Structured system-event model with request, trace, deployment and provider context.
- Protected incident list/status API with audit logging.
- Dedicated `/admin/incidents`, `/admin/monitoring`, `/admin/security`, and `/admin/capacity` views.
- Admin overview navigation for Monitoring, Security, Capacity & Usage, and Incidents.
- Automatic monitoring signals for outbound send success/failure and inbound Resend webhook success/failure.
- Resend delivery-event ingestion foundation for sent, delivered, delayed, bounced, complained, suppressed and failed events.
- Idempotent Resend delivery-event storage keyed by `svix-id` so webhook retries do not create duplicate delivery records.
- Provider-status fields on email messages for delivery-state visibility.
- Delivery health metrics in the Admin Monitoring view.
- User-facing `Report a problem` component and safe diagnostic report API.
- Reports can attach to a matching active incident or create a P3 user-report incident candidate.
- Automatic incident detection for critical signals and repeated matching warning/error signals.
- Deduplicated Admin alert records tied to detected incidents.
- P1/P2 operator email alerting through Resend when `ABEMAIL_ADMIN_EMAILS` is configured.
- Scheduled daily health-check endpoint covering Supabase connectivity, Resend domain/API status, required configuration, silent inbound-pipeline stalls, MX, SPF, and DMARC DNS presence.
- Vercel daily cron configuration for `/api/cron/health`, protected by `CRON_SECRET`.
- Security operations view covering authentication, webhook, admin access, configuration, and open security incidents.
- Capacity & Usage view covering 24-hour/30-day message volume, attachment counts, drafts, push-enabled users, and recorded provider events.

## Not yet production-applied

The Admin database migrations `007_admin_operations.sql`, `008_resend_delivery_events.sql`, and `009_incident_alerts.sql` remain branch-only. Apply them only as part of the approved Admin rollout.

## Provider portability

The monitoring model is intentionally provider-neutral. Vercel is the current runtime source, while Cloudflare DNS/runtime/security/service signals will be added during the future migration.

## Current external configuration requirements

- Add the approved ABE Tech Lab operator email(s) to `ABEMAIL_ADMIN_EMAILS` in the appropriate Vercel environment.
- Add a strong `CRON_SECRET` to the production Vercel environment for the scheduled health check.
- Update the Resend webhook at `https://mail.waste2light.com/api/webhooks/resend` to subscribe to the delivery events needed for monitoring: `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained`, `email.suppressed`, and `email.failed`.
- Configure Web Push credentials separately when the Web Push branch is ready to merge.

## Scheduled health-check behavior

The current Vercel Hobby deployment uses a daily cron schedule. The check does not treat normal low email volume as an outage. For inbound processing, it compares the newest message visible through Resend's Receiving API with the newest inbound message stored by ABEmail; it only creates an incident when Resend has a materially newer message that ABEmail has not persisted.

It also verifies the presence of MX, SPF and DMARC DNS records for `waste2light.com`. These checks indicate DNS/authentication configuration health; they do not guarantee Gmail inbox placement.

Higher-frequency silent-failure detection will be added through provider-neutral scheduling during the future Cloudflare migration or an external scheduler, without changing the Admin incident model.

## Remaining implementation

- Connect existing user error states directly to Report a Problem.
- Add deeper Vercel runtime and Supabase usage/health signals.
- Add future Cloudflare runtime, routing, HTTPS/certificate, Web Application Firewall (WAF), Distributed Denial-of-Service (DDoS), and service-health signals.
- Add notification routing for critical Admin alerts through web push when Web Push credentials are configured.
- Add Admin actions for mailbox and subscription management.
- Add final role-boundary, failure-injection, backup/recovery and production sign-off testing.
