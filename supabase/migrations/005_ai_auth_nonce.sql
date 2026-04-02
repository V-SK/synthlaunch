CREATE TABLE IF NOT EXISTS ai_auth_nonces (
  nonce TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL REFERENCES ai_users(wallet_address) ON DELETE CASCADE,
  message TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_auth_nonces_wallet_address
  ON ai_auth_nonces(wallet_address, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_auth_nonces_expires_at
  ON ai_auth_nonces(expires_at);
