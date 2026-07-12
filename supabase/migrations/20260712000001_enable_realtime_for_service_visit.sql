-- Enable real-time insert events for the service_visits table so techs
-- receive instant notification when a new visit is assigned to them.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'service_visits'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE "service_visits";
  END IF;
END $$;
