# RISE BSC Prototype Runbook v0

**Date**: 2026-04-14
**Purpose**: local and testnet deployment / verification guide for the current BSC-native prototype.

---

## 1. Scope

This runbook covers the current prototype deployment for:

- `RiseProtocolConfig`
- `RiseMarketCore`
- `RiseFeeRouter`
- `RisePositionManager`
- `RiseMarketFactory`

The current prototype already supports:

- market creation
- `buy`
- `sell`
- `redeemAtFloor`
- `depositCollateral`
- `borrow`
- `repay`
- `withdrawCollateral`
- creator fee claim
- treasury fee claim
- pause boundaries

---

## 2. Requirements

- Node.js with npm installed
- dependencies installed with `npm install`
- a funded deployer key in `.env.local` or `.env`
- a target network configured in `hardhat.config.ts`

The current Hardhat config already includes:

- `bscTestnet`
- `bscMainnet`
- `xlayer`

---

## 3. Environment Variables

Deployment uses the following environment variables:

- `DEPLOYER_PRIVATE_KEY` or `EVA_PRIVATE_KEY`
- `RISE_TREASURY_VAULT`
- `RISE_TIMELOCK`
- `RISE_PAUSE_GUARDIAN`
- `RISE_CREATION_FEE_WEI`
- `RISE_BACKING_ASSETS`

Example:

```bash
export RISE_TREASURY_VAULT=0xYourTreasuryVault
export RISE_TIMELOCK=0xYourTimelock
export RISE_PAUSE_GUARDIAN=0xYourPauseGuardian
export RISE_CREATION_FEE_WEI=10000000000000000
export RISE_BACKING_ASSETS=0xBackingAsset1,0xBackingAsset2
```

Notes:

- `RISE_CREATION_FEE_WEI` defaults to `0.01` native token if omitted.
- `RISE_BACKING_ASSETS` is optional, but without it no backing asset is allowlisted after deployment.

---

## 4. Local Validation

Run compile:

```bash
npx hardhat compile
```

Run full contract test suite:

```bash
npx hardhat test \
  test/RiseMarketBootstrap.ts \
  test/RiseMarketCore.trade.ts \
  test/RisePositionManager.borrow.ts \
  test/RiseFeeRouter.claim.ts \
  test/RiseMarketPause.ts \
  test/RiseInvariant.random.ts \
  test/RiseEdgeCases.ts \
  test/RiseTreasuryClaim.ts
```

Current expected result:

- all tests passing

---

## 5. Deploy to Testnet

Run:

```bash
npx hardhat run scripts/deploy-rise.ts --network bscTestnet
```

The script deploys contracts in this order:

1. `RiseProtocolConfig`
2. `RiseMarketCore`
3. `RiseFeeRouter`
4. `RisePositionManager`
5. `RiseMarketFactory`

Then it wires:

- `feeRouter -> core`
- `core -> feeRouter`
- `core -> positionManager`
- `core -> marketFactory`
- `core -> treasuryVault`
- backing asset allowlist in `protocolConfig`

---

## 6. Post-Deploy Smoke Checklist

After deployment, verify:

1. `RiseProtocolConfig.isBackingAssetAllowed(asset)` returns `true` for each intended backing asset.
2. `RiseMarketCore.marketFactory()` equals deployed factory.
3. `RiseMarketCore.positionManager()` equals deployed position manager.
4. `RiseMarketCore.feeRouter()` equals deployed fee router.
5. `RiseMarketCore.treasuryVault()` equals the configured treasury vault.

Then run a basic user flow:

1. create market
2. buy
3. sell
4. deposit collateral
5. borrow
6. repay
7. withdraw collateral
8. claim creator fees
9. claim treasury fees

---

## 7. Known Prototype Limitations

This prototype is functional, but it is not yet final-production code.

Open items still to refine:

- floor reserve release semantics
- treasury claim governance policy
- richer pause/timelock integration with `ProtocolConfig`
- more multi-market / long-sequence testing
- deployment artifact persistence and operator tooling

---

## 8. Recommended Next Step

After the first successful `bscTestnet` deployment:

- save deployed addresses in a JSON deployment manifest
- build a script-driven smoke test against live testnet contracts
- connect a minimal frontend or admin page for manual verification
