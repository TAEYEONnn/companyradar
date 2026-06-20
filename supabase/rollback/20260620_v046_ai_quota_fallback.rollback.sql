drop function if exists public.reserve_ai_quota(
  text, text, text, text, integer, integer, integer, timestamptz, timestamptz
);
drop table if exists public.ai_quota_counters;
