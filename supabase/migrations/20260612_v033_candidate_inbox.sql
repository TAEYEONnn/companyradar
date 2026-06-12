-- v0.3.3 Candidate Inbox
-- Apply before deploying v0.3.3.

create table if not exists public.candidate_inbox_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  source_url text not null default '',
  raw_text text not null default '',
  discovery_reason text not null default 'manual',
  first_impression_note text not null default '',
  parsed_company jsonb,
  parse_status text not null default 'idle',
  needs_review boolean not null default true,
  promoted_company_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint candidate_inbox_items_pkey primary key (user_id, id),
  constraint candidate_inbox_items_parse_status_check check (
    parse_status in (
      'idle',
      'fetching',
      'parsed',
      'partial',
      'failed',
      'needs_manual_input'
    )
  )
);

alter table public.candidate_inbox_items enable row level security;

drop policy if exists "Users can select own candidate inbox items"
  on public.candidate_inbox_items;
create policy "Users can select own candidate inbox items"
  on public.candidate_inbox_items for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own candidate inbox items"
  on public.candidate_inbox_items;
create policy "Users can insert own candidate inbox items"
  on public.candidate_inbox_items for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own candidate inbox items"
  on public.candidate_inbox_items;
create policy "Users can update own candidate inbox items"
  on public.candidate_inbox_items for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own candidate inbox items"
  on public.candidate_inbox_items;
create policy "Users can delete own candidate inbox items"
  on public.candidate_inbox_items for delete
  to authenticated
  using ((select auth.uid()) = user_id);
