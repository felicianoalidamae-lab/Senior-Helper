-- Business-timezone "today" as a date, per settings.timezone.
create or replace function business_today()
returns date
language sql
stable
as $$
  select (now() at time zone (select timezone from settings))::date;
$$;

create or replace function business_date(ts timestamptz)
returns date
language sql
stable
as $$
  select (ts at time zone (select timezone from settings))::date;
$$;

-- ---------------------------------------------------------------------
-- Employee clock actions. Server clock only: no client-supplied timestamp
-- is ever accepted here, so employees can't manipulate their own times.
-- ---------------------------------------------------------------------

create or replace function clock_in()
returns time_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee profiles;
  v_entry time_entries;
begin
  select * into v_employee from profiles where id = auth.uid();
  if v_employee is null or v_employee.status <> 'active' then
    raise exception 'Only active employees can clock in.' using errcode = 'P0001';
  end if;

  if exists (select 1 from time_entries where employee_id = auth.uid() and clock_out is null) then
    raise exception 'You are already clocked in.' using errcode = 'P0001';
  end if;

  insert into time_entries (employee_id, work_date, clock_in, source)
  values (auth.uid(), business_date(now()), now(), 'live')
  returning * into v_entry;

  return v_entry;
end;
$$;

create or replace function start_break()
returns breaks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry_id uuid;
  v_break breaks;
begin
  select id into v_entry_id from time_entries
  where employee_id = auth.uid() and clock_out is null;

  if v_entry_id is null then
    raise exception 'You are not clocked in.' using errcode = 'P0001';
  end if;

  if exists (select 1 from breaks where time_entry_id = v_entry_id and break_end is null) then
    raise exception 'You are already on a break.' using errcode = 'P0001';
  end if;

  insert into breaks (time_entry_id, break_start)
  values (v_entry_id, now())
  returning * into v_break;

  return v_break;
end;
$$;

create or replace function end_break()
returns breaks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry_id uuid;
  v_break breaks;
begin
  select id into v_entry_id from time_entries
  where employee_id = auth.uid() and clock_out is null;

  if v_entry_id is null then
    raise exception 'You are not clocked in.' using errcode = 'P0001';
  end if;

  update breaks
  set break_end = now()
  where time_entry_id = v_entry_id and break_end is null
  returning * into v_break;

  if v_break is null then
    raise exception 'You are not on a break.' using errcode = 'P0001';
  end if;

  return v_break;
end;
$$;

create or replace function clock_out()
returns time_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry time_entries;
begin
  select * into v_entry from time_entries
  where employee_id = auth.uid() and clock_out is null
  for update;

  if v_entry is null then
    raise exception 'You are not clocked in.' using errcode = 'P0001';
  end if;

  -- Close any open break at the same instant clock_out is recorded.
  update breaks
  set break_end = now()
  where time_entry_id = v_entry.id and break_end is null;

  update time_entries
  set clock_out = now()
  where id = v_entry.id
  returning * into v_entry;

  return v_entry;
end;
$$;

-- Status for one employee: working | on_break | clocked_out | not_in.
-- An open entry (even from a previous day, i.e. a missed clock-out) still
-- reads as working/on_break; the UI surfaces a separate "missed clock-out"
-- banner for that case.
create or replace function current_status(p_employee uuid default auth.uid())
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_open_entry_id uuid;
  v_has_open_break boolean;
  v_clocked_out_today boolean;
begin
  select id into v_open_entry_id from time_entries
  where employee_id = p_employee and clock_out is null;

  if v_open_entry_id is not null then
    select exists (
      select 1 from breaks where time_entry_id = v_open_entry_id and break_end is null
    ) into v_has_open_break;
    return case when v_has_open_break then 'on_break' else 'working' end;
  end if;

  select exists (
    select 1 from time_entries
    where employee_id = p_employee
      and work_date = business_today()
      and clock_out is not null
  ) into v_clocked_out_today;

  if v_clocked_out_today then
    return 'clocked_out';
  end if;

  return 'not_in';
end;
$$;

grant execute on function current_status(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Owner-only manual time entry edits. edit_note is mandatory so every
-- correction is auditable.
-- ---------------------------------------------------------------------

create or replace function admin_add_time_entry(
  p_employee_id uuid,
  p_clock_in timestamptz,
  p_clock_out timestamptz,
  p_note text
)
returns time_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry time_entries;
begin
  if not is_owner() then
    raise exception 'Only the owner can add time entries.' using errcode = 'P0001';
  end if;
  if p_note is null or length(trim(p_note)) = 0 then
    raise exception 'A note is required.' using errcode = 'P0001';
  end if;
  if p_clock_out is not null and p_clock_out <= p_clock_in then
    raise exception 'Clock out must be after clock in.' using errcode = 'P0001';
  end if;

  insert into time_entries (
    employee_id, work_date, clock_in, clock_out, source, edited_by, edited_at, edit_note
  ) values (
    p_employee_id, business_date(p_clock_in), p_clock_in, p_clock_out, 'manual', auth.uid(), now(), p_note
  )
  returning * into v_entry;

  return v_entry;
end;
$$;

create or replace function admin_edit_time_entry(
  p_id uuid,
  p_clock_in timestamptz,
  p_clock_out timestamptz,
  p_note text
)
returns time_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry time_entries;
begin
  if not is_owner() then
    raise exception 'Only the owner can edit time entries.' using errcode = 'P0001';
  end if;
  if p_note is null or length(trim(p_note)) = 0 then
    raise exception 'A note is required.' using errcode = 'P0001';
  end if;
  if p_clock_out is not null and p_clock_out <= p_clock_in then
    raise exception 'Clock out must be after clock in.' using errcode = 'P0001';
  end if;

  update time_entries
  set clock_in = p_clock_in,
      clock_out = p_clock_out,
      work_date = business_date(p_clock_in),
      source = 'manual',
      edited_by = auth.uid(),
      edited_at = now(),
      edit_note = p_note
  where id = p_id
  returning * into v_entry;

  if v_entry is null then
    raise exception 'Time entry not found.' using errcode = 'P0001';
  end if;

  return v_entry;
end;
$$;

-- ---------------------------------------------------------------------
-- Leave: employees submit via a plain insert (RLS policy in 0002); these
-- functions handle the state transitions that need auditing.
-- ---------------------------------------------------------------------

create or replace function cancel_leave_request(p_id uuid)
returns leave_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row leave_requests;
begin
  update leave_requests
  set status = 'cancelled'
  where id = p_id and employee_id = auth.uid() and status = 'pending'
  returning * into v_row;

  if v_row is null then
    raise exception 'Only your own pending requests can be cancelled.' using errcode = 'P0001';
  end if;

  return v_row;
end;
$$;

create or replace function decide_leave_request(
  p_id uuid,
  p_decision leave_status,
  p_note text default null
)
returns leave_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row leave_requests;
begin
  if not is_owner() then
    raise exception 'Only the owner can decide leave requests.' using errcode = 'P0001';
  end if;
  if p_decision not in ('approved', 'declined') then
    raise exception 'Decision must be approved or declined.' using errcode = 'P0001';
  end if;
  if p_decision = 'declined' and (p_note is null or length(trim(p_note)) = 0) then
    raise exception 'A note is required when declining.' using errcode = 'P0001';
  end if;

  update leave_requests
  set status = p_decision,
      decided_by = auth.uid(),
      decided_at = now(),
      decision_note = p_note
  where id = p_id and status = 'pending'
  returning * into v_row;

  if v_row is null then
    raise exception 'Leave request not found or already decided.' using errcode = 'P0001';
  end if;

  return v_row;
end;
$$;

create or replace function cancel_approved_leave(p_id uuid, p_note text)
returns leave_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row leave_requests;
begin
  if not is_owner() then
    raise exception 'Only the owner can cancel approved leave.' using errcode = 'P0001';
  end if;

  update leave_requests
  set status = 'cancelled',
      decided_by = auth.uid(),
      decided_at = now(),
      decision_note = coalesce(p_note, decision_note)
  where id = p_id and status = 'approved'
  returning * into v_row;

  if v_row is null then
    raise exception 'Approved leave request not found.' using errcode = 'P0001';
  end if;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------
-- Today board: minimal, privacy-safe status feed for every signed-in
-- user (§5 "today_board"). Never exposes leave type/reason to coworkers.
-- ---------------------------------------------------------------------

create or replace function today_board()
returns table (
  employee_id uuid,
  full_name text,
  "position" text,
  status text,
  since timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
  select
    p.id,
    p.full_name,
    p.position,
    case
      when cs.status in ('working', 'on_break') then cs.status
      when on_leave.employee_id is not null then 'on_leave'
      else cs.status
    end as status,
    case
      when cs.status = 'on_break' then (
        select b.break_start from breaks b
        join time_entries te on te.id = b.time_entry_id
        where te.employee_id = p.id and te.clock_out is null and b.break_end is null
        limit 1
      )
      when cs.status = 'working' then (
        select te.clock_in from time_entries te
        where te.employee_id = p.id and te.clock_out is null
        limit 1
      )
      when cs.status = 'clocked_out' then (
        select te.clock_out from time_entries te
        where te.employee_id = p.id and te.work_date = business_today() and te.clock_out is not null
        order by te.clock_out desc
        limit 1
      )
      else null
    end as since
  from profiles p
  cross join lateral (select current_status(p.id) as status) cs
  left join lateral (
    select lr.employee_id from leave_requests lr
    where lr.employee_id = p.id
      and lr.status = 'approved'
      and business_today() between lr.start_date and lr.end_date
    limit 1
  ) on_leave on true
  where p.status = 'active'
  order by p.full_name;
end;
$$;

grant execute on function today_board() to authenticated;

-- Explicit grants: security-definer functions are PUBLIC-executable by
-- default in Postgres, so lock every one of them down to signed-in users.
-- Each function still checks the caller's role/ownership internally.
revoke execute on function clock_in() from public;
revoke execute on function start_break() from public;
revoke execute on function end_break() from public;
revoke execute on function clock_out() from public;
revoke execute on function admin_add_time_entry(uuid, timestamptz, timestamptz, text) from public;
revoke execute on function admin_edit_time_entry(uuid, timestamptz, timestamptz, text) from public;
revoke execute on function cancel_leave_request(uuid) from public;
revoke execute on function decide_leave_request(uuid, leave_status, text) from public;
revoke execute on function cancel_approved_leave(uuid, text) from public;

grant execute on function clock_in() to authenticated;
grant execute on function start_break() to authenticated;
grant execute on function end_break() to authenticated;
grant execute on function clock_out() to authenticated;
grant execute on function admin_add_time_entry(uuid, timestamptz, timestamptz, text) to authenticated;
grant execute on function admin_edit_time_entry(uuid, timestamptz, timestamptz, text) to authenticated;
grant execute on function cancel_leave_request(uuid) to authenticated;
grant execute on function decide_leave_request(uuid, leave_status, text) to authenticated;
grant execute on function cancel_approved_leave(uuid, text) to authenticated;
