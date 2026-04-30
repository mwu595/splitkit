-- ─────────────────────────────────────────────────────────────────────────────
-- Split Kit — Supabase Schema
-- Run this entire file in the Supabase SQL Editor to set up a fresh project.
--
-- After running:
--   1. Disable RLS on all three tables:
--      Supabase dashboard → Authentication → Policies → disable for
--      projects, members, transactions
--   2. To enable Google sign-in:
--      Supabase dashboard → Authentication → Providers → Google
--      (requires a Google Cloud OAuth client ID + secret)
--   3. Add your app URL to the redirect allow-list:
--      Supabase dashboard → Authentication → URL Configuration
-- ─────────────────────────────────────────────────────────────────────────────


-- ── Tables ────────────────────────────────────────────────────────────────────

CREATE TABLE projects (
  code        TEXT        PRIMARY KEY,          -- 6-digit join code
  name        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE members (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_code  TEXT        NOT NULL REFERENCES projects(code) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  device_ids    TEXT[]      DEFAULT '{}',        -- device UUIDs for identity (multi-device safe)
  role          TEXT        DEFAULT 'member',    -- 'member' | 'admin'
  avatar_data   TEXT,                           -- base64 JPEG, compressed to 200×200 on client
  removed_at    TIMESTAMPTZ,                    -- soft-delete; null = active
  user_id       UUID        REFERENCES auth.users(id),  -- set when member links a Split Kit account
  joined_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX members_user_id_idx ON members(user_id);

CREATE TABLE transactions (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  project_code   TEXT         NOT NULL REFERENCES projects(code) ON DELETE CASCADE,
  description    TEXT         NOT NULL,
  amount         NUMERIC(10,2) NOT NULL,         -- original amount in original currency
  date           DATE         NOT NULL,
  category       TEXT         NOT NULL,
  paid_by        UUID         NOT NULL REFERENCES members(id),
  split_between  UUID[]       NOT NULL,          -- member UUIDs sharing this expense
  is_settlement  BOOLEAN      DEFAULT FALSE,
  currency_code  TEXT         DEFAULT 'USD',     -- ISO 4217
  amount_usd     NUMERIC(10,2),                 -- converted to USD at time of entry
  created_at     TIMESTAMPTZ  DEFAULT now()
);


-- ── Realtime ──────────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE members;
ALTER PUBLICATION supabase_realtime ADD TABLE transactions;


-- ── Helper functions ──────────────────────────────────────────────────────────

-- Append a device UUID to a member (no duplicates)
CREATE OR REPLACE FUNCTION append_device_id(member_id UUID, device_id TEXT)
RETURNS void AS $$
  UPDATE members
  SET device_ids = array_append(device_ids, device_id)
  WHERE id = member_id AND NOT (device_id = ANY(device_ids));
$$ LANGUAGE sql;

-- Remove a device UUID from a member (used when leaving a project)
CREATE OR REPLACE FUNCTION remove_device_id(member_id UUID, device_id TEXT)
RETURNS void AS $$
  UPDATE members
  SET device_ids = array_remove(device_ids, device_id)
  WHERE id = member_id;
$$ LANGUAGE sql;
