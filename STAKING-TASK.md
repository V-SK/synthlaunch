# SynthLaunch Staking Phase 1 — Full Task

Reference: https://synthlaunch.fun | Repo: V-SK/synthlaunch

---

## Bootstrap
- Clone to ~/synthlaunch if not present: `gh repo clone V-SK/synthlaunch ~/synthlaunch`
- All work happens in ~/synthlaunch

---

## Config
- Update hardhat.config.ts to load .env.local via dotenv before reading DEPLOYER_PRIVATE_KEY
- Add `NEXT_PUBLIC_STAKING_CONTRACT=` to .env.example only — do NOT touch .env.local

---

## contracts/SynthStaking.sol (Solidity 0.8.20)

```
constructor(address synthToken_, address rewardToken_) Ownable(msg.sender)
```

Public state:
- `IERC20 public immutable synthToken`
- `address public immutable rewardToken`
- `uint256 public constant COOLDOWN_PERIOD = 7 days`
- `uint256 public totalActiveStaked`

Position per wallet: `amount, stakeTimestamp, unstakeRequestTime, frozenMultiplier`

### stake(uint256 amount)
- No position → create at 1x, stakeTimestamp = now
- Active, no unstake → top-up: add amount, reset stakeTimestamp = now, clear frozenMultiplier (restarts at 1x). Show note in UI that this resets timer.
- In cooldown → revert

### requestUnstake()
- Whole position only
- Capture current multiplier → frozenMultiplier
- unstakeRequestTime = block.timestamp
- Subtract full amount from totalActiveStaked immediately

### finalizeUnstake()
- Require unstakeRequestTime set and 7 days elapsed
- Transfer SYNTH back to user
- Delete/reset entire position

### getStakeInfo(address) returns (stakedAmount, multiplier, stakeTimestamp, unstakeRequestTime)
- Active: multiplier computed from duration
- Pending unstake: multiplier = frozenMultiplier
- Empty: all zero

### Multiplier schedule
- < 7 days → 1x
- < 30 days → 2x
- < 90 days → 3x
- < 180 days → 4x
- >= 180 days → 5x

### Guardrails
- Revert: zero stake, stake during cooldown, requestUnstake with no position, finalize before 7 days
- No reward logic in Phase 1 (rewardToken is placeholder)
- Uses OpenZeppelin: Ownable, ReentrancyGuard, IERC20

---

## Frontend & Routes

### Route changes
- Move current / content → /tokens (extract as reusable TokensHome component, no behavior regression)
- New / → Staking page only

### Header
- Both desktop + mobile: right-side hamburger/dropdown
- Menu items ONLY: Launch → /launch | Tokens → /tokens | Docs → /docs
- Leave /nfa, /dashboard, /chat, /claim, /leaderboard intact but NOT in primary nav

### Staking contract config
- Dedicated module with ABI + contract address (from NEXT_PUBLIC_STAKING_CONTRACT)
- Helper functions:
  - multiplier tier lookup
  - next-tier countdown text (e.g. "2x → 3x in 23 days")
  - cooldown countdown text

### Read path (viem via wagmi public client)
- totalActiveStaked
- getStakeInfo(connectedAddress)
- SYNTH balanceOf, allowance, decimals

### Write path (wagmi useWriteContract)
- approve, stake, requestUnstake, finalizeUnstake
- Stake area is allowance-aware: show "Approve SYNTH" first, then "Stake"

### Staking homepage layout (match synthlaunch.fun visual system exactly)

Top stats cards:
- Total SYNTH Staked
- Your Stake
- Your Multiplier

Connected wallet panel:
- Staked amount
- Multiplier progress: "2x → 3x in 23 days"
- Cooldown countdown if pending

Action area:
- Amount input
- Allowance-aware Stake CTA (Approve first if needed)
- Full-position Unstake button
- Finalize Unstake button (active only after 7-day cooldown)

### UX rules
- If NEXT_PUBLIC_STAKING_CONTRACT unset → render staking UI in disabled/unavailable state (no crash)
- During cooldown: multiplier display frozen, show countdown
- totalActiveStaked excludes positions after requestUnstake()
- Show note near stake: "Adding more stake resets your timer to 1x"

### i18n
- Add new keys to both en.json and zh.json for:
  - nav "Tokens"
  - all staking labels and messages

---

## scripts/deploy-staking.js
- Use `hre.ethers.getContractFactory` (match existing repo convention)
- Deploy `SynthStaking(0x83c8c815bbf6a239816aa0b14ba9d9222b817777, address(0))`
- BSC mainnet RPC from existing Hardhat network config
- Print: deployer address, contract address, tx hash
- No verify step

---

## Tests: test/SynthStaking.test.ts (Hardhat)

Cover:
- First stake stores amount + timestamp, multiplier = 1x
- Multiplier changes at 7/30/90/180 day boundaries
- Top-up increases amount, resets multiplier + timestamp
- requestUnstake() freezes multiplier, removes from totalActiveStaked
- No new stake while cooldown pending
- finalizeUnstake() reverts before 7 days, succeeds after
- After finalize, next stake restarts at 1x

---

## Checks before commit
```bash
npx hardhat compile
npx hardhat test
npm run build
```

---

## Delivery
```bash
git add -A
git commit -m "feat: staking contract + UI phase 1"
git push
```
Output: contract address + list of changed files
