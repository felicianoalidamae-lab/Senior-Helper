-- RLS / SQL behavior tests (spec §5, §9).
--
-- Run against a disposable local Supabase Postgres (after the migrations in
-- supabase/migrations/ have been applied), as the postgres superuser:
--
--   npx supabase db reset   # applies migrations, then seed.sql if present
--   psql "$(npx supabase status -o env | grep DB_URL | cut -d= -f2)" \
--        -f supabase/tests/rls.sql
--
-- Each check RAISEs on failure, so a clean run with no output past the
-- final NOTICE means every assertion passed. Deliberately NOT wrapped in
-- one transaction: clock_in/start_break/clock_out need to run as separate
-- statements (each gets its own now()) the way separate RPC calls from the
-- browser would, and login switches use session-level SET so they persist
-- across those separate statements. Cleanup happens explicitly at the end.

-- Three fake auth users: one owner, two employees.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'owner@test.local'),
  ('00000000-0000-0000-0000-0000000000a1', 'alice@test.local'),
  ('00000000-0000-0000-0000-0000000000b1', 'bob@test.local');

insert into profiles (id, role, full_name, email) values
  ('00000000-0000-0000-0000-000000000001', 'owner', 'Owner', 'owner@test.local'),
  ('00000000-0000-0000-0000-0000000000a1', 'employee', 'Alice', 'alice@test.local'),
  ('00000000-0000-0000-0000-0000000000b1', 'employee', 'Bob', 'bob@test.local');

insert into pay_rates (employee_id, hourly_rate_cents, effective_from) values
  ('00000000-0000-0000-0000-0000000000a1', 2000, '2020-01-01'),
  ('00000000-0000-0000-0000-0000000000b1', 2200, '2020-01-01');

-- Helper to switch the simulated logged-in user for the rest of the
-- session (SET, not SET LOCAL, so it survives past this statement).
create or replace function _test_login(p_user uuid) returns void as $$
begin
  execute 'set role authenticated';
  execute format('set request.jwt.claims = %L', json_build_object('sub', p_user, 'role', 'authenticated')::text);
end;
$$ language plpgsql;

-- 1. Employee A cannot read employee B's profile row.
select _test_login('00000000-0000-0000-0000-0000000000a1');
do $$
begin
  if exists (select 1 from profiles where id = '00000000-0000-0000-0000-0000000000b1') then
    raise exception 'FAIL: employee A can read employee B profile';
  end if;
  raise notice 'PASS: employee A cannot read employee B profile';
end $$;

-- 2. Employee A cannot read employee B's pay rate.
do $$
begin
  if exists (select 1 from pay_rates where employee_id = '00000000-0000-0000-0000-0000000000b1') then
    raise exception 'FAIL: employee A can read employee B pay rate';
  end if;
  raise notice 'PASS: employee A cannot read employee B pay rate';
end $$;

-- 3. Employee A can clock themselves in, and only themselves.
select clock_in();
do $$
begin
  if not exists (
    select 1 from time_entries
    where employee_id = '00000000-0000-0000-0000-0000000000a1' and clock_out is null
  ) then
    raise exception 'FAIL: clock_in() did not create an open entry for the caller';
  end if;
  raise notice 'PASS: clock_in() opens an entry for the caller';
end $$;

-- 4. A second clock_in() while already clocked in fails.
do $$
declare
  v_unexpectedly_succeeded boolean := false;
begin
  begin
    perform clock_in();
    v_unexpectedly_succeeded := true;
  exception when others then
    null;
  end;
  if v_unexpectedly_succeeded then
    raise exception 'FAIL: second clock_in() should have raised';
  end if;
  raise notice 'PASS: second clock_in() was rejected';
end $$;

-- 5. Employee A cannot see employee B's time entries.
do $$
begin
  if exists (select 1 from time_entries where employee_id <> '00000000-0000-0000-0000-0000000000a1') then
    raise exception 'FAIL: employee A can see another employee''s time entries';
  end if;
  raise notice 'PASS: employee A only sees their own time entries';
end $$;

-- 6. Employee A cannot insert a time entry directly (bypassing clock_in()).
do $$
declare
  v_unexpectedly_succeeded boolean := false;
begin
  begin
    insert into time_entries (employee_id, work_date, clock_in)
    values ('00000000-0000-0000-0000-0000000000a1', current_date, now());
    v_unexpectedly_succeeded := true;
  exception when insufficient_privilege then
    null;
  end;
  if v_unexpectedly_succeeded then
    raise exception 'FAIL: direct insert into time_entries succeeded';
  end if;
  raise notice 'PASS: direct insert into time_entries was rejected by RLS';
end $$;

-- 7. Employee A cannot clock in "for" employee B (functions only ever use auth.uid()).
do $$
begin
  if exists (
    select 1 from time_entries where employee_id = '00000000-0000-0000-0000-0000000000b1'
  ) then
    raise exception 'FAIL: employee B has a time entry despite never having clocked in';
  end if;
  raise notice 'PASS: clock_in() cannot be used to clock another employee in';
end $$;

-- 8. clock_out() closes an open break at the same time it closes the entry.
select start_break();
select pg_sleep(0.01);
select clock_out();
do $$
declare
  v_open_break_count int;
  v_entry_open boolean;
begin
  select count(*) into v_open_break_count from breaks b
  join time_entries te on te.id = b.time_entry_id
  where te.employee_id = '00000000-0000-0000-0000-0000000000a1' and b.break_end is null;

  select exists (
    select 1 from time_entries
    where employee_id = '00000000-0000-0000-0000-0000000000a1' and clock_out is null
  ) into v_entry_open;

  if v_open_break_count <> 0 or v_entry_open then
    raise exception 'FAIL: clock_out() left an open break or an open entry';
  end if;
  raise notice 'PASS: clock_out() closes any open break and the entry itself';
end $$;

-- 9. Employee A cannot read employee B's leave requests, and cannot decide their own.
reset role;
insert into leave_requests (employee_id, type, start_date, end_date, reason)
  values ('00000000-0000-0000-0000-0000000000b1', 'vacation', current_date, current_date, 'test');
select _test_login('00000000-0000-0000-0000-0000000000a1');

do $$
begin
  if exists (select 1 from leave_requests where employee_id = '00000000-0000-0000-0000-0000000000b1') then
    raise exception 'FAIL: employee A can read employee B leave request';
  end if;
  raise notice 'PASS: employee A cannot read employee B leave request';
end $$;

do $$
declare
  v_unexpectedly_succeeded boolean := false;
begin
  begin
    perform decide_leave_request(
      (select id from leave_requests limit 1), 'approved', null
    );
    v_unexpectedly_succeeded := true;
  exception when others then
    null;
  end;
  if v_unexpectedly_succeeded then
    raise exception 'FAIL: employee A was able to decide a leave request';
  end if;
  raise notice 'PASS: employee A cannot decide leave requests';
end $$;

-- 10. Owner can read and act on everything.
select _test_login('00000000-0000-0000-0000-000000000001');
do $$
declare
  v_count int;
begin
  select count(*) into v_count from profiles;
  if v_count <> 3 then
    raise exception 'FAIL: owner cannot see all profiles (saw %)', v_count;
  end if;
  raise notice 'PASS: owner sees all profiles';
end $$;

do $$
declare
  v_id uuid;
begin
  select id into v_id from leave_requests where employee_id = '00000000-0000-0000-0000-0000000000b1';
  perform decide_leave_request(v_id, 'approved', null);
  raise notice 'PASS: owner can decide a leave request';
end $$;

do $$
begin
  perform admin_add_time_entry(
    '00000000-0000-0000-0000-0000000000b1',
    now() - interval '8 hours',
    now(),
    'backfilled for testing'
  );
  raise notice 'PASS: owner can add a manual time entry with a note';
end $$;

do $$
declare
  v_unexpectedly_succeeded boolean := false;
begin
  begin
    perform admin_add_time_entry(
      '00000000-0000-0000-0000-0000000000b1', now() - interval '1 hour', now(), ''
    );
    v_unexpectedly_succeeded := true;
  exception when others then
    null;
  end;
  if v_unexpectedly_succeeded then
    raise exception 'FAIL: admin_add_time_entry accepted an empty note';
  end if;
  raise notice 'PASS: admin_add_time_entry requires a non-empty note';
end $$;

-- Cleanup: back to the superuser role. Delete rows that reference
-- profiles via a plain (non-cascading) foreign key -- edited_by,
-- decided_by -- before deleting the profiles/auth.users rows themselves.
reset role;
reset request.jwt.claims;
delete from time_entries where employee_id in (
  select id from profiles where email in ('owner@test.local', 'alice@test.local', 'bob@test.local')
);
delete from leave_requests where employee_id in (
  select id from profiles where email in ('owner@test.local', 'alice@test.local', 'bob@test.local')
);
delete from auth.users where email in ('owner@test.local', 'alice@test.local', 'bob@test.local');
drop function _test_login(uuid);
