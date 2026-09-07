# Waste2Light ABE Tech Lab Admin Plan

This plan is intentionally small and deployment-specific. The commercial multi-tenant ABE Admin platform belongs in the separate ABEmail repository.

## Ownership

The Admin console is for **ABE Tech Lab** as the product owner/operator. Waste2Light users use the normal mail application and do not receive infrastructure-monitoring access.

## Authentication model

Admin access uses the existing Supabase Auth account system. An authenticated user is treated as an ABE Tech Lab administrator only when their email is present in the server-side `ABEMAIL_ADMIN_EMAILS` allowlist. No admin privileges are inferred from a mailbox address such as `admin@waste2light.com`.

This keeps the Waste2Light mailbox identity separate from the operator identity.

## Admin areas

### Overview

- Overall application and database state
- Active incidents and user reports
- Inbound/outbound mail counts
- Failed/non-sent outbound count
- Browser notification adoption
- Active mailbox count
- Subscription status

### Incidents

- Detected incidents
- Severity: P1/P2/P3/P4
- Status: detected, investigating, mitigated, resolved, closed
- Affected component
- First/last seen
- Related events and user reports
- Request/deployment/provider evidence

### Email Operations

- Sending health
- Delivery/delay/failure/bounce/complaint/suppression events
- Receiving health
- Resend webhook health and processing gaps
- Mailbox-level activity

### Infrastructure

- Current Vercel runtime health
- Supabase database/API/Auth/Storage health
- DNS/MX/SPF/DKIM/DMARC state
- Future Cloudflare runtime, routing, HTTPS/certificates, Web Application Firewall (WAF), Distributed Denial-of-Service (DDoS) and service-health signals

Monitoring logic must remain provider-neutral so the application can move from Vercel to Cloudflare without redesigning the Admin console.

### Security

- Authentication failures
- Authorization failures
- Security advisor findings
- Webhook verification failures
- Storage access issues
- Suspicious activity and rate-limit events when implemented

### Capacity

- Email volume
- Resend limits/usage where available
- Database usage
- Storage/attachment usage
- Vercel usage today and Cloudflare usage after migration
- Threshold warnings

### User issue reporting

Users get a safe `Report an issue` action when an operation fails. Reports capture context such as timestamp, mailbox, action, request/correlation ID, deployment and provider IDs when available, plus the user's description. Passwords, access tokens and full email bodies are never captured.

A report is attached to an active incident when a reliable correlation exists; otherwise it becomes a new incident candidate.

## Admin actions

- Manage Waste2Light mailboxes and activation state
- Manage authorized users/access
- Manage notification devices
- View/update subscription status while payment is external
- Review and acknowledge incidents/reports
- Record resolution/mitigation notes

## Non-goals

This deployment should not gain:

- multi-tenant organizations
- customer provisioning
- cross-company tenants
- commercial SaaS admin
- platform-wide billing engine
- public tenant/domain onboarding

## Implementation order

1. Admin authorization and overview shell
2. Incident/event storage and structured application logging
3. Monitoring integrations and automatic incident detection
4. User issue reporting and incident correlation
5. Mailbox/access management
6. Notification-device management
7. Subscription/usage controls
8. Audit trail and final role-boundary testing
9. Cloudflare-aware infrastructure monitoring
