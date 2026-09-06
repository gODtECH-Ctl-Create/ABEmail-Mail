# Waste2Light ABEmail Incident Runbook

## First response

1. Identify the incident ID, severity, component and first-seen time.
2. Check recent deployments and correlate Vercel request/trace IDs.
3. Check Resend event/webhook status if email flow is involved.
4. Check Supabase logs, Advisors and service health if database/Auth/Storage is involved.
5. Check Cloudflare DNS/MX/SPF/DKIM/DMARC if domain or receiving is involved.
6. Link any user reports to the incident instead of opening duplicate incidents.

## Email sending incident

Check `/api/send`, Resend `email.sent`, `email.failed`, `email.delivery_delayed`, `email.bounced`, `email.complained` and `email.suppressed` events.

## Email receiving incident

Check `/api/webhooks/resend`, webhook signature failures, retries/replays, the last successful `email.received` event and whether the inbound message was persisted.

## Database/Auth incident

Check Supabase API/Postgres/Auth logs, connection pressure, recent schema changes, security Advisors and authentication failure spikes.

## Attachment incident

Check Storage logs, private bucket authorization errors, upload/download failures and usage/quota.

## Notification incident

Check push subscription errors, invalid subscriptions and provider delivery errors. Email send/receive must continue even if notifications fail.

## Communication

User-facing message should describe the current impact without exposing provider secrets or internal diagnostics. Critical incidents should notify ABE Tech Lab operations staff.
