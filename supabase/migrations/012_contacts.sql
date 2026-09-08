create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  company text not null default '',
  phone text not null default '',
  notes text not null default '',
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists contacts_user_email_unique_idx
  on public.contacts(user_id, lower(email));

create index if not exists contacts_user_name_idx
  on public.contacts(user_id, lower(name));

create index if not exists contacts_user_company_idx
  on public.contacts(user_id, lower(company));

create index if not exists contacts_user_updated_at_idx
  on public.contacts(user_id, updated_at desc);

alter table public.contacts enable row level security;

drop policy if exists "users can read their contacts" on public.contacts;
drop policy if exists "users can create their contacts" on public.contacts;
drop policy if exists "users can update their contacts" on public.contacts;
drop policy if exists "users can delete their contacts" on public.contacts;

create policy "users can read their contacts"
  on public.contacts for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "users can create their contacts"
  on public.contacts for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "users can update their contacts"
  on public.contacts for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "users can delete their contacts"
  on public.contacts for delete to authenticated
  using ((select auth.uid()) = user_id);
