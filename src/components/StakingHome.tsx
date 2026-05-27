'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import { StakingLeaderboard } from '@/components/StakingLeaderboard';
import {
  STAKING_COOLDOWN_SECONDS,
  STAKING_CONTRACT_ADDRESS_NORMALIZED,
  STAKING_CONTRACT_CONFIG_ERROR,
  formatCountdown,
  formatStakingAmount,
  getNextMultiplierInfo,
} from '@/lib/staking';
import { useStaking } from '@/hooks/useStaking';

export function StakingHome() {
  const { locale, t } = useI18n();
  const [amountInput, setAmountInput] = useState('');
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const {
    hasStakingContract,
    isConnected,
    stakedAmount,
    multiplier,
    stakeTimestamp,
    unstakeRequestTime,
    totalActiveStaked,
    balance,
    decimals,
    parsedAmount,
    needsApproval,
    hasPendingUnstake,
    isPending,
    isConfirming,
    hash,
    error,
    activeAction,
    approve,
    stake,
    requestUnstake,
    finalizeUnstake,
  } = useStaking(amountInput);

  // Distribution pool balance
  const [poolBalance, setPoolBalance] = useState<string | null>(null);
  const [poolAddress] = useState('a2t35oD3DjDnFbe3RRm6g4nzp7SBSjVrWVu6h4cpR1chRXhkL');

  const fetchPoolBalance = useCallback(async () => {
    try {
      const res = await fetch('/api/alice-stats');
      if (!res.ok) return;
      const data = await res.json();
      setPoolBalance(data.poolBalanceReadable ?? null);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchPoolBalance();
    const interval = window.setInterval(fetchPoolBalance, 30 * 60 * 1000); // 30 min
    return () => window.clearInterval(interval);
  }, [fetchPoolBalance]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Math.floor(Date.now() / 1000));
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  const nextInfo = useMemo(
    () => getNextMultiplierInfo(stakeTimestamp, now),
    [now, stakeTimestamp]
  );

  const cooldownEndsAt = unstakeRequestTime > 0 ? unstakeRequestTime + STAKING_COOLDOWN_SECONDS : 0;
  const cooldownSecondsRemaining = cooldownEndsAt > now ? cooldownEndsAt - now : 0;
  const finalizeReady = hasPendingUnstake && cooldownSecondsRemaining === 0;

  const progressText = useMemo(() => {
    if (!stakedAmount) {
      return t('staking.progressEmpty');
    }

    if (hasPendingUnstake) {
      return t('staking.progressFrozen', { multiplier: String(multiplier) });
    }

    if (!nextInfo.nextMultiplier || nextInfo.secondsUntilNext === null) {
      return t('staking.progressMaxed');
    }

    return t('staking.progressToNext', {
      current: String(nextInfo.currentMultiplier),
      next: String(nextInfo.nextMultiplier),
      remaining: formatCountdown(nextInfo.secondsUntilNext, locale),
    });
  }, [hasPendingUnstake, locale, multiplier, nextInfo, stakedAmount, t]);

  const stakeButtonLabel = useMemo(() => {
    if (activeAction === 'approve' && (isPending || isConfirming)) return t('staking.approving');
    if (activeAction === 'stake' && (isPending || isConfirming)) return t('staking.staking');
    return needsApproval ? t('staking.approve') : t('staking.stake');
  }, [activeAction, isConfirming, isPending, needsApproval, t]);

  const unstakeButtonLabel =
    activeAction === 'requestUnstake' && (isPending || isConfirming)
      ? t('staking.requestingUnstake')
      : t('staking.requestUnstake');

  const finalizeButtonLabel =
    activeAction === 'finalizeUnstake' && (isPending || isConfirming)
      ? t('staking.finalizingUnstake')
      : t('staking.finalizeUnstake');

  const canSubmitStake =
    hasStakingContract &&
    isConnected &&
    !hasPendingUnstake &&
    parsedAmount !== null &&
    parsedAmount <= balance &&
    !isPending &&
    !isConfirming;

  const unstakeDisabled = !hasStakingContract || !isConnected || hasPendingUnstake || stakedAmount === 0n || isPending || isConfirming;
  const finalizeDisabled = !hasStakingContract || !isConnected || !finalizeReady || isPending || isConfirming;

  const statusMessage = error?.message
    ? error.message
    : hash && (isPending || isConfirming)
      ? t('staking.txPending')
      : hash
        ? t('staking.txSubmitted', { hash: `${hash.slice(0, 10)}...` })
        : '';

  return (
    <div className="space-y-8">
      <section className="text-center py-12 space-y-4">
        <div className="flex items-center justify-center gap-2 mb-4 flex-wrap">
          <a
            href="https://www.oklink.com/x-layer/address/0xb381e840AAB505132506781eAFD3c38398B58462"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-[10px] px-2 py-1 bg-synth-green/15 text-synth-green border border-synth-green/40 rounded font-mono hover:bg-synth-green/25 transition-colors"
          >
            ● LIVE ON X LAYER ↗
          </a>
          <a
            href="https://bscscan.com/address/0x3Fa33A0fb85f11A901e3616E10876d10018f43B7"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-[10px] px-2 py-1 bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 rounded font-mono hover:bg-yellow-500/20 transition-colors"
          >
            ● LIVE ON BSC ↗
          </a>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-synth-text">
          {t('staking.heroTitle')}
          <br />
          <span className="text-synth-green glow-text-green">{t('staking.heroSubtitle')}</span>
        </h1>
        <p className="text-synth-muted max-w-2xl mx-auto text-sm leading-relaxed">
          {t('staking.heroDesc')}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
          <Link href="/fanfi/xcup" className="btn-primary min-w-[160px]">
            {locale === 'zh' ? 'X Cup 竞技场' : 'X Cup Arena'}
          </Link>
          <Link href="/build-x-hook" className="btn-secondary min-w-[160px]">
            {locale === 'zh' ? 'Hook 控制台' : 'Build X Hook'}
          </Link>
          <Link href="/ai" className="btn-primary min-w-[180px]">
            Open AI Terminal
          </Link>
          <Link href="/tokens" className="btn-secondary min-w-[160px]">
            Browse Tokens
          </Link>
          <Link href="/alice-wallet" className="btn-secondary min-w-[160px] flex items-center justify-center gap-2">
            ⚡ Alice Wallet
          </Link>
        </div>
      </section>

      {/* Alice Introduction */}
      <section className="card space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-synth-text">
            {t('staking.aliceIntroTitle')}
          </h2>
          <p className="text-synth-muted text-sm max-w-2xl mx-auto leading-relaxed">
            {t('staking.aliceIntroDesc')}
          </p>
        </div>

        {/* Flow: Tax → Compute → Alice */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-3 md:gap-0">
          {/* Step 1 */}
          <div className="flex flex-col items-center text-center px-6 py-4 rounded-lg bg-synth-green/5 border border-synth-green/20 min-w-[140px]">
            <div className="text-2xl mb-2">💰</div>
            <div className="text-xs font-mono text-synth-green uppercase tracking-wider mb-1">{t('staking.flowStep1Label')}</div>
            <div className="text-sm text-synth-text font-semibold">{t('staking.flowStep1Title')}</div>
            <div className="text-xs text-synth-muted mt-1">{t('staking.flowStep1Desc')}</div>
          </div>

          <div className="text-synth-green text-2xl font-bold md:mx-3 rotate-90 md:rotate-0">→</div>

          {/* Step 2 */}
          <div className="flex flex-col items-center text-center px-6 py-4 rounded-lg bg-synth-cyan/5 border border-synth-cyan/20 min-w-[140px]">
            <div className="text-2xl mb-2">⚡</div>
            <div className="text-xs font-mono text-synth-cyan uppercase tracking-wider mb-1">{t('staking.flowStep2Label')}</div>
            <div className="text-sm text-synth-text font-semibold">{t('staking.flowStep2Title')}</div>
            <div className="text-xs text-synth-muted mt-1">{t('staking.flowStep2Desc')}</div>
          </div>

          <div className="text-synth-green text-2xl font-bold md:mx-3 rotate-90 md:rotate-0">→</div>

          {/* Step 3 */}
          <div className="flex flex-col items-center text-center px-6 py-4 rounded-lg bg-purple-500/5 border border-purple-500/20 min-w-[140px]">
            <div className="text-2xl mb-2">🧠</div>
            <div className="text-xs font-mono text-purple-400 uppercase tracking-wider mb-1">{t('staking.flowStep3Label')}</div>
            <div className="text-sm text-synth-text font-semibold">{t('staking.flowStep3Title')}</div>
            <div className="text-xs text-synth-muted mt-1">{t('staking.flowStep3Desc')}</div>
          </div>

          <div className="text-synth-green text-2xl font-bold md:mx-3 rotate-90 md:rotate-0">→</div>

          {/* Step 4 */}
          <div className="flex flex-col items-center text-center px-6 py-4 rounded-lg bg-yellow-500/5 border border-yellow-500/20 min-w-[140px]">
            <div className="text-2xl mb-2">🪙</div>
            <div className="text-xs font-mono text-yellow-400 uppercase tracking-wider mb-1">{t('staking.flowStep4Label')}</div>
            <div className="text-sm text-synth-text font-semibold">{t('staking.flowStep4Title')}</div>
            <div className="text-xs text-synth-muted mt-1">{t('staking.flowStep4Desc')}</div>
          </div>
        </div>

        <p className="text-center text-xs text-synth-muted border-t border-synth-border pt-4">
          {t('staking.aliceFlowNote')}
        </p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card py-5">
          <div className="text-[10px] text-synth-muted uppercase tracking-wider mb-2">{t('staking.totalStaked')}</div>
          <div className="text-2xl font-bold text-synth-green">{formatStakingAmount(totalActiveStaked, decimals)} SYNTH</div>
        </div>
        <div className="card py-5">
          <div className="text-[10px] text-synth-muted uppercase tracking-wider mb-2">{t('staking.yourStake')}</div>
          <div className="text-2xl font-bold text-synth-cyan">
            {isConnected ? `${formatStakingAmount(stakedAmount, decimals)} SYNTH` : '--'}
          </div>
        </div>
        <div className="card py-5">
          <div className="text-[10px] text-synth-muted uppercase tracking-wider mb-2">{t('staking.yourMultiplier')}</div>
          <div className="text-2xl font-bold text-synth-text">
            {isConnected && stakedAmount > 0n ? `${multiplier}x / 5x` : '--'}
          </div>
        </div>
        <div className="card py-5">
          <div className="text-[10px] text-synth-muted uppercase tracking-wider mb-2">ALICE Distribution Pool</div>
          <div className="text-2xl font-bold text-yellow-400">
            {poolBalance ? `${poolBalance} ALICE` : '--'}
          </div>
          <a
            href={`https://aliceprotocol.org`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-synth-muted hover:text-synth-green mt-1 inline-block font-mono truncate max-w-full"
          >
            {poolAddress.slice(0, 10)}...{poolAddress.slice(-6)}
          </a>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] gap-6">
        <div className="card space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-synth-text">{t('staking.panelTitle')}</h2>
              <p className="text-xs text-synth-muted mt-1">{t('staking.panelDesc')}</p>
            </div>
            {isConnected && (
              <div className="text-right">
                <div className="text-[10px] text-synth-muted uppercase tracking-wider">{t('staking.walletBalance')}</div>
                <div className="text-sm text-synth-green font-bold">{formatStakingAmount(balance, decimals)} SYNTH</div>
              </div>
            )}
          </div>

          {!hasStakingContract && (
            <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-[#F0B90B]">
              {STAKING_CONTRACT_CONFIG_ERROR === 'invalid'
                ? t('staking.contractInvalid', { address: STAKING_CONTRACT_ADDRESS_NORMALIZED })
                : t('staking.contractUnavailable')}
            </div>
          )}

          {isConnected ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-lg border border-synth-border bg-synth-bg/70 p-4">
                <div className="text-[10px] uppercase tracking-wider text-synth-muted mb-2">{t('staking.currentStake')}</div>
                <div className="text-lg font-bold text-synth-text">{formatStakingAmount(stakedAmount, decimals)} SYNTH</div>
              </div>
              <div className="rounded-lg border border-synth-border bg-synth-bg/70 p-4">
                <div className="text-[10px] uppercase tracking-wider text-synth-muted mb-2">{t('staking.currentMultiplier')}</div>
                <div className="text-lg font-bold text-synth-green">{stakedAmount > 0n ? `${multiplier}x / 5x` : '--'}</div>
                <div className="text-xs text-synth-muted mt-2">{progressText}</div>
              </div>
              <div className="rounded-lg border border-synth-border bg-synth-bg/70 p-4">
                <div className="text-[10px] uppercase tracking-wider text-synth-muted mb-2">{t('staking.unstakeStatus')}</div>
                {hasPendingUnstake ? (
                  <>
                    <div className="text-lg font-bold text-[#F0B90B]">
                      {finalizeReady ? t('staking.readyToFinalize') : t('staking.cooldownActive')}
                    </div>
                    <div className="text-xs text-synth-muted mt-2">
                      {finalizeReady
                        ? t('staking.finalizeReady')
                        : t('staking.cooldownRemaining', {
                            remaining: formatCountdown(cooldownSecondsRemaining, locale),
                          })}
                    </div>
                  </>
                ) : (
                  <div className="text-lg font-bold text-synth-text">{t('staking.noPendingUnstake')}</div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-synth-border bg-synth-bg/70 p-5 text-sm text-synth-muted">
              {t('staking.connectPrompt')}
            </div>
          )}

          <div className="space-y-4 border-t border-synth-border pt-5">
            <div>
              <label htmlFor="staking-amount" className="block text-xs font-mono text-synth-muted uppercase tracking-wider mb-2">
                {t('staking.amountLabel')}
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  id="staking-amount"
                  type="text"
                  inputMode="decimal"
                  value={amountInput}
                  onChange={(event) => setAmountInput(event.target.value)}
                  placeholder={t('staking.amountPlaceholder')}
                  className="input-field flex-1"
                  disabled={!hasStakingContract || hasPendingUnstake}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (needsApproval) {
                      approve();
                    } else {
                      stake();
                    }
                  }}
                  className="btn-primary min-w-[180px]"
                  disabled={!canSubmitStake}
                >
                  {stakeButtonLabel}
                </button>
              </div>
              <div className="mt-2 flex flex-col gap-1 text-xs text-synth-muted">
                <span>{t('staking.resetTimerNote')}</span>
                {parsedAmount !== null && parsedAmount > balance && (
                  <span className="text-red-400">{t('staking.insufficientBalance')}</span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={requestUnstake}
                className="w-full px-4 py-3 rounded border border-[#F0B90B]/40 bg-[#F0B90B]/10 text-[#F0B90B] hover:bg-[#F0B90B]/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={unstakeDisabled}
              >
                {unstakeButtonLabel}
              </button>
              <button
                type="button"
                onClick={finalizeUnstake}
                className="btn-secondary w-full py-3"
                disabled={finalizeDisabled}
              >
                {finalizeButtonLabel}
              </button>
            </div>

            {statusMessage && (
              <div className={`rounded-lg px-4 py-3 text-sm ${error ? 'border border-red-500/30 bg-red-500/10 text-red-400' : 'border border-synth-border bg-synth-bg/70 text-synth-muted'}`}>
                {statusMessage}
              </div>
            )}
          </div>
        </div>

        <div className="card space-y-5">
          <h2 className="text-xl font-bold text-synth-text">{t('staking.scheduleTitle')}</h2>
          <div className="space-y-3">
            {[
              { range: '0-7', multiplier: '1x' },
              { range: '7-30', multiplier: '2x' },
              { range: '30-90', multiplier: '3x' },
              { range: '90-180', multiplier: '4x' },
              { range: '180+', multiplier: '5x' },
            ].map((tier) => (
              <div key={tier.range} className="flex items-center justify-between rounded-lg border border-synth-border bg-synth-bg/70 px-4 py-3">
                <span className="text-sm text-synth-muted">{t('staking.multiplierRange', { range: tier.range })}</span>
                <span className="text-lg font-bold text-synth-green">{tier.multiplier}</span>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-synth-border bg-synth-bg/70 p-4 text-sm text-synth-muted leading-relaxed">
            <p>{t('staking.cooldownNote')}</p>
            <p className="mt-3">{t('staking.rewardNote')}</p>
          </div>
        </div>
      </section>

      <div className="border-t border-synth-border/30 mt-8 pt-8">
        <StakingLeaderboard />
      </div>
    </div>
  );
}
