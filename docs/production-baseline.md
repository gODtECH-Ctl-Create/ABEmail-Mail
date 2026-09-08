# Production Baseline

The `main` branch is the production baseline for ABEmail Mail. Feature work is developed on isolated branches and merged only after build and acceptance checks pass.

Current production baseline areas include the authenticated mailbox, Admin operations, Spam, Scheduled Messages, security hardening, private attachments, and the existing Resend/Supabase/Vercel deployment model.

Feature branches should not be deployed to the production domain unless explicitly promoted after review.