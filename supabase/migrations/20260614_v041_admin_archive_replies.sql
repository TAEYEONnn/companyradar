-- v0.4.1 Admin archive and reply body tracking

alter table public.support_requests
  add column if not exists archived_at timestamptz,
  add column if not exists reply_body text not null default '',
  add column if not exists replied_at timestamptz;

alter table public.refund_requests
  add column if not exists archived_at timestamptz,
  add column if not exists reply_body text not null default '',
  add column if not exists replied_at timestamptz;

alter table public.account_deletion_requests
  add column if not exists archived_at timestamptz,
  add column if not exists reply_body text not null default '',
  add column if not exists replied_at timestamptz;

create index if not exists support_requests_archived_at_idx
  on public.support_requests (archived_at, created_at desc);

create index if not exists refund_requests_archived_at_idx
  on public.refund_requests (archived_at, created_at desc);

create index if not exists account_deletion_requests_archived_at_idx
  on public.account_deletion_requests (archived_at, requested_at desc);
