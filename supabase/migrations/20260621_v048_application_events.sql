-- v0.4.8 Connect saved job decisions and application status changes to a timeline.

create table if not exists public.application_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_posting_id uuid not null references public.job_postings(id) on delete cascade,
  event_type text not null check (
    event_type in ('saved', 'decision_changed', 'status_changed', 'interview_scheduled')
  ),
  from_status text,
  to_status text not null,
  company_name text,
  job_title text,
  note text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists application_events_user_occurred_idx
  on public.application_events (user_id, occurred_at desc);
create index if not exists application_events_job_idx
  on public.application_events (user_id, job_posting_id, occurred_at desc);

alter table public.application_events enable row level security;

drop policy if exists "application_events_select_own" on public.application_events;
create policy "application_events_select_own"
  on public.application_events for select
  using (auth.uid() = user_id);

drop policy if exists "application_events_insert_own" on public.application_events;
create policy "application_events_insert_own"
  on public.application_events for insert
  with check (auth.uid() = user_id);

drop policy if exists "application_events_update_own" on public.application_events;
create policy "application_events_update_own"
  on public.application_events for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "application_events_delete_own" on public.application_events;
create policy "application_events_delete_own"
  on public.application_events for delete
  using (auth.uid() = user_id);

create or replace function public.save_fit_result(
  p_job_posting jsonb,
  p_analysis jsonb,
  p_requirements jsonb,
  p_decision text
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_company_id uuid;
  current_job_posting_id uuid;
  current_fit_analysis_id uuid;
  current_application_status text;
  is_duplicate boolean := false;
  v_canonical_url text := nullif(trim(p_job_posting->>'canonicalUrl'), '');
  company_name text := coalesce(nullif(trim(p_job_posting->>'companyName'), ''), '회사명 확인 필요');
  requirement jsonb;
  requirement_position integer := 0;
begin
  if current_user_id is null then raise exception 'authentication required'; end if;
  if p_decision not in ('interested', 'planned', 'pass') then raise exception 'invalid decision'; end if;

  insert into public.job_companies (user_id, name)
  values (current_user_id, company_name)
  on conflict (user_id, name) do update set updated_at = now()
  returning id into current_company_id;

  if v_canonical_url is not null then
    select exists(
      select 1 from public.job_postings
      where user_id = current_user_id
        and job_postings.canonical_url = v_canonical_url
    ) into is_duplicate;

    insert into public.job_postings (
      user_id, company_id, title, canonical_url, source,
      structured_data, deadline, last_checked_at
    ) values (
      current_user_id, current_company_id, coalesce(p_job_posting->>'title', ''),
      v_canonical_url, coalesce(nullif(p_job_posting->>'source', ''), 'manual'),
      coalesce(p_job_posting->'structuredData', '{}'::jsonb),
      nullif(p_job_posting->>'deadline', '')::date,
      coalesce(nullif(p_job_posting->>'lastCheckedAt', '')::timestamptz, now())
    )
    on conflict (user_id, canonical_url)
      where canonical_url is not null and canonical_url <> ''
    do update set
      company_id = excluded.company_id,
      title = coalesce(nullif(excluded.title, ''), job_postings.title),
      source = coalesce(nullif(excluded.source, ''), job_postings.source),
      structured_data = excluded.structured_data,
      deadline = coalesce(excluded.deadline, job_postings.deadline),
      last_checked_at = excluded.last_checked_at,
      updated_at = now()
    returning id into current_job_posting_id;
  else
    insert into public.job_postings (
      user_id, company_id, title, canonical_url, source,
      structured_data, deadline, last_checked_at
    ) values (
      current_user_id, current_company_id, coalesce(p_job_posting->>'title', ''),
      null, coalesce(nullif(p_job_posting->>'source', ''), 'manual'),
      coalesce(p_job_posting->'structuredData', '{}'::jsonb),
      nullif(p_job_posting->>'deadline', '')::date,
      coalesce(nullif(p_job_posting->>'lastCheckedAt', '')::timestamptz, now())
    )
    returning id into current_job_posting_id;
  end if;

  insert into public.fit_analyses (
    user_id, job_posting_id, analysis_id, summary, recommendation,
    score, evidence_coverage, next_action, company_overview
  ) values (
    current_user_id, current_job_posting_id, p_analysis->>'analysisId',
    coalesce(p_analysis->>'summary', ''), p_analysis->>'recommendation',
    (p_analysis->>'score')::integer,
    coalesce((p_analysis->>'evidenceCoverage')::integer, 0),
    coalesce(p_analysis->>'nextAction', ''),
    p_analysis->'companyOverview'
  )
  on conflict (user_id, analysis_id) do update set
    job_posting_id = excluded.job_posting_id,
    summary = excluded.summary,
    recommendation = excluded.recommendation,
    score = excluded.score,
    evidence_coverage = excluded.evidence_coverage,
    next_action = excluded.next_action,
    company_overview = excluded.company_overview,
    updated_at = now()
  returning id into current_fit_analysis_id;

  delete from public.fit_requirements
  where user_id = current_user_id and fit_analysis_id = current_fit_analysis_id;

  for requirement in
    select * from jsonb_array_elements(coalesce(p_requirements, '[]'::jsonb))
  loop
    insert into public.fit_requirements (
      user_id, fit_analysis_id, requirement_key, text, importance, match,
      confidence, job_evidence, profile_evidence, position
    ) values (
      current_user_id, current_fit_analysis_id,
      coalesce(requirement->>'id', requirement_position::text),
      requirement->>'text', requirement->>'importance', requirement->>'match',
      (requirement->>'confidence')::integer,
      coalesce(requirement->>'jobEvidence', ''),
      coalesce(requirement->>'profileEvidence', ''),
      requirement_position
    );
    requirement_position := requirement_position + 1;
  end loop;

  insert into public.job_decisions (user_id, job_posting_id, decision)
  values (current_user_id, current_job_posting_id, p_decision)
  on conflict (user_id, job_posting_id)
  do update set decision = excluded.decision, updated_at = now();

  if p_decision = 'pass' then
    delete from public.applications
    where user_id = current_user_id and job_posting_id = current_job_posting_id;
    current_application_status := null;
  else
    current_application_status := p_decision;
    insert into public.applications (user_id, job_posting_id, status)
    values (current_user_id, current_job_posting_id, current_application_status)
    on conflict (user_id, job_posting_id)
    do update set status = excluded.status, updated_at = now();
  end if;

  return jsonb_build_object(
    'jobPostingId', current_job_posting_id,
    'companyId', current_company_id,
    'duplicate', is_duplicate,
    'decision', p_decision,
    'applicationStatus', current_application_status
  );
end;
$$;

create or replace function public.record_job_decision_event()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_company_name text;
  v_job_title text;
begin
  if tg_op = 'UPDATE' and old.decision is not distinct from new.decision then
    return new;
  end if;

  select jc.name, jp.title
  into v_company_name, v_job_title
  from public.job_postings jp
  join public.job_companies jc on jc.id = jp.company_id
  where jp.id = new.job_posting_id and jp.user_id = new.user_id;

  insert into public.application_events (
    user_id, job_posting_id, event_type, from_status, to_status,
    company_name, job_title
  ) values (
    new.user_id,
    new.job_posting_id,
    case when tg_op = 'INSERT' then 'saved' else 'decision_changed' end,
    case when tg_op = 'UPDATE' then old.decision else null end,
    new.decision,
    v_company_name,
    v_job_title
  );
  return new;
end;
$$;

drop trigger if exists job_decisions_record_event on public.job_decisions;
create trigger job_decisions_record_event
after insert or update of decision on public.job_decisions
for each row execute function public.record_job_decision_event();

create or replace function public.record_application_status_event()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_company_name text;
  v_job_title text;
begin
  if old.status is not distinct from new.status then return new; end if;

  select jc.name, jp.title
  into v_company_name, v_job_title
  from public.job_postings jp
  join public.job_companies jc on jc.id = jp.company_id
  where jp.id = new.job_posting_id and jp.user_id = new.user_id;

  insert into public.application_events (
    user_id, job_posting_id, event_type, from_status, to_status,
    company_name, job_title
  ) values (
    new.user_id, new.job_posting_id, 'status_changed',
    old.status, new.status, v_company_name, v_job_title
  );
  return new;
end;
$$;

drop trigger if exists applications_record_status_event on public.applications;
create trigger applications_record_status_event
after update of status on public.applications
for each row execute function public.record_application_status_event();
