-- 새 사용자 가입 시 profiles 레코드 자동 생성 트리거
-- 이 트리거 없이는 profiles 테이블에 row가 없어 role 조회 결과가 null → 어드민 접근 불가

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

-- 기존 사용자 백필: profile row가 없는 사용자를 beta_user로 생성
insert into public.profiles (id, email, role)
select id, email, 'beta_user'
from auth.users
where id not in (select id from public.profiles)
on conflict (id) do nothing;

-- ────────────────────────────────────────────────────────
-- 운영자 계정을 owner로 설정하려면 아래 SQL을 Supabase
-- SQL Editor에서 직접 실행하세요 (이메일 주소를 교체):
--
--   update public.profiles
--   set role = 'owner'
--   where email = 'your-operator@example.com';
-- ────────────────────────────────────────────────────────
