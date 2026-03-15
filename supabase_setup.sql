-- TravelBilli API Cache Table
-- Run this in your Supabase SQL Editor to set up caching for flight and hotel search results.

CREATE TABLE IF NOT EXISTS api_cache (
  key TEXT PRIMARY KEY,
  response JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster expiry lookups
CREATE INDEX IF NOT EXISTS api_cache_expires_at_idx ON api_cache (expires_at);

-- Enable Row Level Security
ALTER TABLE api_cache ENABLE ROW LEVEL SECURITY;

-- Allow the service role (used by the Cloudflare Worker backend) to read and write
-- The worker uses SUPABASE_SERVICE_ROLE_KEY which bypasses RLS automatically.
-- These policies cover any anon/authenticated reads if needed.

CREATE POLICY "Allow backend reads" ON api_cache
  FOR SELECT USING (true);

CREATE POLICY "Allow backend writes" ON api_cache
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow backend updates" ON api_cache
  FOR UPDATE USING (true);

-- Optional: auto-delete expired rows to keep the table clean
-- You can set this up as a pg_cron job in Supabase if desired:
-- SELECT cron.schedule('delete-expired-cache', '0 * * * *', $$
--   DELETE FROM api_cache WHERE expires_at < NOW();
-- $$);

-- -------------------------------------------------------
-- TravelBilli Airports Table
-- Run this section, then import airports.csv from OurAirports:
--   https://davidmegginson.github.io/ourairports-data/airports.csv
-- In Supabase: Table Editor -> airports -> Import data (CSV)
-- Only rows where iata_code is not empty will matter.
-- -------------------------------------------------------

CREATE TABLE IF NOT EXISTS airports (
  id SERIAL PRIMARY KEY,
  iata_code TEXT,
  airport_name TEXT,
  city TEXT,
  country TEXT,
  priority INTEGER DEFAULT 4  -- 1=large, 2=medium, 3=small, 4=other
);

CREATE INDEX IF NOT EXISTS airports_iata_idx ON airports (iata_code);
CREATE INDEX IF NOT EXISTS airports_city_idx ON airports (city);
CREATE INDEX IF NOT EXISTS airports_priority_idx ON airports (priority);

ALTER TABLE airports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public reads" ON airports
  FOR SELECT USING (true);
