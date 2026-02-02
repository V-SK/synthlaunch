'use client';

import { useState, useEffect, useRef } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, useChainId } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { useI18n } from '@/lib/i18n';
import { SYNTHID_ABI, SYNTHID_ADDRESS } from '@/lib/synthid';
import { BnbThemeProvider, BnbCard, BnbButton } from '@/components/identity/BnbTheme';
import { IdentityNav } from '@/components/identity/IdentityNav';
import { AgentPreviewCard } from '@/components/identity/AgentPreviewCard';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const LIMITS = {
  name: 32,
  platformId: 64,
  avatar: 256,
  description: 280,
  skillTag: 24,
  skillCount: 10,
};

type VerifyStatus = 'idle' | 'verifying' | 'verified' | 'failed';
type MintStep = 'idle' | 'minting' | 'setting-uri' | 'setting-skills' | 'done';

interface MoltbookAgent {
  name: string;
  avatar_url: string;
  bio: string;
  is_claimed: boolean;
  karma: number;
  x_handle: string;
}

function RegisterPageInner() {
  const { t, locale } = useI18n();
  const isZh = locale === 'zh';
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const isWrongNetwork = isConnected && chainId !== 56;

  const [moltbookId, setMoltbookId] = useState('');
  const [verifyStatus, setVerifyStatus] = useState<VerifyStatus>('idle');
  const [verifyError, setVerifyError] = useState('');
  const [agentData, setAgentData] = useState<MoltbookAgent | null>(null);

  // Editable fields (pre-filled from Moltbook)
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('');
  const [description, setDescription] = useState('');
  const [skillsInput, setSkillsInput] = useState('');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [bnbPrice, setBnbPrice] = useState(0);
  const [mintStep, setMintStep] = useState<MintStep>('idle');
  const [mintedTokenId, setMintedTokenId] = useState<number>(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const skills = skillsInput.split(',').map(s => s.trim()).filter(Boolean).slice(0, LIMITS.skillCount);
  const platform = 'moltbook';

  // Read mint fee from contract (C3)
  const { data: contractMintFee } = useReadContract({
    address: SYNTHID_ADDRESS,
    abi: SYNTHID_ABI,
    functionName: 'mintFee',
  });
  const mintFeeBn = contractMintFee ? (contractMintFee as bigint) : parseEther('0.04');
  const mintFeeBnbDisplay = formatEther(mintFeeBn);

  // Check wallet duplicate (C5)
  const { data: existingId } = useReadContract({
    address: SYNTHID_ADDRESS,
    abi: SYNTHID_ABI,
    functionName: 'walletToId',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
  const walletHasId = existingId && Number(existingId) > 0;

  // Step 1: register (mint)
  const { writeContract: writeMint, data: mintTxHash, isPending: isMinting, error: mintError } = useWriteContract();
  const { isSuccess: isMintSuccess } = useWaitForTransactionReceipt({ hash: mintTxHash });

  // Step 2: setAgentURI
  const { writeContract: writeUri, data: uriTxHash, error: uriError, reset: resetUri } = useWriteContract();
  const { isSuccess: isUriSuccess } = useWaitForTransactionReceipt({ hash: uriTxHash });

  // Step 3: setSkills
  const { writeContract: writeSkills, data: skillsTxHash, error: skillsError, reset: resetSkills } = useWriteContract();
  const { isSuccess: isSkillsSuccess } = useWaitForTransactionReceipt({ hash: skillsTxHash });

  // Read token ID after mint
  const { refetch: refetchTokenId } = useReadContract({
    address: SYNTHID_ADDRESS,
    abi: SYNTHID_ABI,
    functionName: 'walletToId',
    args: address ? [address] : undefined,
    query: { enabled: false },
  });

  // Fetch BNB price
  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd');
        const data = await res.json();
        setBnbPrice(data.binancecoin?.usd || 0);
      } catch { setBnbPrice(0); }
    };
    fetchPrice();
    const interval = setInterval(fetchPrice, 60000);
    return () => clearInterval(interval);
  }, []);

  // After mint success → set URI
  useEffect(() => {
    if (isMintSuccess && mintStep === 'minting') {
      handlePostMint();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMintSuccess]);

  // After URI set → set skills or done
  useEffect(() => {
    if (isUriSuccess && mintStep === 'setting-uri') {
      if (skills.length > 0 && mintedTokenId > 0) {
        setMintStep('setting-skills');
        writeSkills({
          address: SYNTHID_ADDRESS,
          abi: SYNTHID_ABI,
          functionName: 'setSkills',
          args: [BigInt(mintedTokenId), skills],
        });
      } else {
        setMintStep('done');
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUriSuccess, mintStep]);

  // After skills set → done
  useEffect(() => {
    if (isSkillsSuccess && mintStep === 'setting-skills') {
      setMintStep('done');
    }
  }, [isSkillsSuccess, mintStep]);

  // Handle mint error - go back to idle
  useEffect(() => {
    if (mintError && mintStep === 'minting') {
      setError(isZh ? '铸造交易失败，请重试' : 'Mint transaction failed. Please try again.');
      setMintStep('idle');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mintError]);

  // ============ Moltbook Verification ============

  const handleVerify = async () => {
    const id = moltbookId.trim();
    if (!id) {
      setVerifyError(isZh ? '请输入 Moltbook 用户名' : 'Please enter Moltbook username');
      return;
    }

    setVerifyStatus('verifying');
    setVerifyError('');
    setAgentData(null);

    try {
      // Call Moltbook API to verify agent
      const res = await fetch(`https://www.moltbook.com/api/v1/agents/profile?name=${encodeURIComponent(id)}`);
      
      if (!res.ok) {
        setVerifyStatus('failed');
        setVerifyError(isZh ? `找不到 Agent "${id}"` : `Agent "${id}" not found`);
        return;
      }

      const data = await res.json();
      const agent = data.agent || data;

      if (!agent.name) {
        setVerifyStatus('failed');
        setVerifyError(isZh ? `"${id}" 不是有效的 Moltbook Agent` : `"${id}" is not a valid Moltbook agent`);
        return;
      }

      if (!agent.is_claimed) {
        setVerifyStatus('failed');
        setVerifyError(isZh ? `Agent "${id}" 尚未被 Claimed（需要先在 Moltbook 认领）` : `Agent "${id}" is not claimed yet (must be claimed on Moltbook first)`);
        return;
      }

      // Check if already registered on SynthID (handle errors properly)
      const checkRes = await fetch(`/api/synthid/check?platform=moltbook&platformId=${encodeURIComponent(agent.name)}`);
      if (!checkRes.ok) {
        setVerifyStatus('failed');
        setVerifyError(isZh ? 'SynthID 链上检查失败，请稍后再试' : 'SynthID on-chain check failed. Please try again later.');
        return;
      }
      const checkData = await checkRes.json();
      if (checkData.exists) {
        setVerifyStatus('failed');
        setVerifyError(isZh ? `Agent "${agent.name}" 已注册 SynthID #${checkData.tokenId}` : `Agent "${agent.name}" already has SynthID #${checkData.tokenId}`);
        return;
      }

      setAgentData(agent);
      setVerifyStatus('verified');

      // Auto-fill fields
      setName(agent.name.slice(0, LIMITS.name));
      if (agent.avatar_url) setAvatar(agent.avatar_url);
      if (agent.bio) setDescription(agent.bio.slice(0, LIMITS.description));
    } catch {
      setVerifyStatus('failed');
      setVerifyError(isZh ? 'Moltbook API 请求失败' : 'Moltbook API request failed');
    }
  };

  // ============ Post-Mint ============

  const handlePostMint = async () => {
    try {
      setMintStep('setting-uri');
      const result = await refetchTokenId();
      const tid = result.data ? Number(result.data) : 0;
      setMintedTokenId(tid);
      if (!tid) {
        setMintStep('done');
        return;
      }

      // Set agentURI to our metadata API
      writeUri({
        address: SYNTHID_ADDRESS,
        abi: SYNTHID_ABI,
        functionName: 'setAgentURI',
        args: [BigInt(tid), `https://synthlaunch.fun/api/synthid/${tid}`],
      });
    } catch {
      setMintStep('done');
    }
  };

  // Retry URI setting
  const handleRetryUri = () => {
    if (!mintedTokenId) return;
    resetUri();
    setMintStep('setting-uri');
    writeUri({
      address: SYNTHID_ADDRESS,
      abi: SYNTHID_ABI,
      functionName: 'setAgentURI',
      args: [BigInt(mintedTokenId), `https://synthlaunch.fun/api/synthid/${mintedTokenId}`],
    });
  };

  // Retry skills setting
  const handleRetrySkills = () => {
    if (!mintedTokenId || skills.length === 0) return;
    resetSkills();
    setMintStep('setting-skills');
    writeSkills({
      address: SYNTHID_ADDRESS,
      abi: SYNTHID_ABI,
      functionName: 'setSkills',
      args: [BigInt(mintedTokenId), skills],
    });
  };

  // ============ Avatar Upload ============

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError(isZh ? '请上传图片文件' : 'Please upload an image file');
      return;
    }
    if (file.size > 1024 * 1024) {
      setError(isZh ? '图片最大 1MB' : 'Image max 1MB');
      return;
    }

    setError('');
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/synthid/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.url) {
        setAvatar(data.url);
      } else {
        setError(isZh ? 'IPFS 上传失败' : 'IPFS upload failed');
      }
    } catch {
      setError(isZh ? '上传出错' : 'Upload error');
    } finally {
      setUploading(false);
    }
  };

  // ============ Mint ============

  const handleMint = () => {
    setError('');
    if (verifyStatus !== 'verified') {
      setError(isZh ? '请先验证 Moltbook 身份' : 'Please verify Moltbook identity first');
      return;
    }
    if (!name.trim()) {
      setError(isZh ? '名称不能为空' : 'Name is required');
      return;
    }
    setMintStep('minting');
    writeMint({
      address: SYNTHID_ADDRESS,
      abi: SYNTHID_ABI,
      functionName: 'register',
      args: [name, platform, agentData?.name || moltbookId.trim(), avatar, description],
      value: mintFeeBn,
    });
  };

  const feeUsd = bnbPrice > 0 ? `~$${(Number(mintFeeBnbDisplay) * bnbPrice).toFixed(1)}` : '...';

  const stepLabel = () => {
    const totalSteps = skills.length > 0 ? 3 : 2;
    switch (mintStep) {
      case 'minting': return isZh ? `⏳ 铸造中... (1/${totalSteps})` : `⏳ Minting... (1/${totalSteps})`;
      case 'setting-uri': return isZh ? `🔗 设置 URI... (2/${totalSteps})` : `🔗 Setting URI... (2/${totalSteps})`;
      case 'setting-skills': return isZh ? `🏷 设置技能标签... (3/${totalSteps})` : `🏷 Setting skills... (3/${totalSteps})`;
      default: return '';
    }
  };

  return (
    <BnbThemeProvider>
      <div className="max-w-6xl mx-auto px-4 py-6">
        <IdentityNav />

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#EAECEF] mb-1">{t('sid.register.title')}</h1>
          <p className="text-sm text-[#848E9C]">
            {isZh
              ? '验证你的 Moltbook Agent 身份，在 BSC 上铸造链上 ERC-721 身份证'
              : 'Verify your Moltbook Agent identity and mint an on-chain ERC-721 ID on BSC'}
          </p>
        </div>

        {/* Wrong network warning (M1) */}
        {isWrongNetwork && (
          <div className="mb-6 p-4 bg-[#F6465D]/10 border border-[#F6465D]/30 rounded-xl text-sm text-[#F6465D] flex items-center gap-2">
            ⚠️ {isZh ? '请切换到 BSC 主网 (Chain ID: 56)' : 'Please switch to BSC Mainnet (Chain ID: 56)'}
          </div>
        )}

        {/* Wallet already has ID warning (C5) */}
        {walletHasId && (
          <div className="mb-6 p-4 bg-[#F0B90B]/10 border border-[#F0B90B]/30 rounded-xl text-sm text-[#F0B90B] flex items-center gap-2">
            ⚠️ {isZh
              ? `此钱包已拥有 SynthID #${Number(existingId)}，每个钱包只能注册一个`
              : `This wallet already has SynthID #${Number(existingId)}. One per wallet.`}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Form */}
            <div className="space-y-4">

              {/* Step 1: Moltbook Verification */}
              <BnbCard className="p-6 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-[#F0B90B] bg-[#F0B90B]/10 px-2 py-0.5 rounded">STEP 1</span>
                  <span className="text-sm font-bold text-[#EAECEF]">
                    {isZh ? '验证 Moltbook 身份' : 'Verify Moltbook Identity'}
                  </span>
                </div>
                <p className="text-xs text-[#848E9C]">
                  {isZh
                    ? '输入你的 Moltbook Agent 用户名，系统将自动验证身份并获取资料'
                    : 'Enter your Moltbook Agent username. We\'ll verify identity and fetch profile data.'}
                </p>

                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#848E9C] text-sm">🦞</span>
                    <input
                      type="text"
                      value={moltbookId}
                      onChange={(e) => { setMoltbookId(e.target.value); setVerifyStatus('idle'); setVerifyError(''); }}
                      placeholder={isZh ? 'Moltbook 用户名' : 'Moltbook username'}
                      disabled={verifyStatus === 'verified' || mintStep !== 'idle'}
                      className="w-full pl-9 pr-4 py-2.5 bg-[#0B0E11] border border-[#2B3139] rounded-lg text-[#EAECEF] placeholder-[#848E9C] text-sm focus:outline-none focus:border-[#F0B90B]/50 transition-colors disabled:opacity-50"
                      onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                    />
                  </div>
                  {verifyStatus === 'verified' ? (
                    <button
                      onClick={() => { setVerifyStatus('idle'); setAgentData(null); setName(''); setAvatar(''); setDescription(''); }}
                      disabled={mintStep !== 'idle'}
                      className="px-4 py-2.5 bg-[#2B3139] hover:bg-[#363C45] border border-[#2B3139] rounded-lg text-sm text-[#848E9C] transition-colors disabled:opacity-50"
                    >
                      {isZh ? '重置' : 'Reset'}
                    </button>
                  ) : (
                    <BnbButton
                      onClick={handleVerify}
                      disabled={verifyStatus === 'verifying' || mintStep !== 'idle'}
                      variant="primary"
                      className="px-6"
                    >
                      {verifyStatus === 'verifying' ? (isZh ? '验证中...' : 'Verifying...') : (isZh ? '验证' : 'Verify')}
                    </BnbButton>
                  )}
                </div>

                {verifyError && (
                  <div className="text-xs text-[#F6465D] p-2 bg-[#F6465D]/10 border border-[#F6465D]/20 rounded-lg">
                    ❌ {verifyError}
                  </div>
                )}

                {verifyStatus === 'verified' && agentData && (
                  <div className="flex items-center gap-3 p-3 bg-[#0ECB81]/5 border border-[#0ECB81]/20 rounded-lg">
                    {agentData.avatar_url && (
                      <img src={agentData.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-[#EAECEF] truncate">{agentData.name}</div>
                      <div className="text-xs text-[#848E9C]">
                        Karma: {agentData.karma} · {agentData.is_claimed ? '✅ Claimed' : '❌ Not Claimed'}
                      </div>
                    </div>
                    <span className="text-[#0ECB81] text-lg">✓</span>
                  </div>
                )}
              </BnbCard>

              {/* Step 2: Profile (only visible after verification) */}
              {verifyStatus === 'verified' && (
                <BnbCard className="p-6 space-y-5">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-[#F0B90B] bg-[#F0B90B]/10 px-2 py-0.5 rounded">STEP 2</span>
                    <span className="text-sm font-bold text-[#EAECEF]">
                      {isZh ? '确认资料' : 'Confirm Profile'}
                    </span>
                  </div>

                  {/* Agent Name */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-[#848E9C] flex items-center justify-between">
                      <span>{isZh ? 'Agent 名称' : 'Agent Name'} <span className="text-[#F6465D]">*</span></span>
                      <span className={`${name.length > LIMITS.name ? 'text-[#F6465D]' : 'text-[#848E9C]/50'}`}>
                        {name.length}/{LIMITS.name}
                      </span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value.slice(0, LIMITS.name))}
                      disabled={mintStep !== 'idle'}
                      className="w-full px-4 py-2.5 bg-[#0B0E11] border border-[#2B3139] rounded-lg text-[#EAECEF] text-sm focus:outline-none focus:border-[#F0B90B]/50 transition-colors disabled:opacity-50"
                    />
                  </div>

                  {/* Avatar */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-[#848E9C] flex items-center justify-between">
                      <span>{isZh ? '头像' : 'Avatar'}</span>
                      <span className="text-[#848E9C]/50">JPG/PNG/GIF/WebP · max 1MB · 256×256px</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={avatar}
                        onChange={(e) => setAvatar(e.target.value.slice(0, LIMITS.avatar))}
                        placeholder={isZh ? '输入 URL 或上传...' : 'URL or upload...'}
                        disabled={mintStep !== 'idle'}
                        className="flex-1 px-4 py-2.5 bg-[#0B0E11] border border-[#2B3139] rounded-lg text-[#EAECEF] placeholder-[#848E9C] text-sm focus:outline-none focus:border-[#F0B90B]/50 transition-colors disabled:opacity-50"
                      />
                      <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                      <button
                        onClick={() => fileRef.current?.click()}
                        disabled={uploading || mintStep !== 'idle'}
                        className="px-4 py-2.5 bg-[#2B3139] hover:bg-[#363C45] border border-[#2B3139] rounded-lg text-sm text-[#EAECEF] transition-colors disabled:opacity-50 whitespace-nowrap"
                      >
                        {uploading ? '...' : '📁'}
                      </button>
                    </div>
                    {avatar && avatar.startsWith('http') && (
                      <div className="mt-2 flex items-center gap-2">
                        <img src={avatar} alt="" className="w-8 h-8 rounded-full object-cover border border-[#2B3139]" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        <span className="text-xs text-[#0ECB81]">✓</span>
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-[#848E9C] flex items-center justify-between">
                      <span>{isZh ? '描述 / 简介' : 'Description'}</span>
                      <span className={`${description.length > LIMITS.description ? 'text-[#F6465D]' : 'text-[#848E9C]/50'}`}>
                        {description.length}/{LIMITS.description}
                      </span>
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value.slice(0, LIMITS.description))}
                      rows={2}
                      disabled={mintStep !== 'idle'}
                      className="w-full px-4 py-2.5 bg-[#0B0E11] border border-[#2B3139] rounded-lg text-[#EAECEF] placeholder-[#848E9C] text-sm focus:outline-none focus:border-[#F0B90B]/50 transition-colors resize-none disabled:opacity-50"
                    />
                  </div>

                  {/* Skills */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-[#848E9C] flex items-center justify-between">
                      <span>{isZh ? '技能标签' : 'Skills'}</span>
                      <span className="text-[#848E9C]/50">{isZh ? `最多 ${LIMITS.skillCount} 个` : `Max ${LIMITS.skillCount}`}</span>
                    </label>
                    <input
                      type="text"
                      value={skillsInput}
                      onChange={(e) => setSkillsInput(e.target.value)}
                      placeholder={isZh ? '交易, DeFi, 分析 (逗号分隔)' : 'Trading, DeFi, Analytics (comma separated)'}
                      disabled={mintStep !== 'idle'}
                      className="w-full px-4 py-2.5 bg-[#0B0E11] border border-[#2B3139] rounded-lg text-[#EAECEF] placeholder-[#848E9C] text-sm focus:outline-none focus:border-[#F0B90B]/50 transition-colors disabled:opacity-50"
                    />
                    {skills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {skills.map((s, i) => (
                          <span key={i} className="text-[11px] px-2 py-0.5 bg-[#F0B90B]/10 text-[#F0B90B] border border-[#F0B90B]/20 rounded-full">{s}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </BnbCard>
              )}

              {/* Mint Fee + Button */}
              <BnbCard className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-[#848E9C]">{isZh ? '铸造费用' : 'Mint Fee'}</span>
                  <div className="text-right">
                    <span className="text-lg font-bold text-[#F0B90B]">{mintFeeBnbDisplay} BNB</span>
                    <span className="text-xs text-[#848E9C] ml-2">{feeUsd}</span>
                  </div>
                </div>

                {error && (
                  <div className="text-xs text-[#F6465D] mb-3 p-2 bg-[#F6465D]/10 border border-[#F6465D]/20 rounded-lg">
                    {error}
                  </div>
                )}

                {!isConnected ? (
                  <BnbButton disabled variant="primary" className="w-full text-base py-3 opacity-60">
                    🔗 {isZh ? '连接钱包' : 'Connect Wallet'}
                  </BnbButton>
                ) : isWrongNetwork ? (
                  <BnbButton disabled variant="primary" className="w-full text-base py-3 opacity-60">
                    ⚠️ {isZh ? '请切换到 BSC 主网' : 'Switch to BSC Mainnet'}
                  </BnbButton>
                ) : walletHasId && mintStep === 'idle' ? (
                  <BnbButton disabled variant="primary" className="w-full text-base py-3 opacity-40">
                    {isZh ? `钱包已有 SynthID #${Number(existingId)}` : `Wallet has SynthID #${Number(existingId)}`}
                  </BnbButton>
                ) : mintStep === 'done' ? (
                  <div className="text-center py-4">
                    <div className="text-3xl mb-2">✅</div>
                    <p className="text-[#0ECB81] font-bold mb-1">
                      {isZh ? 'SynthID 铸造成功！' : 'SynthID Minted Successfully!'}
                    </p>
                    {mintedTokenId > 0 && (
                      <p className="text-sm text-[#F0B90B] font-mono mb-1">Token #{mintedTokenId}</p>
                    )}
                    <p className="text-xs text-[#848E9C]">
                      {isZh ? '你的 AI Agent 链上身份已创建' : 'Your AI Agent on-chain identity is live'}
                    </p>
                  </div>
                ) : (uriError && mintStep === 'setting-uri') ? (
                  <div className="text-center py-3 space-y-2">
                    <div className="text-sm text-[#F6465D]">
                      {isZh ? '❌ 设置 URI 失败' : '❌ Failed to set URI'}
                    </div>
                    {mintedTokenId > 0 && (
                      <p className="text-xs text-[#0ECB81]">
                        {isZh ? `✅ Token #${mintedTokenId} 已铸造成功` : `✅ Token #${mintedTokenId} minted successfully`}
                      </p>
                    )}
                    <div className="flex gap-2 justify-center">
                      <BnbButton onClick={handleRetryUri} variant="primary" className="px-6 py-2 text-sm">
                        {isZh ? '🔄 重试' : '🔄 Retry'}
                      </BnbButton>
                      <BnbButton onClick={() => setMintStep('done')} variant="secondary" className="px-6 py-2 text-sm">
                        {isZh ? '跳过' : 'Skip'}
                      </BnbButton>
                    </div>
                  </div>
                ) : (skillsError && mintStep === 'setting-skills') ? (
                  <div className="text-center py-3 space-y-2">
                    <div className="text-sm text-[#F6465D]">
                      {isZh ? '❌ 设置技能失败' : '❌ Failed to set skills'}
                    </div>
                    {mintedTokenId > 0 && (
                      <p className="text-xs text-[#0ECB81]">
                        {isZh ? `✅ Token #${mintedTokenId} 已铸造 + URI 已设置` : `✅ Token #${mintedTokenId} minted + URI set`}
                      </p>
                    )}
                    <div className="flex gap-2 justify-center">
                      <BnbButton onClick={handleRetrySkills} variant="primary" className="px-6 py-2 text-sm">
                        {isZh ? '🔄 重试' : '🔄 Retry'}
                      </BnbButton>
                      <BnbButton onClick={() => setMintStep('done')} variant="secondary" className="px-6 py-2 text-sm">
                        {isZh ? '跳过' : 'Skip'}
                      </BnbButton>
                    </div>
                  </div>
                ) : mintStep !== 'idle' ? (
                  <div className="text-center py-3">
                    <div className="text-sm text-[#F0B90B] font-mono animate-pulse">{stepLabel()}</div>
                    <p className="text-[10px] text-[#848E9C] mt-2">
                      {isZh ? '请在钱包中确认交易' : 'Please confirm in wallet'}
                    </p>
                  </div>
                ) : verifyStatus !== 'verified' ? (
                  <BnbButton disabled variant="primary" className="w-full text-base py-3 opacity-40">
                    {isZh ? '请先完成 Step 1 验证' : 'Complete Step 1 verification first'}
                  </BnbButton>
                ) : (
                  <BnbButton onClick={handleMint} disabled={isMinting} variant="primary" className="w-full text-base py-3">
                    {isZh ? '🆔 铸造 SynthID' : '🆔 Mint SynthID'}
                  </BnbButton>
                )}

                <p className="text-[10px] text-[#848E9C] text-center mt-3">
                  ⛓ Soulbound · Non-transferable · One per wallet · BSC Mainnet
                </p>
              </BnbCard>
            </div>

            {/* Preview */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-[#848E9C] uppercase tracking-wider">{isZh ? '身份预览' : 'Identity Preview'}</h3>
              <AgentPreviewCard
                name={name || 'Agent Name'}
                platform={platform}
                platformId={moltbookId || '...'}
                avatar={avatar}
                description={description}
                skills={skills}
              />
              {verifyStatus === 'verified' && (
                <div className="text-xs text-[#0ECB81] flex items-center gap-1.5 bg-[#0ECB81]/5 border border-[#0ECB81]/20 rounded-lg p-3">
                  <span className="text-base">🛡</span>
                  {isZh ? 'Moltbook 身份已验证' : 'Moltbook identity verified'}
                </div>
              )}
            </div>
          </div>
      </div>
    </BnbThemeProvider>
  );
}

export default function RegisterPage() {
  return (
    <ErrorBoundary>
      <RegisterPageInner />
    </ErrorBoundary>
  );
}
