-- Preserve existing authorization semantics while using initplan-friendly auth lookups.
alter policy "users can delete their drafts" on public.email_drafts
  using ((select auth.uid()) = user_id);

alter policy "users can insert their drafts" on public.email_drafts
  with check ((select auth.uid()) = user_id);

alter policy "users can read their drafts" on public.email_drafts
  using ((select auth.uid()) = user_id);

alter policy "users can update their drafts" on public.email_drafts
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "users can insert their notification preferences" on public.notification_preferences
  with check ((select auth.uid()) = user_id);

alter policy "users can read their notification preferences" on public.notification_preferences
  using ((select auth.uid()) = user_id);

alter policy "users can update their notification preferences" on public.notification_preferences
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "users can create their scheduled messages" on public.scheduled_messages
  with check ((select auth.uid()) = user_id);

alter policy "users can delete their scheduled messages" on public.scheduled_messages
  using ((select auth.uid()) = user_id);

alter policy "users can read their scheduled messages" on public.scheduled_messages
  using ((select auth.uid()) = user_id);

alter policy "users can update their scheduled messages" on public.scheduled_messages
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create index if not exists system_events_user_id_idx
  on public.system_events(user_id);

create table if not exists public.api_rate_limits (
  bucket_key text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.api_rate_limits enable row level security;

create or replace function public.consume_api_rate_limit(
  p_key text,
  p_window_seconds integer,
  p_max_requests integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_count integer;
begin
  if length(p_key) < 1 or length(p_key) > 200 then
    raise exception 'Invalid rate-limit key';
  end if;
  if p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'Invalid rate-limit window';
  end if;
  if p_max_requests < 1 or p_max_requests > 1000 then
    raise exception 'Invalid rate-limit maximum';
  end if;

  insert into public.api_rate_limits(bucket_key, window_started_at, request_count, updated_at)
  values (p_key, now(), 1, now())
  on conflict (bucket_key) do update
    set request_count = case
      when now() - api_rate_limits.window_started_at >= make_interval(secs => p_window_seconds)
        then 1
      else api_rate_limits.request_count + 1
    end,
    window_started_at = case
      when now() - api_rate_limits.window_started_at >= make_interval(secs => p_window_seconds)
        then now()
      else api_rate_limits.window_started_at
    end,
    updated_at = now()
  returning request_count into current_count;

  return current_count <= p_max_requests;
end;
$$;

revoke all on function public.consume_api_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, integer, integer) to service_role;
