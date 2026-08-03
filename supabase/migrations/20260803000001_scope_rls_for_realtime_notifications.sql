-- The in-app notification bell (useRealtimeVisits, src/hooks/use-realtime-visits.ts)
-- is the only place in the app that queries Postgres via the Supabase client
-- instead of Prisma: it does a direct `pools` SELECT to build the toast/badge
-- text after a `service_visits` realtime change. No RLS policy existed for
-- either table (schema DDL is Prisma-owned; this migration only adds
-- Postgres-level RLS/grants, same scope as
-- 20260712000001_enable_realtime_for_service_visit.sql), so that SELECT could
-- be denied depending on default privileges, and — separately — any
-- authenticated user could otherwise read any company's pools/service_visits
-- rows directly via the REST API, unscoped by company.
--
-- Scopes both tables to the caller's own company, bridging Supabase auth to
-- the Prisma `users` table the same way src/lib/auth.ts does (by
-- `users."supabaseId"`).

ALTER TABLE "pools" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "service_visits" ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON "pools" TO authenticated;
GRANT SELECT ON "service_visits" TO authenticated;

DROP POLICY IF EXISTS "pools_select_own_company" ON "pools";
CREATE POLICY "pools_select_own_company" ON "pools"
  FOR SELECT
  TO authenticated
  USING (
    "companyId" IN (
      SELECT "companyId" FROM "users" WHERE "supabaseId" = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "service_visits_select_own_company" ON "service_visits";
CREATE POLICY "service_visits_select_own_company" ON "service_visits"
  FOR SELECT
  TO authenticated
  USING (
    "poolId" IN (
      SELECT "id" FROM "pools" WHERE "companyId" IN (
        SELECT "companyId" FROM "users" WHERE "supabaseId" = auth.uid()::text
      )
    )
  );
