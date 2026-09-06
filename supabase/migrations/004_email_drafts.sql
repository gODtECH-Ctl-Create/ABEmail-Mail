create table if not exists public.email_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  from_address text not null,
  to_addresses text[] not null default '{}',
  cc_addresses text[] not null default '{}',
  bcc_addresses text[] not null default '{}',
  subject text not null default '',
  html_body text not null default '',
  text_body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists email_drafts_user_updated_at_idx
  on public.email_drafts(user_id, updated_at desc);

alter table public.email_drafts enable row level security;

create policy "users can read their drafts"
  on public.email_drafts for select
  to authenticated
  using (auth.uid() = user_id);

create policy "users can insert their drafts"
  on public.email_drafts for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "users can update their drafts"
  on public.email_drafts for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users can delete their drafts"
  on public.email_drafts for delete
  to authenticated
  using (auth.uid() = user_id);
