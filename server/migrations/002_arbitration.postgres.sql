-- Apply once in Supabase SQL editor after the existing core schema.
-- Additive: does not delete or overwrite existing users/documents/messages.
BEGIN;
CREATE TABLE IF NOT EXISTS arb_tournaments (id TEXT PRIMARY KEY, data JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS arb_qualifications (user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, data JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS arb_availability (id TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, week TEXT NOT NULL, data JSONB NOT NULL, UNIQUE(user_id,week));
CREATE TABLE IF NOT EXISTS arb_appointments (id TEXT PRIMARY KEY, tournament_id TEXT NOT NULL REFERENCES arb_tournaments(id) ON DELETE CASCADE, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, data JSONB NOT NULL);
CREATE INDEX IF NOT EXISTS arb_appointments_user ON arb_appointments(user_id);
CREATE TABLE IF NOT EXISTS arb_evaluations (id TEXT PRIMARY KEY, appointment_id TEXT NOT NULL UNIQUE REFERENCES arb_appointments(id) ON DELETE CASCADE, data JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS arb_logbook (id TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, tournament_id TEXT REFERENCES arb_tournaments(id) ON DELETE SET NULL, data JSONB NOT NULL);
-- Access goes through the authenticated Node API and its server-side checks.
ALTER TABLE arb_tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE arb_qualifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE arb_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE arb_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE arb_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE arb_logbook ENABLE ROW LEVEL SECURITY;
COMMIT;
