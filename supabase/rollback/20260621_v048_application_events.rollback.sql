drop trigger if exists applications_record_status_event on public.applications;
drop function if exists public.record_application_status_event();
drop trigger if exists job_decisions_record_event on public.job_decisions;
drop function if exists public.record_job_decision_event();
drop table if exists public.application_events;
