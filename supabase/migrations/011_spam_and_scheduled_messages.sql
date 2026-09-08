alter table public.email_messages
  add column if not exists is_spam boolean not null default false;

create index if not exists email_messages_spam_idx
  on public.email_messages(is_spam);

create table if not exists public.scheduled_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  from_address text not null,
  to_addresses text[] not null default '{}',
  cc_addresses text[] not null default '{}',
  bcc_addresses text[] not null default '{}',
  reply_to text[] not null default '{}',
  subject text not null default '(no subject)',
  html_body text not null default '',
  text_body text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  scheduled_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','processing','sent','cancelled','failed')),
  provider_message_id text,
  attempts integer not null default 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists scheduled_messages_due_idx
  on public.scheduled_messages(status, scheduled_at);

create index if not exists scheduled_messages_user_idx
  on public.scheduled_messages(user_id, scheduled_at desc);

alter table public.scheduled_messages enable row level security;

create policy "users can read their scheduled messages"
  on public.scheduled_messages for select
  to authenticated
  using (auth.uid() = user_id);

create policy "users can create their scheduled messages"
  on public.scheduled_messages for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "users can update their scheduled messages"
  on public.scheduled_messages for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users can delete their scheduled messages"
  on public.scheduled_messages for delete
  to authenticated
  using (auth.uid() = user_id);
