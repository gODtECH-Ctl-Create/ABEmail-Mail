# ABEmail-Mail Security Checklist

This checklist is for the Waste2Light-specific deployment. It does not introduce multi-tenant or commercial ABE platform administration.

## Verified in code

- Authenticated mailbox routes require a signed-in Supabase user.
- Waste2Light routes restrict mailbox users to `@waste2light.com` accounts.
- The Resend inbound webhook verifies Svix webhook headers with `RESEND_WEBHOOK_SECRET` before processing events.
- Browser-facing responses receive baseline security headers from `next.config.ts`.
- Draft operations are scoped to the authenticated user in the API and database policies.
- Supabase Row Level Security (RLS) policies use cached `auth.uid()`/JWT evaluation patterns to avoid repeated per-row auth evaluation.
- Server-side Resend and Supabase service-role credentials are kept in server-only environment variables.

## Production verification before sign-off

- Enable Supabase leaked-password protection in the Auth password security settings.
- Confirm the four Waste2Light mailbox accounts are the only intended users.
- Confirm production environment variables contain only the required keys and no browser bundle exposes service-role, Resend, or VAPID private keys.
- Test unauthenticated access to `/api/inbox`, `/api/messages`, `/api/drafts`, `/api/send`, and `/api/webhooks/resend`.
- Test malformed message IDs, unsupported message actions, oversized/invalid JSON, and invalid recipient input.
- Verify Trash and permanent deletion behave according to the Waste2Light shared-mail permissions model.
- Verify Web Push subscriptions remain private to the owning user/device.
- After the Attachments branch is merged, verify the attachment bucket remains private and downloads require an authenticated, authorized request.
- Review Vercel runtime logs for repeated 4xx/5xx errors after deployment.

## Intentionally deferred

- Durable distributed rate limiting. This should be added when there is a durable rate-limit store or Vercel/Cloudflare control available, rather than relying on an in-memory counter that would not be reliable across serverless instances.
- Full Content Security Policy (CSP). A strict policy should be introduced only after testing Next.js, Supabase Auth, PWA, Web Push, and any future inline asset requirements together.
