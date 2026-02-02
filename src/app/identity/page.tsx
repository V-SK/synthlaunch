'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, useReadContract, useWriteContract, usePublicClient, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, isAddress, type Address, keccak256, encodePacked } from 'viem';
import { SYNTHID_ABI, SYNTHID_ADDRESS } from '@/lib/synthid';
import { IdentityCard } from '@/components/IdentityCard';
import { useI18n } from '@/lib/i18n';

interface AgentData {
  agentId: number;
  name: string;
  platform: string;
  platformId: string;
  agentURI: string;
  createdAt: number;
  owner: string;
  avatar: string;
  description: string;
  skills: string[];
}

export default function IdentityPage() {
  const { t } = useI18n();
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();

  // ── Search ──
  const [searchMode, setSearchMode] = useState<'wallet' | 'platform'>('wallet');
  const [searchWallet, setSearchWallet] = useState('');
  const [searchPlatform, setSearchPlatform] = useState('moltbook');
  const [searchPlatformId, setSearchPlatformId] = useState('');
  const [searchResult, setSearchResult] = useState<AgentData | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');

  // ── Register ──
  const [regName, setRegName] = useState('');
  const [regPlatform, setRegPlatform] = useState('moltbook');
  const [regPlatformId, setRegPlatformId] = useState('');
  const [regAvatar, setRegAvatar] = useState('');
  const [regDescription, setRegDescription] = useState('');
  const [regError, setRegError] = useState('');

  // ── My Identity ──
  const [myAgent, setMyAgent] = useState<AgentData | null>(null);
  const [myLoading, setMyLoading] = useState(false);

  // ── Edit mode ──
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editSkills, setEditSkills] = useState('');

  // Read mint fee
  const { data: mintFee } = useReadContract({
    address: SYNTHID_ADDRESS,
    abi: SYNTHID_ABI,
    functionName: 'mintFee',
  });

  // Read total minted
  const { data: totalMinted } = useReadContract({
    address: SYNTHID_ADDRESS,
    abi: SYNTHID_ABI,
    functionName: 'totalMinted',
  });

  // Write: register
  const { writeContract: writeRegister, data: registerHash, isPending: registerPending } = useWriteContract();
  const { isSuccess: registerSuccess } = useWaitForTransactionReceipt({ hash: registerHash });

  // Write: updateProfile
  const { writeContract: writeUpdateProfile, data: updateHash, isPending: updatePending } = useWriteContract();
  const { isSuccess: updateSuccess } = useWaitForTransactionReceipt({ hash: updateHash });

  // Write: setSkills
  const { writeContract: writeSetSkills, data: skillsHash, isPending: skillsPending } = useWriteContract();
  const { isSuccess: skillsSuccess } = useWaitForTransactionReceipt({ hash: skillsHash });

  // ── Fetch agent data by ID ──
  const fetchAgentById = useCallback(async (agentId: number): Promise<AgentData | null> => {
    if (!publicClient || agentId === 0) return null;
    try {
      const [identity, profile] = await Promise.all([
        publicClient.readContract({
          address: SYNTHID_ADDRESS,
          abi: SYNTHID_ABI,
          functionName: 'getAgentIdentity',
          args: [BigInt(agentId)],
        }),
        publicClient.readContract({
          address: SYNTHID_ADDRESS,
          abi: SYNTHID_ABI,
          functionName: 'getAgentProfile',
          args: [BigInt(agentId)],
        }),
      ]);
      const [name, platform, platformId, agentURI, createdAt, owner] = identity as [string, string, string, string, bigint, string];
      const [avatar, description, skills] = profile as [string, string, string[]];
      return {
        agentId,
        name,
        platform,
        platformId,
        agentURI,
        createdAt: Number(createdAt),
        owner,
        avatar,
        description,
        skills,
      };
    } catch {
      return null;
    }
  }, [publicClient]);

  // ── Search handler ──
  const handleSearch = async () => {
    setSearchError('');
    setSearchResult(null);
    setSearchLoading(true);
    try {
      if (searchMode === 'wallet') {
        if (!isAddress(searchWallet)) {
          setSearchError('Invalid wallet address');
          return;
        }
        const tokenId = await publicClient!.readContract({
          address: SYNTHID_ADDRESS,
          abi: SYNTHID_ABI,
          functionName: 'walletToId',
          args: [searchWallet as Address],
        }) as bigint;
        if (tokenId === 0n) {
          setSearchError(t('identity.noIdentity'));
          return;
        }
        const data = await fetchAgentById(Number(tokenId));
        setSearchResult(data);
      } else {
        const tokenId = await publicClient!.readContract({
          address: SYNTHID_ADDRESS,
          abi: SYNTHID_ABI,
          functionName: 'getByPlatform',
          args: [searchPlatform, searchPlatformId],
        }) as bigint;
        if (tokenId === 0n) {
          setSearchError(t('identity.noIdentity'));
          return;
        }
        const data = await fetchAgentById(Number(tokenId));
        setSearchResult(data);
      }
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearchLoading(false);
    }
  };

  // ── Load my identity ──
  const loadMyIdentity = useCallback(async () => {
    if (!address || !publicClient) return;
    setMyLoading(true);
    try {
      const tokenId = await publicClient.readContract({
        address: SYNTHID_ADDRESS,
        abi: SYNTHID_ABI,
        functionName: 'walletToId',
        args: [address],
      }) as bigint;
      if (tokenId === 0n) {
        setMyAgent(null);
      } else {
        const data = await fetchAgentById(Number(tokenId));
        setMyAgent(data);
        if (data) {
          setEditName(data.name);
          setEditAvatar(data.avatar);
          setEditDescription(data.description);
          setEditSkills(data.skills.join(', '));
        }
      }
    } catch {
      setMyAgent(null);
    } finally {
      setMyLoading(false);
    }
  }, [address, publicClient, fetchAgentById]);

  useEffect(() => {
    if (isConnected) loadMyIdentity();
  }, [isConnected, loadMyIdentity]);

  // Reload after successful register
  useEffect(() => {
    if (registerSuccess) {
      loadMyIdentity();
      setRegName('');
      setRegPlatform('moltbook');
      setRegPlatformId('');
      setRegAvatar('');
      setRegDescription('');
    }
  }, [registerSuccess, loadMyIdentity]);

  // Reload after successful update
  useEffect(() => {
    if (updateSuccess || skillsSuccess) {
      loadMyIdentity();
      setEditing(false);
    }
  }, [updateSuccess, skillsSuccess, loadMyIdentity]);

  // ── Register handler ──
  const handleRegister = () => {
    setRegError('');
    if (!regName.trim() || !regPlatform.trim() || !regPlatformId.trim()) {
      setRegError('Name, platform, and platform ID are required');
      return;
    }
    writeRegister({
      address: SYNTHID_ADDRESS,
      abi: SYNTHID_ABI,
      functionName: 'register',
      args: [regName, regPlatform, regPlatformId, regAvatar, regDescription],
      value: mintFee as bigint ?? parseEther('0.005'),
    });
  };

  // ── Update handler ──
  const handleUpdate = () => {
    if (!myAgent) return;
    writeUpdateProfile({
      address: SYNTHID_ADDRESS,
      abi: SYNTHID_ABI,
      functionName: 'updateProfile',
      args: [BigInt(myAgent.agentId), editName, editAvatar, editDescription],
    });
    const skillsArr = editSkills.split(',').map(s => s.trim()).filter(Boolean);
    if (JSON.stringify(skillsArr) !== JSON.stringify(myAgent.skills)) {
      writeSetSkills({
        address: SYNTHID_ADDRESS,
        abi: SYNTHID_ABI,
        functionName: 'setSkills',
        args: [BigInt(myAgent.agentId), skillsArr],
      });
    }
  };

  const feeDisplay = mintFee ? `${Number(mintFee) / 1e18} BNB` : '0.005 BNB';

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-synth-text terminal-prompt">{t('identity.title')}</h1>
        <p className="text-sm text-synth-muted">{t('identity.subtitle')}</p>
        {totalMinted !== undefined && (
          <div className="text-xs text-synth-green font-mono">
            {Number(totalMinted)} {t('identity.registered')}
          </div>
        )}
      </div>

      {/* ═══ Search Section ═══ */}
      <div className="card space-y-4">
        <h2 className="text-sm font-bold text-synth-cyan">{t('identity.search')}</h2>

        {/* Mode toggle */}
        <div className="flex gap-1">
          <button
            onClick={() => setSearchMode('wallet')}
            className={`px-3 py-1.5 text-xs font-mono rounded transition-colors ${
              searchMode === 'wallet'
                ? 'bg-synth-cyan/15 text-synth-cyan border border-synth-cyan/30'
                : 'text-synth-muted hover:text-synth-text'
            }`}
          >
            {t('identity.searchByWallet')}
          </button>
          <button
            onClick={() => setSearchMode('platform')}
            className={`px-3 py-1.5 text-xs font-mono rounded transition-colors ${
              searchMode === 'platform'
                ? 'bg-synth-cyan/15 text-synth-cyan border border-synth-cyan/30'
                : 'text-synth-muted hover:text-synth-text'
            }`}
          >
            {t('identity.searchByPlatform')}
          </button>
        </div>

        {searchMode === 'wallet' ? (
          <div className="space-y-1">
            <label className="text-xs text-synth-muted">{t('identity.searchPlaceholder')}</label>
            <input
              type="text"
              placeholder="0x..."
              value={searchWallet}
              onChange={(e) => setSearchWallet(e.target.value)}
              className="input-field w-full"
            />
          </div>
        ) : (
          <div className="flex gap-2">
            <select
              value={searchPlatform}
              onChange={(e) => setSearchPlatform(e.target.value)}
              className="input-field"
            >
              <option value="moltbook">🦞 Moltbook</option>
              <option value="twitter">🐦 Twitter</option>
              <option value="custom">🔗 Custom</option>
            </select>
            <input
              type="text"
              placeholder={t('identity.platformId')}
              value={searchPlatformId}
              onChange={(e) => setSearchPlatformId(e.target.value)}
              className="input-field flex-1"
            />
          </div>
        )}

        <button
          onClick={handleSearch}
          disabled={searchLoading}
          className="btn-primary text-sm"
        >
          {searchLoading ? '...' : t('identity.search')}
        </button>

        {searchError && (
          <div className="text-xs text-red-400">{searchError}</div>
        )}

        {searchResult && (
          <IdentityCard {...searchResult} />
        )}
      </div>

      {/* ═══ Register Section ═══ */}
      {isConnected && !myAgent && (
        <div className="card space-y-4">
          <h2 className="text-sm font-bold text-synth-green">{t('identity.register')}</h2>
          <p className="text-xs text-synth-muted">
            {t('identity.mintFee')}: <span className="text-synth-green">{feeDisplay}</span> · {t('identity.soulbound')}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-synth-muted">{t('identity.name')} *</label>
              <input
                type="text"
                placeholder="My Agent"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                className="input-field w-full"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-synth-muted">{t('identity.platform')} *</label>
              <select
                value={regPlatform}
                onChange={(e) => setRegPlatform(e.target.value)}
                className="input-field w-full"
              >
                <option value="moltbook">🦞 Moltbook</option>
                <option value="twitter">🐦 Twitter</option>
                <option value="custom">🔗 Custom</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-synth-muted">{t('identity.platformId')} *</label>
              <input
                type="text"
                placeholder="username"
                value={regPlatformId}
                onChange={(e) => setRegPlatformId(e.target.value)}
                className="input-field w-full"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-synth-muted">{t('identity.avatar')}</label>
              <input
                type="text"
                placeholder="https://..."
                value={regAvatar}
                onChange={(e) => setRegAvatar(e.target.value)}
                className="input-field w-full"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-synth-muted">{t('identity.description')}</label>
            <textarea
              placeholder="Describe your agent..."
              value={regDescription}
              onChange={(e) => setRegDescription(e.target.value)}
              rows={3}
              className="input-field w-full resize-none"
            />
          </div>

          {regError && <div className="text-xs text-red-400">{regError}</div>}

          <button
            onClick={handleRegister}
            disabled={registerPending}
            className="btn-primary w-full"
          >
            {registerPending ? '...' : `${t('identity.mint')} (${feeDisplay})`}
          </button>

          {registerSuccess && (
            <div className="text-xs text-synth-green">✅ {t('identity.registered')}!</div>
          )}
        </div>
      )}

      {!isConnected && (
        <div className="card text-center py-8 space-y-2">
          <span className="text-2xl">🔗</span>
          <p className="text-synth-muted text-sm">{t('common.connectWallet')}</p>
          <p className="text-xs text-synth-muted">{t('identity.subtitle')}</p>
        </div>
      )}

      {/* ═══ My Identity Section ═══ */}
      {isConnected && myAgent && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-synth-purple">{t('identity.myIdentity')}</h2>
            <button
              onClick={() => setEditing(!editing)}
              className="text-xs text-synth-cyan hover:underline font-mono"
            >
              {editing ? '✕ Cancel' : '✎ Edit'}
            </button>
          </div>

          {!editing ? (
            <IdentityCard {...myAgent} />
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-synth-muted">{t('identity.name')}</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="input-field w-full"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-synth-muted">{t('identity.avatar')}</label>
                  <input
                    type="text"
                    value={editAvatar}
                    onChange={(e) => setEditAvatar(e.target.value)}
                    className="input-field w-full"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-synth-muted">{t('identity.description')}</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  className="input-field w-full resize-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-synth-muted">{t('identity.skills')} (comma-separated)</label>
                <input
                  type="text"
                  placeholder="trading, DeFi, NFTs"
                  value={editSkills}
                  onChange={(e) => setEditSkills(e.target.value)}
                  className="input-field w-full"
                />
              </div>
              <button
                onClick={handleUpdate}
                disabled={updatePending || skillsPending}
                className="btn-purple w-full"
              >
                {updatePending || skillsPending ? 'Updating...' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>
      )}

      {isConnected && !myAgent && !myLoading && (
        <div className="text-center py-4">
          <p className="text-xs text-synth-muted">{t('identity.noIdentity')}</p>
        </div>
      )}
    </div>
  );
}
