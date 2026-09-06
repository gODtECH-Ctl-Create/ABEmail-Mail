create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_notifications boolean not null default true,
  browser_notifications boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

create policy "users can read their notification preferences"
  on public.notification_preferences for select
  to authenticated
  using (auth.uid() = user_id);

create policy "users can insert their notification preferences"
  on public.notification_preferences for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "users can update their notification preferences"
  on public.notification_preferences for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_name text not null default 'Waste2Light',
  plan_name text not null default 'ABEmail Business',
  billing_cycle text not null default 'monthly' check (billing_cycle in ('monthly','yearly')),
  status text not null default 'setup' check (status in ('setup','active','past_due','cancelled','suspended')),
  currency text not null default 'NGN',
  monthly_price numeric(12,2),
  yearly_price numeric(12,2),
  starts_at timestamptz,
  renews_at timestamptz,
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.billing_subscriptions enable row level security;

create policy "authenticated users can view billing subscription"
  on public.billing_subscriptions for select
  to authenticated
  using (true);

insert into public.billing_subscriptions (organization_name, plan_name, billing_cycle, status, currency)
select 'Waste2Light', 'ABEmail Business', 'monthly', 'setup', 'NGN'
where not exists (select 1 from public.billing_subscriptions);
