-- v0.4.4: Change AI free use limit from 1 to 5
-- 1) Fix table column default
-- 2) Fix consume_ai_credit fallback insert
-- 3) Upgrade existing accounts that still have 1 and have never consumed

alter table public.ai_credit_accounts
  alter column free_uses_remaining set default 5;

-- Upgrade users who were initialised with 1 but have not consumed any credits yet.
update public.ai_credit_accounts
set free_uses_remaining = 5, updated_at = now()
where free_uses_remaining = 1
  and paid_credits_remaining = 0
  and user_id not in (
    select distinct user_id from public.ai_credit_ledger where event_type = 'consume'
  );

-- Re-create the consume_ai_credit function with the corrected fallback (5 instead of 1).
create or replace function public.consume_ai_credit(
  p_user_id uuid,
  p_feature text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_account public.ai_credit_accounts%rowtype;
  consumed_free integer := 0;
  consumed_paid integer := 0;
begin
  insert into public.ai_credit_accounts (user_id, free_uses_remaining, paid_credits_remaining)
  values (p_user_id, 5, 0)
  on conflict (user_id) do nothing;

  select *
    into current_account
    from public.ai_credit_accounts
    where user_id = p_user_id
    for update;

  if current_account.free_uses_remaining > 0 then
    consumed_free := -1;
    update public.ai_credit_accounts
      set free_uses_remaining = free_uses_remaining - 1,
          updated_at = now()
      where user_id = p_user_id;
  elsif current_account.paid_credits_remaining > 0 then
    consumed_paid := -1;
    update public.ai_credit_accounts
      set paid_credits_remaining = paid_credits_remaining - 1,
          updated_at = now()
      where user_id = p_user_id;
  else
    return jsonb_build_object('ok', false, 'code', 'insufficient_credits');
  end if;

  insert into public.ai_credit_ledger (
    user_id,
    event_type,
    feature,
    delta_free,
    delta_paid
  ) values (
    p_user_id,
    'consume',
    p_feature,
    consumed_free,
    consumed_paid
  );

  select *
    into current_account
    from public.ai_credit_accounts
    where user_id = p_user_id;

  return jsonb_build_object(
    'ok', true,
    'free_uses_remaining', current_account.free_uses_remaining,
    'paid_credits_remaining', current_account.paid_credits_remaining
  );
end;
$$;
