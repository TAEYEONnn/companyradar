-- v039: Add company_name and job_title columns to candidate_inbox_items
alter table public.candidate_inbox_items
  add column if not exists company_name text not null default '',
  add column if not exists job_title    text not null default '';
