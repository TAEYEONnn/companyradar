-- v0.3.4 Profiles and AI usage audit
-- Keeps the current email allowlist path, while preparing owner/beta/blocked roles.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'beta_user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_role_check check (role in ('owner', 'beta_user', 'blocked'))
);

alter table public.profiles enable row level security;

drop policy if exists "Users can select own profile" on public.profiles;
create policy "Users can select own profile"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile email" on public.profiles;

create table if not exists public.ai_requests (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null,
  status text not null,
  error_code text,
  created_at timestamptz not null default now(),
  constraint ai_requests_status_check check (status in ('success', 'error'))
);

create index if not exists ai_requests_user_created_at_idx
  on public.ai_requests (user_id, created_at desc);

alter table public.ai_requests enable row level security;

drop policy if exists "Users can select own ai requests" on public.ai_requests;
create policy "Users can select own ai requests"
  on public.ai_requests for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own ai requests" on public.ai_requests;
create policy "Users can insert own ai requests"
  on public.ai_requests for insert
  to authenticated
  with check ((select auth.uid()) = user_id);
