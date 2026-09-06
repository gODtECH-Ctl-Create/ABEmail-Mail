# Waste2Light ABEmail Operations Monitoring Specification

## Purpose

The ABE Tech Lab operations console should detect production problems early, show what is affected, preserve enough context to diagnose the incident, and provide a clear path to recovery.

This is for the Waste2Light-specific deployment. It is not the commercial multi-tenant ABE Admin platform.

## Monitoring model

Every operational signal should be classified as:

- Healthy: normal operation.
- Warning: degraded or approaching a threshold.
- Critical: user impact, data risk, or service failure.

Each incident should capture:

- incident ID
- detected_at
- first_seen_at
- last_seen_at
- severity
- component
- route/service
- environment/deployment
- mailbox/user scope when relevant
- correlation/request ID when available
- external provider event ID when available
- symptom
- current status
- acknowledgement
- resolution notes

Do not store email body content in operational telemetry. Keep message IDs, provider IDs, route names, and safe metadata instead.

## 1. Application health

Monitor:

- 5xx error rate
- 4xx spikes that may indicate broken clients or abuse
- request latency
- failed API calls by route
- authentication middleware failures
- deployment status
- latest successful deployment
- production domain availability
- unexpected runtime exceptions

Key routes:

- `/api/inbox`
- `/api/send`
- `/api/messages`
- `/api/webhooks/resend`
- `/api/push/*`
- `/api/search/*`
- attachment routes
- draft routes

Vercel already exposes runtime logs with request ID, status, route, host, region, duration and deployment context, so the dashboard should correlate to those signals rather than recreate raw infrastructure logs unnecessarily.

## 2. Email sending health

Track:

- send attempts
- successful API submissions
- failed sends
- delivery delays
- bounces
- complaints
- suppressions
- delivery rate
- failure rate
- time-to-delivery when available

A sudden failure spike should create an incident. A single isolated failure should normally be a warning or user-visible failure unless it indicates a platform/configuration problem.

## 3. Email receiving health

Track:

- `email.received` webhook count
- webhook success rate
- webhook failure rate
- webhook retry count
- time since last successful inbound event
- inbound messages saved successfully
- inbound events that were received but not persisted
- Resend receiving-domain status

A critical condition should be raised when mail is expected but the system receives no inbound events for an abnormal period, or when Resend webhook failures persist.

## 4. Webhook integrity

Track:

- signature verification failures
- missing signature headers
- duplicate webhook deliveries
- replayed webhook events
- processing duration
- webhook HTTP status
- provider event IDs
- events that arrive out of order

Resend provides at-least-once delivery, retries, and replays, so duplicate-safe processing is a required monitoring and data-integrity concern.

## 5. Supabase health

Monitor:

- database connectivity errors
- Postgres 5xx/errors
- slow queries
- connection pressure
- blocked sessions
- cache/IO/CPU trends where available
- Auth failures
- Storage failures
- Realtime failures if used
- security advisor findings
- performance advisor findings
- storage usage
- database growth
- backup/export status

Supabase exposes logs for API, Auth, Storage, Postgres and related services, plus Prometheus-compatible database metrics and Advisors.

## 6. Authentication and access

Track:

- failed login spikes
- repeated login failures by account/IP pattern
- password reset activity
- unexpected token/session failures
- users unable to access mailbox
- disabled/unknown mailbox accounts
- authorization failures
- changes to access mappings

Sensitive values such as passwords or access tokens must never enter incident logs.

## 7. Storage and attachments

Monitor:

- upload failures
- download failures
- attachment processing errors
- storage growth
- unusual large-file activity
- private-bucket access denials
- orphaned attachments
- storage quota approach

## 8. Web Push / notifications

Monitor:

- subscription registration failures
- permission failures where detectable
- push send failures
- expired subscriptions
- invalid subscriptions
- native notification failures
- push delivery gaps
- duplicate notification reports

A failed push should not block email delivery.

## 9. DNS / domain / email authentication

Monitor:

- mail.waste2light.com availability
- DNS resolution
- required MX records
- SPF verification
- DKIM verification
- DMARC status
- Resend domain verification
- return-path configuration
- certificate/HTTPS availability

Any change to production MX records should be treated as high-impact because Cloudflare Email Routing can introduce conflicting MX records.

## 10. Deployment and release health

Monitor:

- production deployment status
- failed builds
- failed type checks
- failed tests
- deployment frequency
- rollback candidates
- first error after deployment
- error-rate comparison before/after deployment

A deployment that causes a material spike in errors should automatically open or escalate an incident.

## 11. Capacity and quota monitoring

Track:

- Resend sending quota/usage
- Supabase database/storage/log usage
- Vercel function/runtime usage
- attachment/storage growth
- approaching provider limits
- abnormal traffic growth

Capacity warnings should happen before hard limits are reached.

## 12. Security monitoring

Track:

- authentication failures
- authorization failures
- webhook signature failures
- suspicious request bursts
- unexpected admin activity
- data-access anomalies
- security advisor findings
- exposed/misconfigured secrets indicators
- changes to DNS/email-auth configuration

## 13. User-reported incidents

Add a `Report an issue` action when a user encounters a failure.

The report should automatically attach:

- incident/report ID
- user ID (internal reference only)
- mailbox
- timestamp
- timezone
- current route/view
- action being performed
- safe error code/message
- HTTP status when available
- correlation/request ID when available
- deployment ID/version when available
- browser/device metadata at coarse level
- relevant message/provider ID when available

Never automatically attach message bodies, passwords, tokens, or sensitive credentials.

Reports should be linked to an existing incident when a matching active incident exists; otherwise create a new incident candidate.

## 14. Automatic incident creation

The system should create an incident automatically when rules are crossed, for example:

- sustained 5xx spike
- repeated send failures
- inbound webhook outage
- repeated database failures
- authentication failure spike
- attachment/storage outage
- push subsystem outage
- production domain unavailable
- DNS/email-authentication failure
- provider integration failure

Avoid alert fatigue: one incident can contain many events and user reports.

## 15. Incident lifecycle

`Detected -> Investigating -> Mitigated -> Resolved -> Closed`

An incident should support:

- acknowledge
- assign owner
- severity change
- affected component
- affected mailbox/users
- timeline
- linked user reports
- linked provider events
- deployment information
- remediation notes
- resolution time

## 16. First dashboard views

### Overview

- System status
- Open critical incidents
- Warnings
- Email health
- Inbound health
- Application/API health
- Provider health
- Storage/capacity

### Incidents

- Active incidents
- Severity
- First seen
- Affected service
- Affected mailbox/user count
- linked reports
- current status

### Email operations

- Send/delivery funnel
- failed/delayed/bounced/complained
- inbound processing
- webhook status

### Infrastructure

- Vercel
- Supabase
- Resend
- Cloudflare/DNS
- deployment history

### Users / reports

- Recent reports
- grouped by incident
- affected mailbox
- report time
- status/resolution

## Alert priorities

P1 Critical: service unavailable, mail send/receive outage, data access risk, broken production domain.

P2 High: major degradation, sustained provider failures, attachment outage, widespread auth failures.

P3 Medium: isolated repeated failures, capacity warning, stale push subscriptions, non-critical integration issues.

P4 Low: informational warnings, isolated user reports, cleanup opportunities.

## Recommended implementation order

1. Structured application event/error logging and correlation IDs.
2. Incident and user-report tables.
3. Automatic incident rules for send/receive/API/webhook failures.
4. User `Report an issue` flow.
5. Admin Overview + Incidents views.
6. Email Operations view.
7. Infrastructure/Provider view.
8. Security and capacity views.
9. Notifications for critical incidents.
10. Retention, privacy and audit review.
