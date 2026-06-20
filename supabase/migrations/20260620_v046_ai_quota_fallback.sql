-- v0.4.6: Supabase fallback for anonymous AI quota reservations

create table if not exists public.ai_quota_counters (
  counter_key text primary key,
  feature text not null,
  bucket_type text not null,
  request_count integer not null default 0 check (request_count >= 0),
  expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  constraint ai_quota_counters_bucket_type_check check (
    bucket_type in ('client_daily', 'global_daily', 'ip_minute')
  )
);

alter table public.ai_quota_counters enable row level security;

create index if not exists ai_quota_counters_expires_idx
  on public.ai_quota_counters (expires_at);

create or replace function public.reserve_ai_quota(
  p_feature text,
  p_client_key text,
  p_global_key text,
  p_ip_key text,
  p_client_limit integer,
  p_global_limit integer,
  p_ip_limit integer,
  p_daily_expires_at timestamptz,
  p_minute_expires_at timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  client_count integer;
  global_count integer;
  ip_count integer;
begin
  delete from public.ai_quota_counters
  where expires_at < now();

  insert into public.ai_quota_counters (
    counter_key, feature, bucket_type, request_count, expires_at
  ) values
    (p_client_key, p_feature, 'client_daily', 0, p_daily_expires_at),
    (p_global_key, p_feature, 'global_daily', 0, p_daily_expires_at),
    (p_ip_key, p_feature, 'ip_minute', 0, p_minute_expires_at)
  on conflict (counter_key) do nothing;

  select request_count into client_count
  from public.ai_quota_counters
  where counter_key = p_client_key
  for update;

  select request_count into global_count
  from public.ai_quota_counters
  where counter_key = p_global_key
  for update;

  select request_count into ip_count
  from public.ai_quota_counters
  where counter_key = p_ip_key
  for update;

  if client_count >= p_client_limit then
    return jsonb_build_object('allowed', false, 'reason', 'client_daily');
  end if;
  if global_count >= p_global_limit then
    return jsonb_build_object('allowed', false, 'reason', 'global_daily');
  end if;
  if ip_count >= p_ip_limit then
    return jsonb_build_object('allowed', false, 'reason', 'ip_minute');
  end if;

  update public.ai_quota_counters
  set request_count = request_count + 1, updated_at = now()
  where counter_key in (p_client_key, p_global_key, p_ip_key);

  return jsonb_build_object('allowed', true, 'reason', null);
end;
$$;

revoke all on table public.ai_quota_counters from public, anon, authenticated;
revoke all on function public.reserve_ai_quota(
  text, text, text, text, integer, integer, integer, timestamptz, timestamptz
) from public, anon, authenticated;
grant execute on function public.reserve_ai_quota(
  text, text, text, text, integer, integer, integer, timestamptz, timestamptz
) to service_role;
