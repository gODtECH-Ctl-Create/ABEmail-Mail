# ABEmail Mail

AB-branded business mail workspace for Waste2Light, powered by Resend and Supabase.

## Current MVP

- Supabase email/password authentication
- Inbox and Sent views
- Compose and send email through Resend
- Authenticated send API
- Verified Resend inbound webhook
- Store inbound and outbound messages in Supabase
- Basic message viewer
- Initial mailboxes for Waste2Light:
  - info@waste2light.com
  - support@waste2light.com
  - admin@waste2light.com
  - emmanuel.aba@waste2light.com

## Stack

- Next.js App Router
- React + TypeScript
- Supabase Auth + PostgreSQL
- Resend Email API + Receiving API
- Vercel

## Environment

Copy `.env.example` to `.env.local` and set the real values. Never expose `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, or `RESEND_WEBHOOK_SECRET` to browser code.

## Supabase

Run `supabase/migrations/001_email_core.sql` against the Waste2Light Supabase project. Create the four mailbox users in Supabase Auth and make their login email match the mailbox address.

## Resend

1. Verify `waste2light.com` in Resend.
2. Configure inbound receiving for the domain.
3. Point the required MX (Mail Exchange) record(s) to Resend.
4. Create a webhook for `email.received` targeting `/api/webhooks/resend`.
5. Store the webhook signing secret as `RESEND_WEBHOOK_SECRET`.

Resend webhooks are verified before an inbound message is stored. The app then retrieves the received email body from the Receiving API and persists it in Supabase.

## Deployment

Deploy this repository as a separate Vercel project and attach `mail.waste2light.com` to it. Keep the existing Waste2Light website deployment unchanged. Both applications can use the same Supabase project.
