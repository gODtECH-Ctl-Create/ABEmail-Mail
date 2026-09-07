create extension if not exists pgcrypto;

create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  incident_key text not null unique,
  title text not null,
  severity text not null check (severity in ('P1','P2','P3','P4')) default 'P3',
  status text not null check (status in ('detected','investigating','mitigated','resolved','closed')) default 'detected',
  component text,
  summary text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz,
  closed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists incidents_status_idx on public.incidents(status);
create index if not exists incidents_severity_idx on public.incidents(severity);
create index if not exists incidents_last_seen_idx on public.incidents(last_seen_at desc);

create table if not exists public.incident_events (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  event_type text not null,
  source text,
  message text,
  request_id text,
  deployment_id text,
  provider_event_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists incident_events_incident_idx on public.incident_events(incident_id, created_at desc);
create index if not exists incident_events_provider_idx on public.incident_events(provider_event_id);

create table if not exists public.system_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  severity text not null check (severity in ('info','warning','error','critical')) default 'info',
  component text,
  action text,
  message text,
  request_id text,
  trace_id text,
  deployment_id text,
  provider text,
  provider_event_id text,
  user_id uuid references auth.users(id) on delete set null,
  mailbox text,
  route text,
  http_status integer,
  duration_ms integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists system_events_created_at_idx on public.system_events(created_at desc);
create index if not exists system_events_severity_idx on public.system_events(severity, created_at desc);
create index if not exists system_events_component_idx on public.system_events(component, created_at desc);
create index if not exists system_events_request_idx on public.system_events(request_id);

create table if not exists public.user_issue_reports (
  id uuid primary key default gen_random_uuid(),
  report_key text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  mailbox text,
  incident_id uuid references public.incidents(id) on delete set null,
  route text,
  action text,
  description text,
  safe_error_code text,
  safe_error_message text,
  http_status integer,
  request_id text,
  trace_id text,
  deployment_id text,
  provider_event_id text,
  browser text,
  device text,
  timezone text,
  screenshot_path text,
  status text not null check (status in ('new','acknowledged','investigating','resolved','closed')) default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_issue_reports_status_idx on public.user_issue_reports(status, created_at desc);
create index if not exists user_issue_reports_incident_idx on public.user_issue_reports(incident_id);
create index if not exists user_issue_reports_user_idx on public.user_issue_reports(user_id, created_at desc);

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_created_at_idx on public.admin_audit_log(created_at desc);
create index if not exists admin_audit_log_admin_idx on public.admin_audit_log(admin_user_id, created_at desc);

alter table public.incidents enable row level security;
alter table public.incident_events enable row level security;
alter table public.system_events enable row level security;
alter table public.user_issue_reports enable row level security;
alter table public.admin_audit_log enable row level security;

-- Admin and monitoring data are accessed through authenticated server routes using the service role.
-- No direct client read/write policies are intentionally granted here.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists incidents_set_updated_at on public.incidents;
create trigger incidents_set_updated_at
before update on public.incidents
for each row execute function public.set_updated_at();

drop trigger if exists user_issue_reports_set_updated_at on public.user_issue_reports;
create trigger user_issue_reports_set_updated_at
before update on public.user_issue_reports
for each row execute function public.set_updated_at();
