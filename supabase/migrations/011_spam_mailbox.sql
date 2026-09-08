alter table public.email_messages
  add column if not exists is_spam boolean not null default false;

create index if not exists email_messages_spam_idx
  on public.email_messages(is_spam);
