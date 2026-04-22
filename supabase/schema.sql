-- ── Split Kit — Supabase Schema ─────────────────────────────

-- Projects
CREATE TABLE projects (
  code        TEXT PRIMARY KEY,     -- 6-digit string, used as the join code
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Members
CREATE TABLE members (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_code  TEXT NOT NULL REFERENCES projects(code) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  device_ids    TEXT[] DEFAULT '{}',  -- array of device UUIDs for identity tracking
  joined_at     TIMESTAMPTZ DEFAULT now()
);

-- Transactions (expenses + settlements)
CREATE TABLE transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_code    TEXT NOT NULL REFERENCES projects(code) ON DELETE CASCADE,
  description     TEXT NOT NULL,
  amount          NUMERIC(10,2) NOT NULL,
  date            DATE NOT NULL,
  category        TEXT NOT NULL,
  paid_by         UUID NOT NULL REFERENCES members(id),
  split_between   UUID[] NOT NULL,    -- array of member UUIDs
  is_settlement   BOOLEAN DEFAULT FALSE,
  currency_code   TEXT DEFAULT 'USD', -- ISO 4217 code of the original currency
  amount_usd      NUMERIC(10,2),      -- amount converted to USD at time of entry
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ── Migration for existing databases ──────────────────────────
-- Run these in Supabase SQL Editor if the table already exists:
--
-- ALTER TABLE transactions ADD COLUMN IF NOT EXISTS currency_code TEXT DEFAULT 'USD';
-- ALTER TABLE transactions ADD COLUMN IF NOT EXISTS amount_usd NUMERIC(10,2);
-- UPDATE transactions SET currency_code = 'USD', amount_usd = amount WHERE amount_usd IS NULL;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE members;
ALTER PUBLICATION supabase_realtime ADD TABLE transactions;

-- Helper: append a device UUID to a member (no duplicates)
CREATE OR REPLACE FUNCTION append_device_id(member_id UUID, device_id TEXT)
RETURNS void AS $$
  UPDATE members
  SET device_ids = array_append(device_ids, device_id)
  WHERE id = member_id AND NOT (device_id = ANY(device_ids));
$$ LANGUAGE sql;

-- Helper: remove a device UUID from a member (for leave project)
CREATE OR REPLACE FUNCTION remove_device_id(member_id UUID, device_id TEXT)
RETURNS void AS $$
  UPDATE members
  SET device_ids = array_remove(device_ids, device_id)
  WHERE id = member_id;
$$ LANGUAGE sql;

-- NOTE: Disable RLS on all three tables in the Supabase dashboard
-- (Authentication → Policies → disable RLS for projects, members, transactions)
