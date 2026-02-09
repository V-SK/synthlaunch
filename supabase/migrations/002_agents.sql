-- Agents table for AI Agent hosting

CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_address TEXT NOT NULL,
  name TEXT NOT NULL,
  bot_token_encrypted TEXT NOT NULL,
  description TEXT,
  plan TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  payment_amount NUMERIC,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  tx_hash TEXT UNIQUE,
  container_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_agents_user_address ON agents(user_address);
