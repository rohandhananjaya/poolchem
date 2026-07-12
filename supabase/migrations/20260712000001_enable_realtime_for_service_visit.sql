-- Enable real-time insert events for the service_visits table so techs
-- receive instant notification when a new visit is assigned to them.
ALTER PUBLICATION supabase_realtime ADD TABLE "service_visits";
