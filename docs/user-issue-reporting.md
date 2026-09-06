# User Issue Reporting Design

When a Waste2Light mailbox user encounters an operational failure, ABEmail should offer a simple `Report an issue` action.

## Required behavior

- Report from the failure state without losing the user's context.
- Pre-fill safe diagnostic context automatically.
- Let the user add a short description.
- Optionally let the user attach a screenshot they intentionally choose.
- Link the report to an existing active incident when the system can correlate it.
- Otherwise create an incident candidate for ABE Tech Lab review.

## Diagnostic context

Capture:

- report ID
- timestamp and timezone
- authenticated user reference
- mailbox
- current view/route
- action being attempted
- safe error code/message
- HTTP status
- request/correlation ID when available
- Vercel deployment/version when available
- relevant email/provider ID when available
- coarse browser/device information

Never capture passwords, access tokens, full message bodies, or unnecessary sensitive data.

## Correlation

The reporting UI should use the request/correlation identifier from the failed operation when available. The backend should attempt to match the report against an open incident for the same component and time window. A report that matches an incident becomes evidence on that incident rather than creating a duplicate alert.

## Status flow

`Submitted -> Acknowledged -> Linked/Investigating -> Resolved -> Closed`

The user-facing status should remain simple while the admin view can expose the full incident relationship and technical evidence.
