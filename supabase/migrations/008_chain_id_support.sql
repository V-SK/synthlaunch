-- Multi-chain support: add chain_id to tokens.
-- Backfill existing rows with 56 (BSC) since that was the implicit default.
-- Run this in Supabase Dashboard > SQL Editor, or via the Supabase CLI.

ALTER TABLE IF EXISTS tokens
  ADD COLUMN IF NOT EXISTS chain_id INTEGER NOT NULL DEFAULT 56;

CREATE INDEX IF NOT EXISTS idx_tokens_chain_id
  ON tokens (chain_id);

-- Supported chain check (soft constraint via CHECK so bad writes get rejected).
ALTER TABLE IF EXISTS tokens
  DROP CONSTRAINT IF EXISTS tokens_chain_id_check;
ALTER TABLE IF EXISTS tokens
  ADD CONSTRAINT tokens_chain_id_check CHECK (chain_id IN (56, 196));
