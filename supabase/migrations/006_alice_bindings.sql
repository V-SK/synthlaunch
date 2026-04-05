-- Alice wallet binding tables
-- Maps BSC staking wallets to Alice chain addresses for reward distribution

CREATE TABLE IF NOT EXISTS alice_bindings (
  bsc_address TEXT PRIMARY KEY,
  alice_address TEXT NOT NULL,
  signature TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alice_bindings_alice
  ON alice_bindings(alice_address);

CREATE TABLE IF NOT EXISTS alice_binding_nonces (
  nonce TEXT PRIMARY KEY,
  bsc_address TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alice_binding_nonces_bsc
  ON alice_binding_nonces(bsc_address);
