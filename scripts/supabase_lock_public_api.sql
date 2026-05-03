-- Supabase Security Advisor fix for:
-- - rls_disabled_in_public
-- - sensitive_columns_exposed
--
-- WEXTheory does not use Supabase's browser Data API. The application server
-- connects to Postgres directly through DATABASE_URL, so the safest public API
-- posture is: no anon/authenticated access to public tables, and RLS enabled on
-- every public table.
--
-- Run this in Supabase Dashboard -> SQL Editor for project wex_theory-db.
-- After it finishes, open Database -> Security Advisor and run the check again.

begin;

-- 1) Enable Row-Level Security on every user table in the exposed public schema.
do $$
declare
  table_row record;
begin
  for table_row in
    select schemaname, tablename
    from pg_tables
    where schemaname = 'public'
  loop
    execute format(
      'alter table %I.%I enable row level security',
      table_row.schemaname,
      table_row.tablename
    );
  end loop;
end
$$;

-- 2) Remove Supabase Data API access for public browser roles.
-- With no Supabase client in this app, these roles should not read or mutate
-- application tables directly.
revoke all privileges on all tables in schema public from anon;
revoke all privileges on all tables in schema public from authenticated;
revoke all privileges on all sequences in schema public from anon;
revoke all privileges on all sequences in schema public from authenticated;
revoke all privileges on all functions in schema public from anon;
revoke all privileges on all functions in schema public from authenticated;

-- 3) Make future tables private by default for Supabase API roles.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on tables from authenticated;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on sequences from authenticated;
alter default privileges in schema public revoke all on functions from anon;
alter default privileges in schema public revoke all on functions from authenticated;

-- 4) Add an explicit deny policy to every public table.
-- RLS with no policy already denies access, but Supabase Security Advisor reports
-- that as "RLS Enabled No Policy". These policies keep the same locked-down
-- behaviour while making the security posture explicit.
do $$
declare
  table_row record;
begin
  for table_row in
    select schemaname, tablename
    from pg_tables
    where schemaname = 'public'
  loop
    if not exists (
      select 1
      from pg_policies
      where schemaname = table_row.schemaname
        and tablename = table_row.tablename
        and policyname = 'deny_supabase_api_access'
    ) then
      execute format(
        'create policy deny_supabase_api_access on %I.%I for all to anon, authenticated using (false) with check (false)',
        table_row.schemaname,
        table_row.tablename
      );
    end if;
  end loop;
end
$$;

commit;

-- Verification: this should return every public table with rls_enabled = true.
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'p')
order by c.relname;

-- Verification: ideally this returns zero rows for application tables.
select
  table_schema,
  table_name,
  grantee,
  privilege_type
from information_schema.table_privileges
where table_schema = 'public'
  and grantee in ('anon', 'authenticated')
order by table_name, grantee, privilege_type;

-- Verification: this should return one deny policy for each public table.
select
  schemaname,
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and policyname = 'deny_supabase_api_access'
order by tablename;
