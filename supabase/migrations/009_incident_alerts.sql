create table if not exists public.admin_alerts (
  id uuid primary key default gen_random_uuid(),
  alert_key text not null unique,
  incident_id uuid references public.incidents(id) on delete cascade,
  severity text not null check (severity in ('P1','P2','P3','P4')) default 'P3',
  title text not null,
  message text not null,
  status text not null check (status in ('new','acknowledged','resolved')) default 'new',
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists admin_alerts_status_idx on public.admin_alerts(status, created_at desc);
create index if not exists admin_alerts_incident_idx on public.admin_alerts(incident_id, created_at desc);

alter table public.admin_alerts enable row level security;

drop trigger if exists admin_alerts_set_updated_at on public.admin_alerts;
create trigger admin_alerts_set_updated_at
before update on public.admin_alerts
for each row execute function public.set_updated_at();
