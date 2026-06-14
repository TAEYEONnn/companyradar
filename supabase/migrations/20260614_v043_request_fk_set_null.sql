-- v043: Preserve admin audit records after user deletion
--
-- Problem: support_requests, refund_requests, account_deletion_requests
-- all had ON DELETE CASCADE. When a user is deleted, their rows were
-- also deleted — losing the audit trail for financial and compliance records.
--
-- Fix: change FK to ON DELETE SET NULL and make user_id nullable.
-- Rows survive with user_id = NULL; admin (service role) can still read them.
-- RLS policies already use auth.uid() = user_id, so NULL rows are invisible
-- to other users — no data leak.
--
-- All other tables (companies, ai_credit_accounts, payments, profiles, etc.)
-- keep ON DELETE CASCADE since those are purely user data with no audit need.

-- ── support_requests ──────────────────────────────────────────────────────
ALTER TABLE public.support_requests
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.support_requests
  DROP CONSTRAINT IF EXISTS support_requests_user_id_fkey;

ALTER TABLE public.support_requests
  ADD CONSTRAINT support_requests_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ── refund_requests ───────────────────────────────────────────────────────
ALTER TABLE public.refund_requests
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.refund_requests
  DROP CONSTRAINT IF EXISTS refund_requests_user_id_fkey;

ALTER TABLE public.refund_requests
  ADD CONSTRAINT refund_requests_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ── account_deletion_requests ─────────────────────────────────────────────
ALTER TABLE public.account_deletion_requests
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.account_deletion_requests
  DROP CONSTRAINT IF EXISTS account_deletion_requests_user_id_fkey;

ALTER TABLE public.account_deletion_requests
  ADD CONSTRAINT account_deletion_requests_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ── operator account setup ────────────────────────────────────────────────
-- After applying this migration, set the operator account role:
--
--   UPDATE public.profiles
--   SET role = 'owner'
--   WHERE email = 'dev@example.com';   -- replace with actual operator email
--
-- This makes isAllowedAiOperator() return true via role check,
-- independent of AI_ALLOWED_EMAILS env var.
