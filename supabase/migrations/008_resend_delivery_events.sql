create table if not exists public.resend_email_events (
  id uuid primary key default gen_random_uuid(),
  svix_id text not null unique,
  event_type text not null,
  email_id text,
  event_created_at timestamptz,
  received_at timestamptz not null default now(),
  from_address text,
  to_addresses text[] not null default '{}',
  subject text,
  reason text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists resend_email_events_email_idx
  on public.resend_email_events(email_id, received_at desc);
create index if not exists resend_email_events_type_idx
  on public.resend_email_events(event_type, received_at desc);

alter table public.resend_email_events enable row level security;

alter table public.email_messages
  add column if not exists provider_status text,
  add column if not exists provider_status_at timestamptz,
  add column if not exists provider_error text,
  add column if not exists provider_event_id text;

create index if not exists email_messages_provider_status_idx
  on public.email_messages(provider_status, provider_status_at desc);
create index if not exists email_messages_provider_event_idx
  on public.email_messages(provider_event_id);
