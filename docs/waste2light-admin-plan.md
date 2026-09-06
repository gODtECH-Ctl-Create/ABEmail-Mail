# Waste2Light ABEmail Admin Plan

This plan is intentionally small and deployment-specific. The commercial multi-tenant ABE Admin platform belongs in the separate ABEmail repository.

## Goal

Give Waste2Light one controlled place to manage the four mailboxes and basic service state without building a full SaaS administration platform.

## Proposed access model

Use a simple role model at the application level:

- `admin`: can manage mailboxes, access, subscription state, notification devices, and basic health/usage information.
- `member`: can use assigned mailbox features but cannot change organization-level configuration.

Do not infer admin privileges from the email address alone. Use an explicit role record or trusted server-side role mapping.

## Admin areas

### Mailboxes

- View all active/inactive Waste2Light mailboxes.
- Activate/deactivate a mailbox.
- View mailbox address and display name.
- See basic message volume.

Current mailboxes:

- `info@waste2light.com`
- `support@waste2light.com`
- `admin@waste2light.com`
- `emmanuel.abah@waste2light.com`

### Access

- View which authenticated users are allowed to use the system.
- Enable/disable access for a user.
- Reset access through the existing Supabase Auth flow rather than storing passwords in the application.

### Notifications

- View registered browser/device subscriptions for authorized users.
- Remove stale or unwanted notification devices.
- See whether browser notifications are enabled.

### Subscription

- View current plan, billing cycle, status, and renewal date.
- Manually update status while external payment is used.
- Later add a Paystack reference once payment integration is chosen.

### Health / usage

- Inbound message count.
- Outbound message count.
- Failed send count if available.
- Recent webhook errors.
- Storage usage once attachments are enabled.

## Non-goals

This deployment should not gain:

- multi-tenant organizations
- customer provisioning
- cross-company tenants
- commercial SaaS admin
- platform-wide billing engine
- public tenant/domain onboarding

## Suggested implementation sequence

1. Add explicit admin/member role storage.
2. Add server-side admin authorization helper.
3. Build `/admin` shell and navigation.
4. Add mailbox management.
5. Add access management.
6. Add notification-device management.
7. Add subscription/usage panel.
8. Add audit log for admin actions.
9. Test role boundaries before enabling production access.
