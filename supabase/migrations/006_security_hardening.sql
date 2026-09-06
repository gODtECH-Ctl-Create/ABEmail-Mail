-- Security/performance hardening for the Waste2Light mail deployment.
-- Keep the shared-mailbox authorization model intact while avoiding per-row
-- re-evaluation of auth functions in Row Level Security policies.

alter policy "authenticated users can read their messages"
  on public.email_messages
  using (
    (select auth.uid()) = created_by
    or (select auth.jwt() ->> 'email') = any(to_addresses)
    or (select auth.jwt() ->> 'email') = from_address
  );

alter policy "users can read their notification preferences"
  on public.notification_preferences
  using ((select auth.uid()) = user_id);

alter policy "users can insert their notification preferences"
  on public.notification_preferences
  with check ((select auth.uid()) = user_id);

alter policy "users can update their notification preferences"
  on public.notification_preferences
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "users can read their drafts"
  on public.email_drafts
  using ((select auth.uid()) = user_id);

alter policy "users can insert their drafts"
  on public.email_drafts
  with check ((select auth.uid()) = user_id);

alter policy "users can update their drafts"
  on public.email_drafts
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "users can delete their drafts"
  on public.email_drafts
  using ((select auth.uid()) = user_id);
