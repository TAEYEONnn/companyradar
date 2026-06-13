-- v0.3.6 Support, refund, and account deletion request MVP

create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null default '',
  request_type text not null default 'general',
  subject text not null default '',
  message text not null default '',
  status text not null default 'open',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint support_requests_type_check check (
    request_type in ('general', 'bug', 'feature', 'account', 'billing')
  ),
  constraint support_requests_status_check check (
    status in ('open', 'in_review', 'resolved', 'closed')
  )
);

alter table public.support_requests enable row level security;

drop policy if exists "Users can select own support requests" on public.support_requests;
create policy "Users can select own support requests"
  on public.support_requests for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own support requests" on public.support_requests;
create policy "Users can insert own support requests"
  on public.support_requests for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create table if not exists public.refund_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null default '',
  order_id text,
  payment_key text,
  reason text not null default '',
  status text not null default 'requested',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint refund_requests_status_check check (
    status in ('requested', 'in_review', 'approved', 'rejected', 'canceled')
  )
);

alter table public.refund_requests enable row level security;

drop policy if exists "Users can select own refund requests" on public.refund_requests;
create policy "Users can select own refund requests"
  on public.refund_requests for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own refund requests" on public.refund_requests;
create policy "Users can insert own refund requests"
  on public.refund_requests for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null default '',
  reason text not null default '',
  status text not null default 'requested',
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  operator_note text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  constraint account_deletion_requests_status_check check (
    status in ('requested', 'in_review', 'completed', 'canceled')
  )
);

alter table public.account_deletion_requests enable row level security;

create unique index if not exists account_deletion_requests_open_user_idx
  on public.account_deletion_requests (user_id)
  where status in ('requested', 'in_review');

drop policy if exists "Users can select own account deletion requests" on public.account_deletion_requests;
create policy "Users can select own account deletion requests"
  on public.account_deletion_requests for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own account deletion requests" on public.account_deletion_requests;
create policy "Users can insert own account deletion requests"
  on public.account_deletion_requests for insert
  to authenticated
  with check ((select auth.uid()) = user_id);
