-- v0.3.5 AI billing credits MVP
-- Apply after v0.3.4.

create table if not exists public.ai_credit_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  free_uses_remaining integer not null default 1,
  paid_credits_remaining integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_credit_accounts_non_negative check (
    free_uses_remaining >= 0 and paid_credits_remaining >= 0
  )
);

alter table public.ai_credit_accounts enable row level security;

drop policy if exists "Users can select own ai credit account" on public.ai_credit_accounts;
create policy "Users can select own ai credit account"
  on public.ai_credit_accounts for select
  to authenticated
  using ((select auth.uid()) = user_id);

create table if not exists public.ai_credit_ledger (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  feature text,
  delta_free integer not null default 0,
  delta_paid integer not null default 0,
  payment_order_id text,
  note text,
  created_at timestamptz not null default now(),
  constraint ai_credit_ledger_event_type_check check (
    event_type in ('free_grant', 'purchase_grant', 'consume', 'refund', 'admin_adjustment')
  )
);

create index if not exists ai_credit_ledger_user_created_at_idx
  on public.ai_credit_ledger (user_id, created_at desc);

alter table public.ai_credit_ledger enable row level security;

drop policy if exists "Users can select own ai credit ledger" on public.ai_credit_ledger;
create policy "Users can select own ai credit ledger"
  on public.ai_credit_ledger for select
  to authenticated
  using ((select auth.uid()) = user_id);

create table if not exists public.payments (
  order_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  payment_key text unique,
  product_code text not null,
  amount_krw integer not null,
  credits integer not null,
  status text not null default 'pending',
  approved_at timestamptz,
  raw_response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_status_check check (
    status in ('pending', 'approved', 'failed', 'canceled')
  )
);

create index if not exists payments_user_created_at_idx
  on public.payments (user_id, created_at desc);

alter table public.payments enable row level security;

drop policy if exists "Users can select own payments" on public.payments;
create policy "Users can select own payments"
  on public.payments for select
  to authenticated
  using ((select auth.uid()) = user_id);

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
  values (p_user_id, 1, 0)
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

create or replace function public.grant_ai_credits_for_payment(
  p_user_id uuid,
  p_order_id text,
  p_payment_key text,
  p_credits integer,
  p_raw_response jsonb,
  p_approved_at timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_payment public.payments%rowtype;
  current_account public.ai_credit_accounts%rowtype;
begin
  select *
    into current_payment
    from public.payments
    where order_id = p_order_id and user_id = p_user_id
    for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'payment_not_found');
  end if;

  if current_payment.status = 'approved' then
    select *
      into current_account
      from public.ai_credit_accounts
      where user_id = p_user_id;

    return jsonb_build_object(
      'ok', true,
      'already_approved', true,
      'free_uses_remaining', coalesce(current_account.free_uses_remaining, 0),
      'paid_credits_remaining', coalesce(current_account.paid_credits_remaining, 0)
    );
  end if;

  insert into public.ai_credit_accounts (user_id, free_uses_remaining, paid_credits_remaining)
  values (p_user_id, 1, 0)
  on conflict (user_id) do nothing;

  update public.ai_credit_accounts
    set paid_credits_remaining = paid_credits_remaining + p_credits,
        updated_at = now()
    where user_id = p_user_id;

  update public.payments
    set payment_key = p_payment_key,
        status = 'approved',
        approved_at = coalesce(p_approved_at, now()),
        raw_response = p_raw_response,
        updated_at = now()
    where order_id = p_order_id and user_id = p_user_id;

  insert into public.ai_credit_ledger (
    user_id,
    event_type,
    delta_paid,
    payment_order_id
  ) values (
    p_user_id,
    'purchase_grant',
    p_credits,
    p_order_id
  );

  select *
    into current_account
    from public.ai_credit_accounts
    where user_id = p_user_id;

  return jsonb_build_object(
    'ok', true,
    'already_approved', false,
    'free_uses_remaining', current_account.free_uses_remaining,
    'paid_credits_remaining', current_account.paid_credits_remaining
  );
end;
$$;
