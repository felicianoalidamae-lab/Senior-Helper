-- today_board() should list workers (employees), not owner accounts that
-- happen to have a profile row but never clock in/out.
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
  where p.status = 'active' and p.role = 'employee'
  order by p.full_name;
end;
$$;
