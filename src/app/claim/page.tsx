'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { formatEther, type Address } from 'viem';
import { CUSTODY_ABI, CUSTODY_ADDRESS } from '@/lib/custody';
import { useI18n } from '@/lib/i18n';

type ClaimTab = 'twitter' | 'agents';
type AgentStep = 1 | 2 | 3 | 4;
type TwitterStep = 1 | 2 | 3; // login → review → claim

interface TokenInfo {
  token: Address;
  agentName: string;
  totalFees: bigint;
  claimed: bigint;
  pendingClaim: bigint;
  wallet: Address;
}

export default function ClaimPage() {
  const { t } = useI18n();
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const [tab, setTab] = useState<ClaimTab>('twitter');

  // Agent flow state
  const [agentStep, setAgentStep] = useState<AgentStep>(1);
  const [moltbookUsername, setMoltbookUsername] = useState('');
  const [moltbookApiKey, setMoltbookApiKey] = useState('');
  const [verified, setVerified] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState('');

  // Twitter flow state
  const [twitterStep, setTwitterStep] = useState<TwitterStep>(1);
  const [twitterHandle, setTwitterHandle] = useState('');
  const [twitterVerified, setTwitterVerified] = useState(false);
  const [twitterVerifyError, setTwitterVerifyError] = useState('');
  const [twitterTokens, setTwitterTokens] = useState<TokenInfo[]>([]);
  const [twitterTokensLoading, setTwitterTokensLoading] = useState(false);

  // Bind wallet state
  const [bindLoading, setBindLoading] = useState(false);
  const [bindError, setBindError] = useState('');
  const [isBound, setIsBound] = useState(false);
  const [boundWallet, setBoundWallet] = useState<Address | null>(null);

  // Token data
  const [agentTokens, setAgentTokens] = useState<TokenInfo[]>([]);
  const [tokensLoading, setTokensLoading] = useState(false);

  // Claim state
  const [claimingToken, setClaimingToken] = useState<Address | null>(null);
  const [claimAllLoading, setClaimAllLoading] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState('');

  const [knownTokens, setKnownTokens] = useState<Address[]>([]);

  // Handle Twitter OAuth redirect
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const isVerified = params.get('twitter_verified') === 'true';
    const handle = params.get('handle');
    const twitterError = params.get('twitter_error');

    if (twitterError) {
      setTwitterVerifyError(`Twitter login failed: ${twitterError}`);
      setTab('twitter');
      // Clean URL
      window.history.replaceState({}, '', '/claim');
      return;
    }

    if (isVerified && handle) {
      const cleanHandle = handle.replace('@', '').trim().toLowerCase();
      setTwitterHandle(cleanHandle);
      setTwitterVerified(true);
      setTwitterStep(2);
      setTab('twitter');
      // Clean URL
      window.history.replaceState({}, '', '/claim');
    }
  }, []);

  // Fetch all registered tokens
  const fetchRegisteredTokens = useCallback(async () => {
    if (!publicClient) return;
    try {
      // Use recent blocks only (custody contract is new, ~7 days lookback max)
      const currentBlock = await publicClient.getBlockNumber();
      const fromBlock = currentBlock - BigInt(20000 * 24 * 7); // ~7 days
      const logs = await publicClient.getLogs({
        address: CUSTODY_ADDRESS,
        event: {
          type: 'event',
          name: 'TokenRegistered',
          inputs: [
            { indexed: true, name: 'token', type: 'address' },
            { indexed: false, name: 'agentName', type: 'string' },
          ],
        },
        fromBlock,
        toBlock: 'latest',
      });
      const tokens = logs.map((log) => log.args.token as Address);
      setKnownTokens(Array.from(new Set(tokens)));
    } catch (err) {
      console.error('Failed to fetch registered tokens:', err);
    }
  }, [publicClient]);

  useEffect(() => {
    fetchRegisteredTokens();
  }, [fetchRegisteredTokens]);

  // Fetch token info for agent name
  const fetchTokensByAgent = useCallback(async (agentName: string) => {
    if (!publicClient || knownTokens.length === 0) return [];
    const infos: TokenInfo[] = [];
    for (const token of knownTokens) {
      const [name, totalFees, claimed, pendingClaim, wallet] = await publicClient.readContract({
        address: CUSTODY_ADDRESS,
        abi: CUSTODY_ABI,
        functionName: 'getTokenInfo',
        args: [token],
      }) as [string, bigint, bigint, bigint, Address];

      if (name.toLowerCase() === agentName.toLowerCase()) {
        infos.push({ token, agentName: name, totalFees, claimed, pendingClaim, wallet });
      }
    }
    return infos;
  }, [publicClient, knownTokens]);

  // Fetch agent tokens (Moltbook flow)
  const fetchAgentTokens = useCallback(async (agentName: string) => {
    setTokensLoading(true);
    try {
      const infos = await fetchTokensByAgent(agentName);
      setAgentTokens(infos);
    } catch (err) {
      console.error('Failed to fetch agent tokens:', err);
    } finally {
      setTokensLoading(false);
    }
  }, [fetchTokensByAgent]);

  // Fetch Twitter tokens
  const fetchTwitterTokens = useCallback(async (handle: string) => {
    setTwitterTokensLoading(true);
    try {
      const agentName = `tw:${handle.toLowerCase()}`;
      const infos = await fetchTokensByAgent(agentName);
      setTwitterTokens(infos);
    } catch (err) {
      console.error('Failed to fetch twitter tokens:', err);
    } finally {
      setTwitterTokensLoading(false);
    }
  }, [fetchTokensByAgent]);

  // Check bound wallet
  const checkBoundWallet = useCallback(async (agentName: string) => {
    if (!publicClient) return;
    try {
      const bound = await publicClient.readContract({
        address: CUSTODY_ADDRESS,
        abi: CUSTODY_ABI,
        functionName: 'isWalletBound',
        args: [agentName],
      }) as boolean;
      setIsBound(bound);
      if (bound) {
        const wallet = await publicClient.readContract({
          address: CUSTODY_ADDRESS,
          abi: CUSTODY_ABI,
          functionName: 'getAgentWallet',
          args: [agentName],
        }) as Address;
        setBoundWallet(wallet);
      }
    } catch (err) {
      console.error('Failed to check bound wallet:', err);
    }
  }, [publicClient]);

  // When twitter is verified and tokens are loaded, fetch twitter token data
  useEffect(() => {
    if (twitterVerified && twitterHandle && knownTokens.length > 0) {
      const cleanHandle = twitterHandle.replace('@', '').trim().toLowerCase();
      fetchTwitterTokens(cleanHandle);
      checkBoundWallet(`tw:${cleanHandle}`);
    }
  }, [twitterVerified, twitterHandle, knownTokens, fetchTwitterTokens, checkBoundWallet]);

  // Bind wallet (Twitter flow)
  const handleTwitterBindWallet = async () => {
    if (!address || !walletClient) return;
    setBindLoading(true);
    setBindError('');
    const cleanHandle = twitterHandle.replace('@', '').trim().toLowerCase();
    const agentName = `tw:${cleanHandle}`;

    try {
      const res = await fetch('/api/bind-wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentName,
          wallet: address,
          twitterHandle: cleanHandle,
          verifyMethod: 'twitter',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBindError(data.error || t('claim.bindFailed', { error: '' }));
        return;
      }

      const txHash = await walletClient.writeContract({
        address: CUSTODY_ADDRESS,
        abi: CUSTODY_ABI,
        functionName: 'bindWallet',
        args: [agentName, address, data.nonce as `0x${string}`, data.signature as `0x${string}`],
      });

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: txHash, confirmations: 1 });
      }
      setIsBound(true);
      setBoundWallet(address);
      setClaimSuccess(t('claim.walletBoundSuccess'));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setBindError(t('claim.bindFailed', { error: msg }));
    } finally {
      setBindLoading(false);
    }
  };

  // === Moltbook agent flow handlers ===
  const handleVerify = async () => {
    if (!moltbookApiKey.trim() || !moltbookUsername.trim()) return;
    setVerifyLoading(true);
    setVerifyError('');
    try {
      const res = await fetch('/api/moltbook/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: moltbookApiKey }),
      });
      if (!res.ok) { setVerifyError(t('claim.invalidApiKey')); return; }
      const data = await res.json();
      const username = data.username || data.name;
      if (username !== moltbookUsername) {
        setVerifyError(t('claim.apiKeyBelongsTo', { actual: username, expected: moltbookUsername }));
        return;
      }
      setVerified(true);
      setAgentStep(3);
      await Promise.all([
        fetchAgentTokens(moltbookUsername),
        checkBoundWallet(moltbookUsername),
      ]);
    } catch {
      setVerifyError(t('claim.verifyFailed'));
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleBindWallet = async () => {
    if (!address || !walletClient || !moltbookUsername || !moltbookApiKey) return;
    setBindLoading(true);
    setBindError('');
    try {
      const res = await fetch('/api/bind-wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentName: moltbookUsername, wallet: address, apiKey: moltbookApiKey }),
      });
      const data = await res.json();
      if (!res.ok) { setBindError(data.error || t('claim.bindFailed', { error: '' })); return; }

      const txHash = await walletClient.writeContract({
        address: CUSTODY_ADDRESS,
        abi: CUSTODY_ABI,
        functionName: 'bindWallet',
        args: [moltbookUsername, address, data.nonce as `0x${string}`, data.signature as `0x${string}`],
      });
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: txHash, confirmations: 1 });
      }
      setIsBound(true);
      setBoundWallet(address);
      setClaimSuccess(t('claim.walletBoundSuccess'));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setBindError(t('claim.bindFailed', { error: msg }));
    } finally {
      setBindLoading(false);
    }
  };

  // === Claim handlers ===
  const handleClaim = async (token: Address) => {
    if (!walletClient || !publicClient) return;
    setClaimingToken(token);
    setClaimSuccess('');
    try {
      const txHash = await walletClient.writeContract({
        address: CUSTODY_ADDRESS,
        abi: CUSTODY_ABI,
        functionName: 'claim',
        args: [token],
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash, confirmations: 1 });
      setClaimSuccess(t('claim.claimedSuccess', { token: `${token.slice(0, 8)}...${token.slice(-4)}` }));
      if (tab === 'agents') fetchAgentTokens(moltbookUsername);
      else fetchTwitterTokens(twitterHandle.replace('@', '').trim().toLowerCase());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setClaimSuccess(t('claim.claimFailed', { error: msg }));
    } finally {
      setClaimingToken(null);
    }
  };

  const handleClaimAll = async (tokens: Address[]) => {
    if (!walletClient || !publicClient || tokens.length === 0) return;
    setClaimAllLoading(true);
    setClaimSuccess('');
    try {
      const txHash = await walletClient.writeContract({
        address: CUSTODY_ADDRESS,
        abi: CUSTODY_ABI,
        functionName: 'claimBatch',
        args: [tokens],
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash, confirmations: 1 });
      setClaimSuccess(t('claim.batchClaimedSuccess', { count: String(tokens.length) }));
      if (tab === 'agents') fetchAgentTokens(moltbookUsername);
      else fetchTwitterTokens(twitterHandle.replace('@', '').trim().toLowerCase());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setClaimSuccess(t('claim.batchClaimFailed', { error: msg }));
    } finally {
      setClaimAllLoading(false);
    }
  };

  const tabs_list: { key: ClaimTab; label: string; icon: string }[] = [
    { key: 'twitter', label: t('claim.twitter'), icon: '🐦' },
    { key: 'agents', label: t('claim.moltbook'), icon: '🦞' },
  ];

  const twitterSteps = [
    { num: 1, label: t('claim.stepLogin') },
    { num: 2, label: t('claim.stepReview') },
    { num: 3, label: t('claim.stepClaim') },
  ];

  const agentSteps = [
    { num: 1, label: t('claim.stepUsername') },
    { num: 2, label: t('claim.stepApiKey') },
    { num: 3, label: t('claim.stepReview') },
    { num: 4, label: t('claim.stepClaim') },
  ];

  // Render step indicator
  const renderSteps = (steps: { num: number; label: string }[], currentStep: number) => (
    <div className="flex items-center gap-2 text-xs font-mono flex-wrap">
      {steps.map((s, i) => (
        <div key={s.num} className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] border transition-colors ${
                currentStep >= s.num
                  ? 'border-synth-green bg-synth-green/20 text-synth-green'
                  : 'border-synth-border text-synth-muted'
              }`}
            >
              {currentStep > s.num ? '✓' : s.num}
            </div>
            <span className={currentStep >= s.num ? 'text-synth-green' : 'text-synth-muted'}>
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <span className="text-synth-border mx-1">——</span>
          )}
        </div>
      ))}
    </div>
  );

  // Render token row
  const renderTokenRow = (info: TokenInfo, showAgent: boolean = false) => (
    <div key={info.token} className="bg-synth-bg rounded-lg p-4 space-y-2">
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <div className="text-xs font-mono text-synth-muted">
            {info.token.slice(0, 10)}...{info.token.slice(-6)}
          </div>
          {showAgent && (
            <div className="text-xs text-synth-purple">{t('claim.agent')}: @{info.agentName}</div>
          )}
        </div>
        <a
          href={`https://flap.sh/token/${info.token}?chain=bsc`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-synth-cyan hover:underline"
        >
          {t('claim.viewOnFlap')}
        </a>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <span className="text-synth-muted">{t('claim.totalFees')}</span>
          <div className="text-synth-text font-mono">{formatEther(info.totalFees)} BNB</div>
        </div>
        <div>
          <span className="text-synth-muted">{t('claim.claimed')}</span>
          <div className="text-synth-text font-mono">{formatEther(info.claimed)} BNB</div>
        </div>
        <div>
          <span className="text-synth-muted">{t('claim.pending')}</span>
          <div className="text-synth-green font-mono">{formatEther(info.pendingClaim)} BNB</div>
        </div>
      </div>
      {info.pendingClaim > BigInt(0) && (
        <button
          onClick={() => handleClaim(info.token)}
          disabled={claimingToken === info.token}
          className="btn-primary w-full text-xs"
        >
          {claimingToken === info.token ? t('claim.claiming') : `Claim ${formatEther(info.pendingClaim)} BNB`}
        </button>
      )}
    </div>
  );

  // Render bind + claim section (shared between Twitter and Moltbook)
  const renderClaimSection = (
    agentName: string,
    tokens: TokenInfo[],
    tokensAreLoading: boolean,
    onBindWallet: () => Promise<void>,
  ) => (
    <div className="card space-y-4">
      <h2 className="text-sm font-bold text-synth-green">
        {isBound ? t('claim.claimFees').replace(' →', '') : t('claim.bindAndClaim').replace(' →', '')}
      </h2>
      {!isConnected ? (
        <div className="text-center py-6 space-y-2">
          <span className="text-2xl">🔗</span>
          <p className="text-synth-muted text-sm">{t('claim.connectWallet')}</p>
        </div>
      ) : (
        <>
          <div className="bg-synth-bg rounded-lg p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-synth-muted">{t('claim.agent')}</span>
              <span className="text-synth-purple">@{agentName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-synth-muted">{t('claim.wallet')}</span>
              <span className="text-synth-text font-mono text-xs">{address?.slice(0, 10)}...{address?.slice(-6)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-synth-muted">{t('claim.walletBound')}</span>
              <span className={isBound ? 'text-synth-green' : 'text-synth-muted'}>
                {isBound ? `${t('common.yes')} (${boundWallet?.slice(0, 6)}...${boundWallet?.slice(-4)})` : t('common.notYet')}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-synth-muted">{t('claim.claimable')}</span>
              <span className="text-synth-green font-mono">
                {formatEther(tokens.reduce((sum, t) => sum + t.pendingClaim, BigInt(0)))} BNB
              </span>
            </div>
          </div>

          {bindError && <div className="text-xs text-red-400">{bindError}</div>}

          {!isBound && (
            <button onClick={onBindWallet} disabled={bindLoading} className="btn-purple w-full">
              {bindLoading ? t('claim.bindingWallet') : t('claim.bindWallet')}
            </button>
          )}

          {isBound && tokens.length > 0 && (
            <div className="space-y-3">
              {tokens.filter(t => t.pendingClaim > BigInt(0)).length > 1 && (
                <button
                  onClick={() => handleClaimAll(tokens.filter(t => t.pendingClaim > BigInt(0)).map(t => t.token))}
                  disabled={claimAllLoading}
                  className="btn-primary w-full"
                >
                  {claimAllLoading ? t('claim.claimingAll') : t('claim.claimAll')}
                </button>
              )}
              {tokens.map((info) => renderTokenRow(info))}
            </div>
          )}

          {isBound && tokens.filter(t => t.pendingClaim > BigInt(0)).length === 0 && (
            <div className="text-center py-4">
              <p className="text-synth-muted text-sm">{t('claim.noFees')}</p>
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-synth-text terminal-prompt">{t('claim.title')}</h1>
        <p className="text-sm text-synth-muted">
          {t('claim.subtitle')}
        </p>
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center gap-1 border-b border-synth-border pb-0">
        {tabs_list.map((tabItem) => (
          <button
            key={tabItem.key}
            onClick={() => setTab(tabItem.key)}
            className={`px-4 py-2 text-sm font-mono transition-all duration-200 border-b-2 -mb-[1px] ${
              tab === tabItem.key
                ? 'text-synth-green border-synth-green'
                : 'text-synth-muted border-transparent hover:text-synth-text'
            }`}
          >
            {tabItem.icon} {tabItem.label}
          </button>
        ))}
      </div>

      {/* Success message */}
      {claimSuccess && (
        <div className="bg-synth-green/10 border border-synth-green/30 rounded-lg p-3 text-sm text-synth-green">
          {claimSuccess}
        </div>
      )}

      {/* ===== Twitter Tab ===== */}
      {tab === 'twitter' && (
        <div className="space-y-6">
          {renderSteps(twitterSteps, twitterStep)}

          {/* Step 1: Login with Twitter */}
          {twitterStep === 1 && (
            <div className="card space-y-4">
              <h2 className="text-sm font-bold text-synth-cyan">{t('claim.step')} 1: {t('claim.enterHandle')}</h2>
              <p className="text-sm text-synth-muted">
                {t('claim.loginWithTwitter')}
              </p>

              {twitterVerifyError && (
                <div className="text-xs text-red-400">{twitterVerifyError}</div>
              )}

              <a
                href="/api/twitter/auth"
                className="btn-primary w-full text-center block"
              >
                🐦 {t('claim.enterHandle')}
              </a>
            </div>
          )}

          {/* Step 2: Review (after OAuth redirect) */}
          {twitterStep === 2 && (
            <div className="card space-y-4">
              <h2 className="text-sm font-bold text-synth-green">{t('claim.step')} 2: {t('claim.verified')}</h2>
              <div className="bg-synth-bg rounded-lg p-3 flex items-center gap-3">
                <span className="text-synth-green text-lg">✓</span>
                <div>
                  <span className="text-sm text-synth-text">{t('claim.twitterVerified')} </span>
                  <span className="text-sm text-synth-cyan font-bold">@{twitterHandle}</span>
                  {isBound && boundWallet && (
                    <div className="text-[10px] text-synth-muted mt-0.5">
                      {t('claim.walletBound')}: <span className="font-mono text-synth-cyan">{boundWallet.slice(0, 8)}...{boundWallet.slice(-4)}</span>
                    </div>
                  )}
                </div>
              </div>

              {twitterTokensLoading ? (
                <div className="text-center py-8">
                  <p className="text-synth-muted text-sm animate-pulse">{t('claim.loadingTokens')}</p>
                </div>
              ) : twitterTokens.length === 0 ? (
                <div className="text-center py-8 space-y-2">
                  <span className="text-2xl">📭</span>
                  <p className="text-synth-muted text-sm">{t('claim.noTokens')} @{twitterHandle}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {twitterTokens.map((info) => renderTokenRow(info))}
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => { setTwitterStep(1); setTwitterVerified(false); setTwitterHandle(''); }} className="btn-secondary">
                  {t('claim.back')}
                </button>
                <button onClick={() => setTwitterStep(3)} className="btn-primary">
                  {isBound ? t('claim.claimFees') : t('claim.bindAndClaim')}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Bind + Claim */}
          {twitterStep === 3 && (
            <>
              {renderClaimSection(
                `tw:${twitterHandle.replace('@', '').trim().toLowerCase()}`,
                twitterTokens,
                twitterTokensLoading,
                handleTwitterBindWallet,
              )}
              <button onClick={() => setTwitterStep(2)} className="btn-secondary">
                {t('claim.back')}
              </button>
            </>
          )}
        </div>
      )}

      {/* ===== For AI Agents Tab ===== */}
      {tab === 'agents' && (
        <div className="space-y-6">
          {renderSteps(agentSteps, agentStep)}

          {agentStep === 1 && (
            <div className="card space-y-4">
              <h2 className="text-sm font-bold text-synth-cyan">{t('claim.step')} 1: {t('claim.enterUsername')}</h2>
              <p className="text-sm text-synth-muted">
                {t('claim.usernameHint')}
              </p>
              <div className="space-y-1">
                <label className="text-xs text-synth-muted">{t('claim.moltbookUsername')}</label>
                <input
                  type="text"
                  placeholder="your_agent_name"
                  value={moltbookUsername}
                  onChange={(e) => setMoltbookUsername(e.target.value)}
                  className="input-field w-full"
                />
              </div>
              <button
                onClick={() => moltbookUsername.trim() && setAgentStep(2)}
                disabled={!moltbookUsername.trim()}
                className="btn-primary"
              >
                {t('claim.next')}
              </button>
            </div>
          )}

          {agentStep === 2 && (
            <div className="card space-y-4">
              <h2 className="text-sm font-bold text-synth-purple">{t('claim.step')} 2: {t('claim.verifyApiKey')}</h2>
              <p className="text-sm text-synth-muted">
                {t('claim.apiKeyHint')}{' '}
                <span className="text-synth-purple">@{moltbookUsername}</span>.
              </p>
              <div className="space-y-1">
                <label className="text-xs text-synth-muted">{t('claim.moltbookApiKey')}</label>
                <input
                  type="password"
                  placeholder="moltbook_sk_xxxxxxxx"
                  value={moltbookApiKey}
                  onChange={(e) => setMoltbookApiKey(e.target.value)}
                  className="input-field w-full"
                />
              </div>
              {verifyError && <div className="text-xs text-red-400">{verifyError}</div>}
              <div className="flex gap-3">
                <button onClick={() => setAgentStep(1)} className="btn-secondary">{t('claim.back')}</button>
                <button onClick={handleVerify} disabled={!moltbookApiKey.trim() || verifyLoading} className="btn-purple">
                  {verifyLoading ? t('claim.verifying') : t('claim.verify')}
                </button>
              </div>
            </div>
          )}

          {agentStep === 3 && (
            <div className="card space-y-4">
              <h2 className="text-sm font-bold text-synth-green">{t('claim.step')} 3: {t('claim.reviewTokens')}</h2>
              <div className="bg-synth-bg rounded-lg p-3 flex items-center gap-3">
                <span className="text-synth-green text-lg">✓</span>
                <div>
                  <span className="text-sm text-synth-text">{t('claim.verifiedAs')} </span>
                  <span className="text-sm text-synth-purple font-bold">@{moltbookUsername}</span>
                </div>
              </div>
              {tokensLoading ? (
                <div className="text-center py-8"><p className="text-synth-muted text-sm animate-pulse">{t('claim.loadingTokens')}</p></div>
              ) : agentTokens.length === 0 ? (
                <div className="text-center py-8 space-y-2">
                  <span className="text-2xl">📭</span>
                  <p className="text-synth-muted text-sm">{t('claim.noLinkedTokens')}</p>
                </div>
              ) : (
                <div className="space-y-3">{agentTokens.map((info) => renderTokenRow(info))}</div>
              )}
              <div className="flex gap-3">
                <button onClick={() => { setAgentStep(2); setVerified(false); setVerifyError(''); }} className="btn-secondary">{t('claim.back')}</button>
                <button onClick={() => setAgentStep(4)} className="btn-primary">
                  {isBound ? t('claim.claimFees') : t('claim.bindAndClaim')}
                </button>
              </div>
            </div>
          )}

          {agentStep === 4 && (
            <>
              {renderClaimSection(moltbookUsername, agentTokens, tokensLoading, handleBindWallet)}
              <button onClick={() => setAgentStep(3)} className="btn-secondary">{t('claim.back')}</button>
            </>
          )}
        </div>
      )}

      {/* Info Box */}
      <div className="card border-synth-purple/30">
        <h3 className="text-sm font-bold text-synth-purple mb-2">{t('claim.howItWorks')}</h3>
        <ul className="text-xs text-synth-muted space-y-1.5">
          <li className="flex gap-2">
            <span className="text-synth-green">▸</span>
            {t('claim.howStep1')}
          </li>
          <li className="flex gap-2">
            <span className="text-synth-green">▸</span>
            {t('claim.howStep2')}
          </li>
          <li className="flex gap-2">
            <span className="text-synth-green">▸</span>
            {t('claim.howStep3Twitter')}
          </li>
          <li className="flex gap-2">
            <span className="text-synth-green">▸</span>
            {t('claim.howStep3Moltbook')}
          </li>
        </ul>
      </div>
    </div>
  );
}
