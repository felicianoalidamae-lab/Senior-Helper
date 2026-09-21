-- Minimal stand-in for the parts of Supabase's `auth` schema our
-- migrations/tests depend on, so they can be syntax- and logic-checked
-- against a plain local Postgres. NOT part of the real migration set —
-- never apply this against an actual Supabase project (it already has a
-- real, fuller auth schema).
create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text
);

create or replace function auth.uid() returns uuid as $$
  select nullif(current_setting('request.jwt.claims', true)::json->>'sub', '')::uuid
$$ language sql stable;

create or replace function auth.role() returns text as $$
  select coalesce(current_setting('request.jwt.claims', true)::json->>'role', current_user)
$$ language sql stable;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role bypassrls;
  end if;
end $$;

grant anon to current_user;
grant authenticated to current_user;
grant service_role to current_user;
grant usage on schema auth to anon, authenticated, service_role;
grant select on auth.users to anon, authenticated, service_role;

-- A real Supabase project grants these on the public schema out of the
-- box; RLS policies then narrow what each role can actually see/touch.
-- Re-run after the migrations too, since it only covers tables/sequences
-- that exist at the moment it runs.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to anon, authenticated, service_role;
