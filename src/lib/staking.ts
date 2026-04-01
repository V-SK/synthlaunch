import { formatUnits, isAddress, type Address } from 'viem';
import { SYNTH_TOKEN_ADDRESS } from '@/lib/contracts';

export const STAKING_CHAIN_ID = 56;
export const STAKING_COOLDOWN_SECONDS = 7 * 24 * 60 * 60;

const FALLBACK_STAKING_CONTRACT_ADDRESS = '0xCDf39d6c55997f3F937287bA45c33d76bB98fE03';

export const STAKING_CONTRACT_ADDRESS_RAW = process.env.NEXT_PUBLIC_STAKING_CONTRACT ?? '';
export const STAKING_CONTRACT_ADDRESS_NORMALIZED = STAKING_CONTRACT_ADDRESS_RAW.trim();
const stakingAddressCandidate =
  STAKING_CONTRACT_ADDRESS_NORMALIZED.length > 0
    ? STAKING_CONTRACT_ADDRESS_NORMALIZED
    : FALLBACK_STAKING_CONTRACT_ADDRESS;

export const STAKING_CONTRACT_ADDRESS =
  stakingAddressCandidate && isAddress(stakingAddressCandidate)
    ? (stakingAddressCandidate as Address)
    : undefined;

export const STAKING_CONTRACT_CONFIG_ERROR =
  STAKING_CONTRACT_ADDRESS_NORMALIZED.length === 0
    ? null
    : STAKING_CONTRACT_ADDRESS
      ? null
      : 'invalid';

export const STAKING_ABI = [
  {
    inputs: [],
    name: 'COOLDOWN_PERIOD',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'synthToken_', type: 'address' }, { name: 'rewardToken_', type: 'address' }],
    stateMutability: 'nonpayable',
    type: 'constructor',
  },
  {
    inputs: [],
    name: 'finalizeUnstake',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'getStakeInfo',
    outputs: [
      { name: 'stakedAmount', type: 'uint256' },
      { name: 'multiplier', type: 'uint256' },
      { name: 'stakeTimestamp', type: 'uint256' },
      { name: 'unstakeRequestTime', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'amount', type: 'uint256' }],
    name: 'stake',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'requestUnstake',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalActiveStaked',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export const MULTIPLIER_TIERS = [
  { multiplier: 1, startSeconds: 0, endSeconds: 7 * 24 * 60 * 60 },
  { multiplier: 2, startSeconds: 7 * 24 * 60 * 60, endSeconds: 30 * 24 * 60 * 60 },
  { multiplier: 3, startSeconds: 30 * 24 * 60 * 60, endSeconds: 90 * 24 * 60 * 60 },
  { multiplier: 4, startSeconds: 90 * 24 * 60 * 60, endSeconds: 180 * 24 * 60 * 60 },
  { multiplier: 5, startSeconds: 180 * 24 * 60 * 60, endSeconds: null },
] as const;

export type StakingLocale = 'en' | 'zh';

export function getMultiplierForElapsed(secondsElapsed: number): number {
  if (secondsElapsed < MULTIPLIER_TIERS[1].startSeconds) return 1;
  if (secondsElapsed < MULTIPLIER_TIERS[2].startSeconds) return 2;
  if (secondsElapsed < MULTIPLIER_TIERS[3].startSeconds) return 3;
  if (secondsElapsed < MULTIPLIER_TIERS[4].startSeconds) return 4;
  return 5;
}

export function getNextMultiplierInfo(stakeTimestamp: number, nowTimestamp: number) {
  if (!stakeTimestamp || nowTimestamp <= stakeTimestamp) {
    return {
      currentMultiplier: 1,
      nextMultiplier: 2,
      secondsUntilNext: MULTIPLIER_TIERS[1].startSeconds,
    };
  }

  const elapsed = nowTimestamp - stakeTimestamp;
  const currentMultiplier = getMultiplierForElapsed(elapsed);
  const nextTier = MULTIPLIER_TIERS.find((tier) => tier.multiplier === currentMultiplier + 1);

  if (!nextTier) {
    return {
      currentMultiplier,
      nextMultiplier: null,
      secondsUntilNext: null,
    };
  }

  return {
    currentMultiplier,
    nextMultiplier: nextTier.multiplier,
    secondsUntilNext: Math.max(nextTier.startSeconds - elapsed, 0),
  };
}

export function formatCountdown(totalSeconds: number, locale: StakingLocale = 'en') {
  const seconds = Math.max(Math.floor(totalSeconds), 0);
  const days = Math.floor(seconds / (24 * 60 * 60));
  const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((seconds % (60 * 60)) / 60);

  if (locale === 'zh') {
    if (days > 0) return `${days}天 ${hours}小时`;
    if (hours > 0) return `${hours}小时 ${minutes}分钟`;
    return `${minutes}分钟`;
  }

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function formatStakingAmount(value: bigint | undefined, decimals = 18, maximumFractionDigits = 2) {
  if (value === undefined) return '--';

  const formatted = Number(formatUnits(value, decimals));
  if (!Number.isFinite(formatted)) return '--';

  return formatted.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  });
}

export { SYNTH_TOKEN_ADDRESS };
