-- ============================================================================
-- Single active session per account (user_sessions)
-- ----------------------------------------------------------------------------
-- Tracks the current session_id (from the JWT `session_id` claim) for each
-- account. Used to enforce "one person at a time" on shared customer logins:
--
--   * On every sign-in the app registers the new session_id, overwriting the
--     previous one, so the old session's token no longer matches.
--   * Protected server functions (via requireSupabaseAuth) then reject any
--     request whose token session_id differs from the stored one with
--     "signed in on another device".
--
-- Access is service-role only (bypasses RLS). There are deliberately NO
-- anon/authenticated policies, so regular clients can never read or tamper
-- with this table directly.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_sessions (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.user_sessions TO service_role;
