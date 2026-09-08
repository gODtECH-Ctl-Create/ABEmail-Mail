create table if not exists public.email_signatures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mailbox_address text not null,
  name text not null,
  html_body text not null default '',
  text_body text not null default '',
  enabled boolean not null default true,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists email_signatures_user_mailbox_idx
  on public.email_signatures(user_id, lower(mailbox_address));

create index if not exists email_signatures_user_default_idx
  on public.email_signatures(user_id, mailbox_address, is_default)
  where is_default = true;

alter table public.email_signatures enable row level security;

drop policy if exists "users can read their email signatures" on public.email_signatures;
drop policy if exists "users can create their email signatures" on public.email_signatures;
drop policy if exists "users can update their email signatures" on public.email_signatures;
drop policy if exists "users can delete their email signatures" on public.email_signatures;

create policy "users can read their email signatures"
  on public.email_signatures for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "users can create their email signatures"
  on public.email_signatures for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "users can update their email signatures"
  on public.email_signatures for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "users can delete their email signatures"
  on public.email_signatures for delete to authenticated
  using ((select auth.uid()) = user_id);
