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
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.email_drafts
  add column if not exists attachments jsonb not null default '[]'::jsonb;

create index if not exists email_drafts_user_updated_at_idx
  on public.email_drafts(user_id, updated_at desc);

alter table public.email_drafts enable row level security;

drop policy if exists "users can read their drafts" on public.email_drafts;
drop policy if exists "users can insert their drafts" on public.email_drafts;
drop policy if exists "users can update their drafts" on public.email_drafts;
drop policy if exists "users can delete their drafts" on public.email_drafts;

create policy "users can read their drafts"
  on public.email_drafts for select to authenticated
  using (auth.uid() = user_id);
create policy "users can insert their drafts"
  on public.email_drafts for insert to authenticated
  with check (auth.uid() = user_id);
create policy "users can update their drafts"
  on public.email_drafts for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "users can delete their drafts"
  on public.email_drafts for delete to authenticated
  using (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit)
values ('abemail-attachments', 'abemail-attachments', false, 26214400)
on conflict (id) do update
set public = false,
    file_size_limit = 26214400;

drop policy if exists "ABEmail users can upload own attachments" on storage.objects;
drop policy if exists "ABEmail users can read own attachments" on storage.objects;
drop policy if exists "ABEmail users can delete own attachments" on storage.objects;

create policy "ABEmail users can upload own attachments"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'abemail-attachments'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
create policy "ABEmail users can read own attachments"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'abemail-attachments'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
create policy "ABEmail users can delete own attachments"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'abemail-attachments'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
