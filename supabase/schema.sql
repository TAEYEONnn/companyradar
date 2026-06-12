-- Career Company Tracker: current Supabase schema
-- Supabase Dashboard > SQL Editor에서 새 프로젝트에 실행하세요.
-- 기존 프로젝트는 supabase/migrations/20260612_v031_auth_rls.sql을 먼저 적용하세요.

create table if not exists public.companies (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  constraint companies_pkey primary key (user_id, id)
);

alter table public.companies enable row level security;

create policy "Users can select own companies"
  on public.companies for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert own companies"
  on public.companies for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update own companies"
  on public.companies for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete own companies"
  on public.companies for delete
  to authenticated
  using ((select auth.uid()) = user_id);
