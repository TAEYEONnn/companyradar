-- v038: profiles 테이블 + 자동 생성 트리거 + 기존 사용자 백필
-- v034가 적용되지 않은 환경에서도 단독으로 실행 가능합니다.

-- 1. profiles 테이블 생성 (없는 경우)
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

-- 2. 새 사용자 가입 시 profiles row 자동 생성 트리거
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'beta_user')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 3. 기존 사용자 백필 (profile row가 없는 사용자를 beta_user로 생성)
insert into public.profiles (id, email, role)
select id, email, 'beta_user'
from auth.users
where id not in (select id from public.profiles)
on conflict (id) do nothing;

-- ────────────────────────────────────────────────────────
-- 위 SQL 실행 후, 운영자 계정을 owner로 설정:
--
--   update public.profiles
--   set role = 'owner'
--   where email = 'your-operator@example.com';
-- ────────────────────────────────────────────────────────
