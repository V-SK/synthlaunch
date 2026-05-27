-- Synth FanFi / SportFi Arena — wallet ownership enforcement for fan_id.
--
-- Closes the audit finding that anyone with any wallet could sign a receipt
-- under any fan_id, polluting another fan's leaderboard. After this
-- migration, the first wallet that writes a profile owns the fan_id;
-- subsequent writes must match owner_wallet.
--
-- Apply via Supabase Dashboard > SQL Editor. Idempotent.

ALTER TABLE IF EXISTS fanfi_profiles
  ADD COLUMN IF NOT EXISTS owner_wallet TEXT NOT NULL DEFAULT '';

-- Backfill: for any existing row with a non-empty `wallet` but empty
-- `owner_wallet`, lock the wallet that already wrote as the owner.
UPDATE fanfi_profiles
SET    owner_wallet = wallet
WHERE  owner_wallet = ''
  AND  wallet IS NOT NULL
  AND  wallet <> '';

-- Helpful index for the ownership lookup on every write path.
CREATE INDEX IF NOT EXISTS idx_fanfi_profiles_owner_wallet
  ON fanfi_profiles (owner_wallet)
  WHERE owner_wallet <> '';
