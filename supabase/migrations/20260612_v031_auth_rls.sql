-- v0.3.1 Auth/RLS hardening
-- Apply in Supabase Dashboard > SQL Editor before deploying v0.3.1.
-- Do not use or store service_role keys in this app.

create table if not exists public.companies (
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.companies
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- Existing rows were created under the pre-auth anon policy and are not user-owned.
-- They are seed/sample data and must not remain as public shared rows.
delete from public.companies
where user_id is null;

alter table public.companies
  alter column user_id set not null;

alter table public.companies
  drop constraint if exists companies_pkey;

alter table public.companies
  add constraint companies_pkey primary key (user_id, id);

alter table public.companies enable row level security;

drop policy if exists "anon read companies" on public.companies;
drop policy if exists "anon upsert companies" on public.companies;
drop policy if exists "anon update companies" on public.companies;
drop policy if exists "anon delete companies" on public.companies;

drop policy if exists "Users can select own companies" on public.companies;
create policy "Users can select own companies"
  on public.companies for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own companies" on public.companies;
create policy "Users can insert own companies"
  on public.companies for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own companies" on public.companies;
create policy "Users can update own companies"
  on public.companies for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own companies" on public.companies;
create policy "Users can delete own companies"
  on public.companies for delete
  to authenticated
  using ((select auth.uid()) = user_id);
