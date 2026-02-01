'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { formatEther, type Address } from 'viem';
import { CUSTODY_ABI, CUSTODY_ADDRESS } from '@/lib/custody';

type ClaimTab = 'humans' | 'agents';
type AgentStep = 1 | 2 | 3 | 4;

interface TokenInfo {
  token: Address;
  agentName: string;
  totalFees: bigint;
  claimed: bigint;
  pendingClaim: bigint;
  wallet: Address;
}

export default function ClaimPage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const [tab, setTab] = useState<ClaimTab>('humans');

  // Agent flow state
  const [agentStep, setAgentStep] = useState<AgentStep>(1);
  const [moltbookUsername, setMoltbookUsername] = useState('');
  const [moltbookApiKey, setMoltbookApiKey] = useState('');
  const [verified, setVerified] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState('');

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

  // Humans tab: tokens where connected wallet is the bound wallet
  const [humanTokens, setHumanTokens] = useState<TokenInfo[]>([]);
  const [humanTokensLoading, setHumanTokensLoading] = useState(false);

  // Known token addresses (fetched from events or a registry — for now we query TokenRegistered events)
  const [knownTokens, setKnownTokens] = useState<Address[]>([]);

  // Fetch all registered tokens from TokenRegistered events
  const fetchRegisteredTokens = useCallback(async () => {
    if (!publicClient) return;
    try {
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
        fromBlock: BigInt(48000000), // Approximate deployment block
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

  // Fetch token info for a list of tokens filtered by agent name
  const fetchAgentTokens = useCallback(async (agentName: string) => {
    if (!publicClient || knownTokens.length === 0) return;
    setTokensLoading(true);
    try {
      const infos: TokenInfo[] = [];
      for (const token of knownTokens) {
        const [name, totalFees, claimed, pendingClaim, wallet] = await publicClient.readContract({
          address: CUSTODY_ADDRESS,
          abi: CUSTODY_ABI,
          functionName: 'getTokenInfo',
          args: [token],
        }) as [string, bigint, bigint, bigint, Address];

        if (name === agentName) {
          infos.push({ token, agentName: name, totalFees, claimed, pendingClaim, wallet });
        }
      }
      setAgentTokens(infos);
    } catch (err) {
      console.error('Failed to fetch agent tokens:', err);
    } finally {
      setTokensLoading(false);
    }
  }, [publicClient, knownTokens]);

  // Fetch tokens for connected wallet (humans tab)
  const fetchHumanTokens = useCallback(async () => {
    if (!publicClient || !address || knownTokens.length === 0) return;
    setHumanTokensLoading(true);
    try {
      const infos: TokenInfo[] = [];
      for (const token of knownTokens) {
        const [agentName, totalFees, claimed, pendingClaim, wallet] = await publicClient.readContract({
          address: CUSTODY_ADDRESS,
          abi: CUSTODY_ABI,
          functionName: 'getTokenInfo',
          args: [token],
        }) as [string, bigint, bigint, bigint, Address];

        if (wallet.toLowerCase() === address.toLowerCase() && pendingClaim > BigInt(0)) {
          infos.push({ token, agentName, totalFees, claimed, pendingClaim, wallet });
        }
      }
      setHumanTokens(infos);
    } catch (err) {
      console.error('Failed to fetch human tokens:', err);
    } finally {
      setHumanTokensLoading(false);
    }
  }, [publicClient, address, knownTokens]);

  useEffect(() => {
    if (isConnected && address && knownTokens.length > 0) {
      fetchHumanTokens();
    }
  }, [isConnected, address, knownTokens, fetchHumanTokens]);

  // Check if agent has bound wallet
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

  // Verify agent identity via /api/bind-wallet (just to check — actual verification)
  const handleVerify = async () => {
    if (!moltbookApiKey.trim() || !moltbookUsername.trim()) return;
    setVerifyLoading(true);
    setVerifyError('');

    try {
      // Quick identity check via Moltbook API
      const res = await fetch('https://www.moltbook.com/api/v1/me', {
        headers: { 'Authorization': `Bearer ${moltbookApiKey}` },
      });

      if (!res.ok) {
        setVerifyError('Invalid API key');
        return;
      }

      const data = await res.json();
      const username = data.username || data.name;
      if (username !== moltbookUsername) {
        setVerifyError(`API key belongs to "${username}", not "${moltbookUsername}"`);
        return;
      }

      setVerified(true);
      setAgentStep(3);

      // Fetch agent tokens and check bound wallet
      await Promise.all([
        fetchAgentTokens(moltbookUsername),
        checkBoundWallet(moltbookUsername),
      ]);
    } catch (err) {
      setVerifyError('Verification failed. Please try again.');
    } finally {
      setVerifyLoading(false);
    }
  };

  // Bind wallet flow
  const handleBindWallet = async () => {
    if (!address || !walletClient || !moltbookUsername || !moltbookApiKey) return;
    setBindLoading(true);
    setBindError('');

    try {
      // 1. Get signature from backend
      const res = await fetch('/api/bind-wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentName: moltbookUsername,
          wallet: address,
          apiKey: moltbookApiKey,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setBindError(data.error || 'Failed to get signature');
        return;
      }

      // 2. Call bindWallet() on-chain
      const txHash = await walletClient.writeContract({
        address: CUSTODY_ADDRESS,
        abi: CUSTODY_ABI,
        functionName: 'bindWallet',
        args: [moltbookUsername, address, data.nonce as `0x${string}`, data.signature as `0x${string}`],
      });

      // 3. Wait for confirmation
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: txHash, confirmations: 1 });
      }

      setIsBound(true);
      setBoundWallet(address);
      setClaimSuccess('Wallet bound successfully!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setBindError(`Bind failed: ${msg}`);
    } finally {
      setBindLoading(false);
    }
  };

  // Claim single token
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
      setClaimSuccess(`Claimed fees for token ${token.slice(0, 8)}...${token.slice(-4)}`);

      // Refresh data
      if (tab === 'agents') {
        fetchAgentTokens(moltbookUsername);
      } else {
        fetchHumanTokens();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setClaimSuccess(`Claim failed: ${msg}`);
    } finally {
      setClaimingToken(null);
    }
  };

  // Claim all tokens (batch)
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
      setClaimSuccess(`Claimed fees for ${tokens.length} token(s)`);

      if (tab === 'agents') {
        fetchAgentTokens(moltbookUsername);
      } else {
        fetchHumanTokens();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setClaimSuccess(`Batch claim failed: ${msg}`);
    } finally {
      setClaimAllLoading(false);
    }
  };

  const tabs_list: { key: ClaimTab; label: string }[] = [
    { key: 'humans', label: 'For Humans' },
    { key: 'agents', label: 'For AI Agents' },
  ];

  const agentSteps = [
    { num: 1, label: 'Username' },
    { num: 2, label: 'API Key' },
    { num: 3, label: 'Review' },
    { num: 4, label: 'Claim' },
  ];

  // Render token row
  const renderTokenRow = (info: TokenInfo, showAgent: boolean = false) => (
    <div key={info.token} className="bg-synth-bg rounded-lg p-4 space-y-2">
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <div className="text-xs font-mono text-synth-muted">
            {info.token.slice(0, 10)}...{info.token.slice(-6)}
          </div>
          {showAgent && (
            <div className="text-xs text-synth-purple">Agent: @{info.agentName}</div>
          )}
        </div>
        <a
          href={`https://flap.sh/token/${info.token}?chain=bsc`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-synth-cyan hover:underline"
        >
          View on Flap ↗
        </a>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <span className="text-synth-muted">Total Fees</span>
          <div className="text-synth-text font-mono">{formatEther(info.totalFees)} BNB</div>
        </div>
        <div>
          <span className="text-synth-muted">Claimed</span>
          <div className="text-synth-text font-mono">{formatEther(info.claimed)} BNB</div>
        </div>
        <div>
          <span className="text-synth-muted">Pending</span>
          <div className="text-synth-green font-mono">{formatEther(info.pendingClaim)} BNB</div>
        </div>
      </div>
      {info.pendingClaim > BigInt(0) && (
        <button
          onClick={() => handleClaim(info.token)}
          disabled={claimingToken === info.token}
          className="btn-primary w-full text-xs"
        >
          {claimingToken === info.token ? 'Claiming...' : `Claim ${formatEther(info.pendingClaim)} BNB`}
        </button>
      )}
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-synth-text terminal-prompt">
          Claim Fees
        </h1>
        <p className="text-sm text-synth-muted">
          Claim accumulated trading fees from tokens you created or AI agents you operate.
        </p>
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center gap-1 border-b border-synth-border pb-0">
        {tabs_list.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-mono transition-all duration-200 border-b-2 -mb-[1px] ${
              tab === t.key
                ? 'text-synth-green border-synth-green'
                : 'text-synth-muted border-transparent hover:text-synth-text'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Success message */}
      {claimSuccess && (
        <div className="bg-synth-green/10 border border-synth-green/30 rounded-lg p-3 text-sm text-synth-green">
          {claimSuccess}
        </div>
      )}

      {/* For Humans Tab */}
      {tab === 'humans' && (
        <div className="space-y-4">
          {!isConnected ? (
            <div className="card text-center py-12 space-y-3">
              <span className="text-3xl">🔗</span>
              <p className="text-synth-muted text-sm">Connect Wallet to view your earnings</p>
              <p className="text-[10px] text-synth-muted">
                Your wallet address will be matched against token beneficiary records
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-xs text-synth-muted">
                Connected as <span className="text-synth-green font-mono">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
              </div>

              {humanTokensLoading ? (
                <div className="card text-center py-12">
                  <p className="text-synth-muted text-sm animate-pulse">Loading claimable tokens...</p>
                </div>
              ) : humanTokens.length === 0 ? (
                <div className="card text-center py-12 space-y-3">
                  <span className="text-3xl">📭</span>
                  <p className="text-synth-muted text-sm">No claimable tokens found</p>
                  <p className="text-[10px] text-synth-muted">
                    If you are a token beneficiary, claimable fees will appear here once fees are recorded.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {humanTokens.length > 1 && (
                    <button
                      onClick={() => handleClaimAll(humanTokens.map(t => t.token))}
                      disabled={claimAllLoading}
                      className="btn-primary w-full"
                    >
                      {claimAllLoading ? 'Claiming All...' : `Claim All (${humanTokens.length} tokens)`}
                    </button>
                  )}
                  {humanTokens.map((info) => renderTokenRow(info, true))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* For AI Agents Tab */}
      {tab === 'agents' && (
        <div className="space-y-6">
          {/* Step Indicator */}
          <div className="flex items-center gap-2 text-xs font-mono">
            {agentSteps.map((s, i) => (
              <div key={s.num} className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] border transition-colors ${
                      agentStep >= s.num
                        ? 'border-synth-green bg-synth-green/20 text-synth-green'
                        : 'border-synth-border text-synth-muted'
                    }`}
                  >
                    {agentStep > s.num ? '✓' : s.num}
                  </div>
                  <span className={agentStep >= s.num ? 'text-synth-green' : 'text-synth-muted'}>
                    {s.label}
                  </span>
                </div>
                {i < agentSteps.length - 1 && (
                  <span className="text-synth-border mx-1">——</span>
                )}
              </div>
            ))}
          </div>

          {/* Step 1: Username */}
          {agentStep === 1 && (
            <div className="card space-y-4">
              <h2 className="text-sm font-bold text-synth-cyan">
                Step 1: Enter Moltbook Username
              </h2>
              <p className="text-sm text-synth-muted">
                Enter the Moltbook username of the AI agent you want to claim fees for.
              </p>
              <div className="space-y-1">
                <label className="text-xs text-synth-muted">Moltbook Username</label>
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
                Next →
              </button>
            </div>
          )}

          {/* Step 2: API Key */}
          {agentStep === 2 && (
            <div className="card space-y-4">
              <h2 className="text-sm font-bold text-synth-purple">
                Step 2: Verify with API Key
              </h2>
              <p className="text-sm text-synth-muted">
                Enter your Moltbook API key to verify ownership of{' '}
                <span className="text-synth-purple">@{moltbookUsername}</span>.
              </p>
              <div className="space-y-1">
                <label className="text-xs text-synth-muted">Moltbook API Key</label>
                <input
                  type="password"
                  placeholder="moltbook_sk_xxxxxxxx"
                  value={moltbookApiKey}
                  onChange={(e) => setMoltbookApiKey(e.target.value)}
                  className="input-field w-full"
                />
              </div>
              {verifyError && (
                <div className="text-xs text-red-400">{verifyError}</div>
              )}
              <div className="flex gap-3">
                <button onClick={() => setAgentStep(1)} className="btn-secondary">
                  ← Back
                </button>
                <button
                  onClick={handleVerify}
                  disabled={!moltbookApiKey.trim() || verifyLoading}
                  className="btn-purple"
                >
                  {verifyLoading ? 'Verifying...' : 'Verify →'}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Review */}
          {agentStep === 3 && (
            <div className="card space-y-4">
              <h2 className="text-sm font-bold text-synth-green">
                Step 3: Review Linked Tokens
              </h2>
              <div className="bg-synth-bg rounded-lg p-3 flex items-center gap-3">
                <span className="text-synth-green text-lg">✓</span>
                <div>
                  <span className="text-sm text-synth-text">Verified as </span>
                  <span className="text-sm text-synth-purple font-bold">@{moltbookUsername}</span>
                  {isBound && boundWallet && (
                    <div className="text-[10px] text-synth-muted mt-0.5">
                      Wallet bound: <span className="font-mono text-synth-cyan">{boundWallet.slice(0, 8)}...{boundWallet.slice(-4)}</span>
                    </div>
                  )}
                </div>
              </div>

              {tokensLoading ? (
                <div className="card text-center py-8">
                  <p className="text-synth-muted text-sm animate-pulse">Loading tokens...</p>
                </div>
              ) : agentTokens.length === 0 ? (
                <div className="card text-center py-8 space-y-2">
                  <span className="text-2xl">📭</span>
                  <p className="text-synth-muted text-sm">No linked tokens found for this agent</p>
                  <p className="text-[10px] text-synth-muted">
                    Tokens created with this agent as beneficiary will appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {agentTokens.map((info) => renderTokenRow(info))}
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => { setAgentStep(2); setVerified(false); setVerifyError(''); }} className="btn-secondary">
                  ← Back
                </button>
                <button onClick={() => setAgentStep(4)} className="btn-primary">
                  {isBound ? 'Claim Fees →' : 'Bind Wallet & Claim →'}
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Bind wallet + Claim */}
          {agentStep === 4 && (
            <div className="card space-y-4">
              <h2 className="text-sm font-bold text-synth-green">
                Step 4: {isBound ? 'Claim Fees' : 'Bind Wallet & Claim'}
              </h2>
              {!isConnected ? (
                <div className="text-center py-6 space-y-2">
                  <span className="text-2xl">🔗</span>
                  <p className="text-synth-muted text-sm">Connect your wallet to {isBound ? 'claim fees' : 'bind it to @' + moltbookUsername + ' and claim fees'}</p>
                </div>
              ) : (
                <>
                  <div className="bg-synth-bg rounded-lg p-4 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-synth-muted">Agent</span>
                      <span className="text-synth-purple">@{moltbookUsername}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-synth-muted">Wallet</span>
                      <span className="text-synth-text font-mono text-xs">{address?.slice(0, 10)}...{address?.slice(-6)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-synth-muted">Wallet Bound</span>
                      <span className={isBound ? 'text-synth-green' : 'text-synth-muted'}>
                        {isBound ? `Yes (${boundWallet?.slice(0, 6)}...${boundWallet?.slice(-4)})` : 'Not yet'}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-synth-muted">Claimable Tokens</span>
                      <span className="text-synth-text">
                        {agentTokens.filter(t => t.pendingClaim > BigInt(0)).length}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-synth-muted">Total Pending</span>
                      <span className="text-synth-green font-mono">
                        {formatEther(agentTokens.reduce((sum, t) => sum + t.pendingClaim, BigInt(0)))} BNB
                      </span>
                    </div>
                  </div>

                  {bindError && (
                    <div className="text-xs text-red-400">{bindError}</div>
                  )}

                  {/* Bind wallet button (if not bound) */}
                  {!isBound && (
                    <button
                      onClick={handleBindWallet}
                      disabled={bindLoading}
                      className="btn-purple w-full"
                    >
                      {bindLoading ? 'Binding Wallet...' : 'Bind Wallet'}
                    </button>
                  )}

                  {/* Token list with claim buttons */}
                  {isBound && agentTokens.length > 0 && (
                    <div className="space-y-3">
                      {agentTokens.filter(t => t.pendingClaim > BigInt(0)).length > 1 && (
                        <button
                          onClick={() => handleClaimAll(agentTokens.filter(t => t.pendingClaim > BigInt(0)).map(t => t.token))}
                          disabled={claimAllLoading}
                          className="btn-primary w-full"
                        >
                          {claimAllLoading ? 'Claiming All...' : 'Claim All'}
                        </button>
                      )}
                      {agentTokens.map((info) => renderTokenRow(info))}
                    </div>
                  )}

                  {/* No claimable fees */}
                  {isBound && agentTokens.filter(t => t.pendingClaim > BigInt(0)).length === 0 && (
                    <div className="text-center py-4">
                      <p className="text-synth-muted text-sm">No fees to claim at the moment</p>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button onClick={() => setAgentStep(3)} className="btn-secondary">
                      ← Back
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Info Box */}
      <div className="card border-synth-purple/30">
        <h3 className="text-sm font-bold text-synth-purple mb-2">How it works</h3>
        <ul className="text-xs text-synth-muted space-y-1.5">
          <li className="flex gap-2">
            <span className="text-synth-green">▸</span>
            Token creators assign an AI agent and tax rate (0-5%) at launch
          </li>
          <li className="flex gap-2">
            <span className="text-synth-green">▸</span>
            Trading fees are sent to the SynthLaunch Custody contract
          </li>
          <li className="flex gap-2">
            <span className="text-synth-green">▸</span>
            <strong>For Humans:</strong> Connect wallet — if your wallet is bound to an agent, claim directly
          </li>
          <li className="flex gap-2">
            <span className="text-synth-green">▸</span>
            <strong>For AI Agents:</strong> Verify via Moltbook API key → bind a wallet → claim on-chain
          </li>
        </ul>
      </div>
    </div>
  );
}
