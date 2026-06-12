-- Career Company Tracker: Supabase 스키마
-- Supabase Dashboard > SQL Editor 에서 실행하세요.

create table if not exists public.companies (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- 개인용 앱 기준의 단순 정책입니다.
-- anon key로 읽기/쓰기를 허용하므로, 키가 노출되면 누구나 접근할 수 있습니다.
-- 공개 배포 시에는 Supabase Auth를 붙이고 정책을 user_id 기반으로 좁히세요.
alter table public.companies enable row level security;

drop policy if exists "anon read companies" on public.companies;
create policy "anon read companies"
  on public.companies for select
  to anon
  using (true);

drop policy if exists "anon upsert companies" on public.companies;
create policy "anon upsert companies"
  on public.companies for insert
  to anon
  with check (true);

drop policy if exists "anon update companies" on public.companies;
create policy "anon update companies"
  on public.companies for update
  to anon
  using (true);

drop policy if exists "anon delete companies" on public.companies;
create policy "anon delete companies"
  on public.companies for delete
  to anon
  using (true);
