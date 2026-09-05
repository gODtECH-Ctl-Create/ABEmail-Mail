create extension if not exists pgcrypto;

create table if not exists public.mailboxes (
  id uuid primary key default gen_random_uuid(),
  address text not null unique,
  display_name text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.email_messages (
  id uuid primary key default gen_random_uuid(),
  resend_email_id text unique,
  message_id text,
  direction text not null check (direction in ('inbound','outbound')),
  from_address text not null,
  to_addresses text[] not null default '{}',
  cc_addresses text[] not null default '{}',
  bcc_addresses text[] not null default '{}',
  reply_to text[] not null default '{}',
  subject text not null default '(no subject)',
  html_body text,
  text_body text,
  headers jsonb not null default '{}'::jsonb,
  attachments jsonb not null default '[]'::jsonb,
  status text not null default 'received',
  created_by uuid references auth.users(id) on delete set null,
  received_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists email_messages_created_at_idx on public.email_messages(created_at desc);
create index if not exists email_messages_to_addresses_idx on public.email_messages using gin(to_addresses);
create index if not exists email_messages_created_by_idx on public.email_messages(created_by);

alter table public.mailboxes enable row level security;
alter table public.email_messages enable row level security;

create policy "authenticated users can read mailboxes"
  on public.mailboxes for select
  to authenticated
  using (true);

create policy "authenticated users can read their messages"
  on public.email_messages for select
  to authenticated
  using (
    auth.uid() = created_by
    or (auth.jwt() ->> 'email') = any(to_addresses)
    or (auth.jwt() ->> 'email') = from_address
  );

insert into public.mailboxes(address, display_name) values
  ('info@waste2light.com', 'Info'),
  ('support@waste2light.com', 'Support'),
  ('admin@waste2light.com', 'Admin'),
  ('emmanuel.aba@waste2light.com', 'Emmanuel Aba')
on conflict (address) do nothing;
