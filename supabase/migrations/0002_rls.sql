-- Row Level Security. All mutations of time_entries, breaks, and
-- leave_requests decisions go through the security-definer functions in
-- 0003_functions.sql instead of raw table policies, so audit fields
-- (edited_by/edited_at/edit_note, decided_by/decided_at) can never be
-- bypassed by a direct insert/update from a client.

create or replace function is_owner()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'owner'
  );
$$;

create or replace function current_employee_id()
returns uuid
language sql
stable
as $$
  select auth.uid();
$$;

alter table profiles enable row level security;
alter table pay_rates enable row level security;
alter table time_entries enable row level security;
alter table breaks enable row level security;
alter table leave_requests enable row level security;
alter table settings enable row level security;

-- profiles: owner sees/edits everyone; employee sees only their own row.
create policy profiles_select on profiles
  for select using (is_owner() or id = auth.uid());

create policy profiles_update_owner on profiles
  for update using (is_owner()) with check (is_owner());

-- No client-side insert policy: profiles are created by the invite Route
-- Handler using the service-role key, which bypasses RLS entirely.

-- pay_rates: owner full read + append-only insert; employee reads own history.
create policy pay_rates_select on pay_rates
  for select using (is_owner() or employee_id = auth.uid());

create policy pay_rates_insert_owner on pay_rates
  for insert with check (is_owner());

-- time_entries: read-only via RLS. All writes go through security-definer
-- functions (clock_in/start_break/end_break/clock_out for employees,
-- admin_add_time_entry/admin_edit_time_entry for owners).
create policy time_entries_select on time_entries
  for select using (is_owner() or employee_id = auth.uid());

-- breaks: same read-only-via-RLS pattern as time_entries.
create policy breaks_select on breaks
  for select using (
    is_owner()
    or exists (
      select 1 from time_entries te
      where te.id = breaks.time_entry_id and te.employee_id = auth.uid()
    )
  );

-- leave_requests: employees can read their own and submit new pending
-- requests; approve/decline/cancel go through security-definer functions
-- so decided_by/decided_at/decision_note stay accurate.
create policy leave_requests_select on leave_requests
  for select using (is_owner() or employee_id = auth.uid());

create policy leave_requests_insert on leave_requests
  for insert with check (
    employee_id = auth.uid() and status = 'pending'
  );

-- settings: every signed-in user can read (needed for shift length, work
-- days, timezone, etc. on employee screens); only the owner can change them.
create policy settings_select on settings
  for select using (auth.role() = 'authenticated');

create policy settings_update_owner on settings
  for update using (is_owner()) with check (is_owner());
