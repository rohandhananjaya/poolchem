-- 20260803000001 scoped pools/service_visits RLS via a subquery on "users"
-- (bridging auth.uid() -> users.supabaseId -> companyId). That subquery runs
-- as the "authenticated" role, which had no grant on "users" at all — so the
-- subquery itself failed permission-wise, and Realtime's per-event RLS check
-- for postgres_changes surfaced this as "Error 401: Unauthorized" (join still
-- succeeds; only the per-row check fails), silently dropping every broadcast.
--
-- Grants just enough to resolve the caller's own row (not the whole company's
-- user list) — sufficient for the pools/service_visits policies' subqueries.

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON "users" TO authenticated;

DROP POLICY IF EXISTS "users_select_self" ON "users";
CREATE POLICY "users_select_self" ON "users"
  FOR SELECT
  TO authenticated
  USING ("supabaseId" = auth.uid()::text);
