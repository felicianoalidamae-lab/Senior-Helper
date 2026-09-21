-- Senior Helpers Time Tracker: core schema (spec §5)
create extension if not exists pgcrypto;

create type user_role as enum ('owner', 'employee');
create type employee_status as enum ('active', 'inactive');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'employee',
  full_name text not null,
  email text not null unique,
  position text,
  phone text,
  start_date date,
  status employee_status not null default 'active',
  created_at timestamptz not null default now()
);

create table pay_rates (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references profiles(id) on delete cascade,
  hourly_rate_cents integer not null check (hourly_rate_cents >= 0),
  effective_from date not null,
  created_at timestamptz not null default now(),
  unique (employee_id, effective_from)
);
create index on pay_rates (employee_id, effective_from desc);

create table time_entries (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references profiles(id) on delete cascade,
  work_date date not null,
  clock_in timestamptz not null,
  clock_out timestamptz,
  source text not null default 'live' check (source in ('live', 'manual')),
  edited_by uuid references profiles(id),
  edited_at timestamptz,
  edit_note text,
  created_at timestamptz not null default now(),
  check (clock_out is null or clock_out > clock_in)
);
create unique index one_open_entry_per_employee
  on time_entries (employee_id) where clock_out is null;
create index on time_entries (employee_id, work_date);

create table breaks (
  id uuid primary key default gen_random_uuid(),
  time_entry_id uuid not null references time_entries(id) on delete cascade,
  break_start timestamptz not null,
  break_end timestamptz,
  check (break_end is null or break_end > break_start)
);
create unique index one_open_break_per_entry
  on breaks (time_entry_id) where break_end is null;
create index on breaks (time_entry_id);

create type leave_type as enum ('sick', 'emergency', 'vacation');
create type leave_status as enum ('pending', 'approved', 'declined', 'cancelled');

create table leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references profiles(id) on delete cascade,
  type leave_type not null,
  start_date date not null,
  end_date date not null,
  reason text not null check (length(trim(reason)) > 0),
  status leave_status not null default 'pending',
  decided_by uuid references profiles(id),
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create index on leave_requests (employee_id, status);
create index on leave_requests (status, start_date);

create table settings (
  id boolean primary key default true check (id),
  business_name text not null default 'Senior Helpers',
  timezone text not null default 'America/New_York',
  pay_period_anchor date not null default current_date,
  pay_period_days integer not null default 14,
  shift_target_minutes integer not null default 480,
  breaks_unpaid boolean not null default true,
  work_days integer[] not null default '{1,2,3,4,5}',
  paid_leave_types leave_type[] not null default '{sick,emergency,vacation}',
  week_start_day integer not null default 1,
  weekly_ot_threshold_minutes integer not null default 2400,
  daily_ot_threshold_minutes integer,
  overtime_multiplier_pct integer not null default 100
);

insert into settings (id) values (true);
