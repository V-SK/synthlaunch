-- Synth FanFi / SportFi Arena production persistence.
-- Replaces ephemeral /tmp/synthlaunch/fanfi-*.json files used during local
-- demo. Apply via Supabase Dashboard > SQL Editor.
--
-- Run after migration 008. Idempotent (uses IF NOT EXISTS everywhere).

-- =====================================================================
-- 1. Campaigns: user-created prediction arena drafts.
-- =====================================================================

CREATE TABLE IF NOT EXISTS fanfi_campaigns (
  id            TEXT PRIMARY KEY,
  fan_id        TEXT NOT NULL,
  template_id   TEXT NOT NULL,
  title         TEXT NOT NULL,
  symbol        TEXT NOT NULL,
  objective     TEXT NOT NULL,
  target_match  TEXT NOT NULL,
  tone          TEXT NOT NULL,
  launch_draft  TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'ready', 'launched')),
  token_address TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fanfi_campaigns_fan_id
  ON fanfi_campaigns (fan_id);

CREATE INDEX IF NOT EXISTS idx_fanfi_campaigns_updated_at
  ON fanfi_campaigns (updated_at DESC);

-- =====================================================================
-- 2. Market proofs: signed prediction receipts (the real product output).
-- =====================================================================

CREATE TABLE IF NOT EXISTS fanfi_market_proofs (
  id                     TEXT PRIMARY KEY,
  fan_id                 TEXT NOT NULL,
  campaign_id            TEXT,
  template_id            TEXT NOT NULL,
  name                   TEXT NOT NULL,
  symbol                 TEXT NOT NULL,
  token_address          TEXT NOT NULL,
  tx_hash                TEXT NOT NULL DEFAULT '',
  receipt_hash           TEXT NOT NULL,
  wallet_signature       TEXT NOT NULL,
  signature_message      TEXT NOT NULL,
  wallet                 TEXT NOT NULL DEFAULT '',
  objective              TEXT NOT NULL,
  target_match           TEXT NOT NULL,
  tone                   TEXT NOT NULL,

  -- Structured prediction fields (parsed/forwarded from objective).
  -- Settlement engine uses these for scoring.
  prediction_direction   TEXT,
  prediction_probability NUMERIC,
  prediction_reason      TEXT,

  -- Settlement spec (set at receipt creation, never mutated except by settle endpoint).
  settlement_rule        TEXT NOT NULL,
  settlement_source      TEXT NOT NULL,
  settlement_cutoff      TEXT NOT NULL,
  settlement_status      TEXT NOT NULL DEFAULT 'open'
                         CHECK (settlement_status IN ('open', 'locked', 'resolved')),

  -- Settlement result (populated by admin settle endpoint after the match).
  resolved_at            TIMESTAMPTZ,
  resolved_outcome       TEXT,
  reputation_points      INTEGER NOT NULL DEFAULT 0,
  reputation_breakdown   JSONB,

  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fanfi_market_proofs_fan_id
  ON fanfi_market_proofs (fan_id);

CREATE INDEX IF NOT EXISTS idx_fanfi_market_proofs_token_address
  ON fanfi_market_proofs (token_address);

CREATE INDEX IF NOT EXISTS idx_fanfi_market_proofs_template_id
  ON fanfi_market_proofs (template_id);

CREATE INDEX IF NOT EXISTS idx_fanfi_market_proofs_settlement_status
  ON fanfi_market_proofs (settlement_status);

CREATE INDEX IF NOT EXISTS idx_fanfi_market_proofs_created_at
  ON fanfi_market_proofs (created_at DESC);

-- Unique constraint on wallet_signature to enforce idempotency: re-submitting
-- the same signed receipt returns the existing record instead of creating dup.
CREATE UNIQUE INDEX IF NOT EXISTS idx_fanfi_market_proofs_signature
  ON fanfi_market_proofs (wallet_signature);

-- =====================================================================
-- 3. Profiles: aggregated fan reputation (one row per fan_id).
-- =====================================================================

CREATE TABLE IF NOT EXISTS fanfi_profiles (
  fan_id     TEXT PRIMARY KEY,
  handle     TEXT NOT NULL,
  wallet     TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- 4. Completions: per-mission proof + points (drives the leaderboard).
-- =====================================================================

CREATE TABLE IF NOT EXISTS fanfi_completions (
  id           BIGSERIAL PRIMARY KEY,
  fan_id       TEXT NOT NULL REFERENCES fanfi_profiles(fan_id) ON DELETE CASCADE,
  mission_id   TEXT NOT NULL,
  proof        TEXT NOT NULL,
  points       INTEGER NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One completion per (fan, mission). Re-submitting upserts.
  UNIQUE (fan_id, mission_id)
);

CREATE INDEX IF NOT EXISTS idx_fanfi_completions_fan_id
  ON fanfi_completions (fan_id);

CREATE INDEX IF NOT EXISTS idx_fanfi_completions_completed_at
  ON fanfi_completions (completed_at DESC);
