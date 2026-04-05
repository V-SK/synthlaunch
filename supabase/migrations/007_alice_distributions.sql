-- Alice reward distribution records

CREATE TABLE IF NOT EXISTS alice_distributions (
  id SERIAL PRIMARY KEY,
  round_id TEXT NOT NULL,                    -- unique per distribution round (timestamp-based)
  bsc_address TEXT NOT NULL,
  alice_address TEXT NOT NULL,
  staked_amount TEXT NOT NULL,               -- raw staked SYNTH (bigint as text)
  multiplier INTEGER NOT NULL,
  weight TEXT NOT NULL,                      -- stakedAmount * multiplier (bigint as text)
  share NUMERIC(10, 6) NOT NULL,             -- 0-1 proportion
  alice_amount TEXT NOT NULL,                -- raw ALICE sent (bigint as text)
  alice_readable TEXT NOT NULL,              -- human-readable amount
  tx_hash TEXT,                              -- Alice chain tx hash (null if failed)
  status TEXT NOT NULL DEFAULT 'pending',    -- pending, success, failed
  error_msg TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alice_dist_round ON alice_distributions(round_id);
CREATE INDEX IF NOT EXISTS idx_alice_dist_bsc ON alice_distributions(bsc_address);
CREATE INDEX IF NOT EXISTS idx_alice_dist_created ON alice_distributions(created_at DESC);

-- Summary per round
CREATE TABLE IF NOT EXISTS alice_distribution_rounds (
  round_id TEXT PRIMARY KEY,
  total_pool TEXT NOT NULL,                  -- total ALICE distributed this round
  pool_balance TEXT NOT NULL,                -- sender wallet balance before distribution
  recipient_count INTEGER NOT NULL,
  success_count INTEGER NOT NULL DEFAULT 0,
  fail_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'running',    -- running, completed, failed
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
