CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS ai_users (
  wallet_address TEXT PRIMARY KEY,
  risk_bias TEXT NOT NULL DEFAULT 'balanced',
  preferred_quote_token TEXT NOT NULL DEFAULT 'USDT',
  watchlist JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_session_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL REFERENCES ai_users(wallet_address) ON DELETE CASCADE,
  chain_id INTEGER NOT NULL DEFAULT 196,
  title TEXT NOT NULL DEFAULT 'OKX AI Session',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES ai_sessions(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL REFERENCES ai_users(wallet_address) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES ai_sessions(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL REFERENCES ai_users(wallet_address) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  status TEXT NOT NULL,
  tx_hash TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_sessions_wallet_address ON ai_sessions(wallet_address, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_messages_session_id ON ai_messages(session_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_ai_actions_session_id ON ai_actions(session_id, created_at DESC);

CREATE OR REPLACE FUNCTION touch_ai_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ai_users_updated_at ON ai_users;
CREATE TRIGGER trg_ai_users_updated_at
BEFORE UPDATE ON ai_users
FOR EACH ROW
EXECUTE FUNCTION touch_ai_users_updated_at();
