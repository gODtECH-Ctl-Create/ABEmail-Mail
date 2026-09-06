alter table public.email_messages
  add column if not exists is_read boolean not null default false,
  add column if not exists is_starred boolean not null default false,
  add column if not exists is_trashed boolean not null default false;

update public.email_messages
set is_read = true
where direction = 'outbound' and is_read = false;

create index if not exists email_messages_read_idx
  on public.email_messages(is_read);

create index if not exists email_messages_starred_idx
  on public.email_messages(is_starred);

create index if not exists email_messages_trashed_idx
  on public.email_messages(is_trashed);
