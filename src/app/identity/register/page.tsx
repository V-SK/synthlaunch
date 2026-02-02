'use client';

import { useState, useEffect, useRef } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { parseEther } from 'viem';
import { useI18n } from '@/lib/i18n';
import { SYNTHID_ABI, SYNTHID_ADDRESS } from '@/lib/synthid';
import { BnbThemeProvider, BnbCard, BnbButton } from '@/components/identity/BnbTheme';
import { IdentityNav } from '@/components/identity/IdentityNav';
import { AgentPreviewCard } from '@/components/identity/AgentPreviewCard';

const MINT_FEE_BNB = 0.04;
const LIMITS = {
  name: 32,
  platformId: 64,
  avatar: 256,
  description: 280,
  skillTag: 24,
  skillCount: 10,
};

type MintStep = 'idle' | 'minting' | 'uploading-meta' | 'setting-uri' | 'done';

export default function RegisterPage() {
  const { t, isZh } = useI18n();
  const { isConnected, address } = useAccount();

  const [name, setName] = useState('');
  const [platform, setPlatform] = useState('moltbook');
  const [platformId, setPlatformId] = useState('');
  const [avatar, setAvatar] = useState('');
  const [description, setDescription] = useState('');
  const [skillsInput, setSkillsInput] = useState('');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [bnbPrice, setBnbPrice] = useState(0);
  const [mintStep, setMintStep] = useState<MintStep>('idle');
  const fileRef = useRef<HTMLInputElement>(null);

  const skills = skillsInput.split(',').map(s => s.trim()).filter(Boolean).slice(0, LIMITS.skillCount);

  // Step 1: register (mint)
  const { writeContract: writeMint, data: mintTxHash, isPending: isMinting } = useWriteContract();
  const { isSuccess: isMintSuccess } = useWaitForTransactionReceipt({ hash: mintTxHash });

  // Step 2: setAgentURI
  const { writeContract: writeUri, data: uriTxHash, isPending: isSettingUri } = useWriteContract();
  const { isSuccess: isUriSuccess } = useWaitForTransactionReceipt({ hash: uriTxHash });

  // Read token ID after mint
  const { data: tokenId, refetch: refetchTokenId } = useReadContract({
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

  // After mint success → upload metadata → set URI
  useEffect(() => {
    if (isMintSuccess && mintStep === 'minting') {
      handlePostMint();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMintSuccess]);

  // After URI set success → done
  useEffect(() => {
    if (isUriSuccess && mintStep === 'setting-uri') {
      setMintStep('done');
    }
  }, [isUriSuccess, mintStep]);

  const handlePostMint = async () => {
    try {
      setMintStep('uploading-meta');

      // Get token ID
      const result = await refetchTokenId();
      const tid = result.data ? Number(result.data) : 0;
      if (!tid) {
        setError(isZh ? '无法获取 Token ID' : 'Failed to get Token ID');
        setMintStep('done'); // Still show success for mint
        return;
      }

      // Upload metadata to IPFS
      const res = await fetch('/api/synthid/metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, platform, platformId, avatar, description, skills, tokenId: tid,
        }),
      });
      const data = await res.json();
      if (!data.uri) {
        setError(isZh ? 'Metadata 上传失败，NFT 已铸造但头像可能不显示' : 'Metadata upload failed, NFT minted but avatar may not display');
        setMintStep('done');
        return;
      }

      // Set agent URI on-chain
      setMintStep('setting-uri');
      writeUri({
        address: SYNTHID_ADDRESS,
        abi: SYNTHID_ABI,
        functionName: 'setAgentURI',
        args: [BigInt(tid), data.uri],
      });
    } catch (err) {
      console.error('Post-mint error:', err);
      setError(isZh ? 'Metadata 设置出错，NFT 已铸造' : 'Metadata setup error, NFT already minted');
      setMintStep('done');
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError(isZh ? '请上传图片文件 (JPG/PNG/GIF/WebP)' : 'Please upload an image file (JPG/PNG/GIF/WebP)');
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
      formData.append('name', 'SynthID Avatar');
      formData.append('symbol', 'SID');
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.cid) {
        setAvatar(`https://gateway.pinata.cloud/ipfs/${data.cid}`);
      } else {
        setError(isZh ? 'IPFS 上传失败' : 'IPFS upload failed');
      }
    } catch {
      setError(isZh ? '上传出错' : 'Upload error');
    } finally {
      setUploading(false);
    }
  };

  const handleMint = () => {
    setError('');
    if (!name.trim()) {
      setError(t('sid.register.nameRequired'));
      return;
    }
    if (name.length > LIMITS.name) {
      setError(isZh ? `名称最多 ${LIMITS.name} 字符` : `Name max ${LIMITS.name} characters`);
      return;
    }
    if (!platformId.trim()) {
      setError(t('sid.register.platformIdRequired'));
      return;
    }
    if (description.length > LIMITS.description) {
      setError(isZh ? `描述最多 ${LIMITS.description} 字符` : `Description max ${LIMITS.description} characters`);
      return;
    }
    setMintStep('minting');
    writeMint({
      address: SYNTHID_ADDRESS,
      abi: SYNTHID_ABI,
      functionName: 'register',
      args: [name, platform, platformId, avatar, description],
      value: parseEther('0.04'),
    });
  };

  const feeUsd = bnbPrice > 0 ? `~$${(MINT_FEE_BNB * bnbPrice).toFixed(1)}` : '...';

  const stepLabel = () => {
    switch (mintStep) {
      case 'minting': return isZh ? '⏳ 铸造中... (1/3)' : '⏳ Minting... (1/3)';
      case 'uploading-meta': return isZh ? '📤 上传 Metadata... (2/3)' : '📤 Uploading metadata... (2/3)';
      case 'setting-uri': return isZh ? '🔗 设置 NFT 头像... (3/3)' : '🔗 Setting NFT image... (3/3)';
      default: return '';
    }
  };

  return (
    <BnbThemeProvider>
      <div className="max-w-6xl mx-auto px-4 py-6">
        <IdentityNav />

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#EAECEF] mb-1">{t('sid.register.title')}</h1>
          <p className="text-sm text-[#848E9C]">{t('sid.register.subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Form */}
            <div className="space-y-4">
              <BnbCard className="p-6 space-y-5">
                {/* Agent Name */}
                <div className="space-y-1.5">
                  <label className="text-xs text-[#848E9C] flex items-center justify-between">
                    <span>{t('sid.register.agentName')} <span className="text-[#F6465D]">*</span></span>
                    <span className={`${name.length > LIMITS.name ? 'text-[#F6465D]' : 'text-[#848E9C]/50'}`}>
                      {name.length}/{LIMITS.name}
                    </span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value.slice(0, LIMITS.name + 10))}
                    placeholder={t('sid.register.agentNamePlaceholder')}
                    maxLength={LIMITS.name + 10}
                    disabled={mintStep !== 'idle'}
                    className="w-full px-4 py-2.5 bg-[#0B0E11] border border-[#2B3139] rounded-lg text-[#EAECEF] placeholder-[#848E9C] text-sm focus:outline-none focus:border-[#F0B90B]/50 transition-colors disabled:opacity-50"
                  />
                </div>

                {/* Platform */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs text-[#848E9C]">{t('sid.register.platform')}</label>
                    <select
                      value={platform}
                      onChange={(e) => setPlatform(e.target.value)}
                      disabled={mintStep !== 'idle'}
                      className="w-full px-4 py-2.5 bg-[#0B0E11] border border-[#2B3139] rounded-lg text-[#EAECEF] text-sm focus:outline-none focus:border-[#F0B90B]/50 transition-colors disabled:opacity-50"
                    >
                      <option value="moltbook">🦞 Moltbook</option>
                      <option value="twitter">𝕏 Twitter</option>
                      <option value="custom">🔗 Custom</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-[#848E9C] flex items-center justify-between">
                      <span>{t('sid.register.platformId')} <span className="text-[#F6465D]">*</span></span>
                      <span className="text-[#848E9C]/50">{platformId.length}/{LIMITS.platformId}</span>
                    </label>
                    <input
                      type="text"
                      value={platformId}
                      onChange={(e) => setPlatformId(e.target.value.slice(0, LIMITS.platformId))}
                      placeholder={t('sid.register.platformIdPlaceholder')}
                      maxLength={LIMITS.platformId}
                      disabled={mintStep !== 'idle'}
                      className="w-full px-4 py-2.5 bg-[#0B0E11] border border-[#2B3139] rounded-lg text-[#EAECEF] placeholder-[#848E9C] text-sm focus:outline-none focus:border-[#F0B90B]/50 transition-colors disabled:opacity-50"
                    />
                  </div>
                </div>

                {/* Avatar */}
                <div className="space-y-1.5">
                  <label className="text-xs text-[#848E9C] flex items-center justify-between">
                    <span>{isZh ? '头像' : 'Avatar'}</span>
                    <span className="text-[#848E9C]/50">JPG/PNG/GIF/WebP · {isZh ? '最大' : 'max'} 1MB · 256×256px {isZh ? '推荐' : 'recommended'}</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={avatar}
                      onChange={(e) => setAvatar(e.target.value.slice(0, LIMITS.avatar))}
                      placeholder={isZh ? '输入 URL 或上传图片...' : 'Enter URL or upload image...'}
                      disabled={mintStep !== 'idle'}
                      className="flex-1 px-4 py-2.5 bg-[#0B0E11] border border-[#2B3139] rounded-lg text-[#EAECEF] placeholder-[#848E9C] text-sm focus:outline-none focus:border-[#F0B90B]/50 transition-colors disabled:opacity-50"
                    />
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      onChange={handleAvatarUpload}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading || mintStep !== 'idle'}
                      className="px-4 py-2.5 bg-[#2B3139] hover:bg-[#363C45] border border-[#2B3139] rounded-lg text-sm text-[#EAECEF] transition-colors disabled:opacity-50 whitespace-nowrap"
                    >
                      {uploading ? (isZh ? '上传中...' : 'Uploading...') : (isZh ? '📁 上传' : '📁 Upload')}
                    </button>
                  </div>
                  {avatar && avatar.startsWith('http') && (
                    <div className="mt-2 flex items-center gap-2">
                      <img src={avatar} alt="avatar preview" className="w-10 h-10 rounded-full object-cover border border-[#2B3139]" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      <span className="text-xs text-[#0ECB81]">✓ {isZh ? '头像已设置' : 'Avatar set'}</span>
                    </div>
                  )}
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label className="text-xs text-[#848E9C] flex items-center justify-between">
                    <span>{t('sid.register.description')}</span>
                    <span className={`${description.length > LIMITS.description ? 'text-[#F6465D]' : 'text-[#848E9C]/50'}`}>
                      {description.length}/{LIMITS.description}
                    </span>
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value.slice(0, LIMITS.description + 20))}
                    placeholder={t('sid.register.descriptionPlaceholder')}
                    rows={3}
                    disabled={mintStep !== 'idle'}
                    className="w-full px-4 py-2.5 bg-[#0B0E11] border border-[#2B3139] rounded-lg text-[#EAECEF] placeholder-[#848E9C] text-sm focus:outline-none focus:border-[#F0B90B]/50 transition-colors resize-none disabled:opacity-50"
                  />
                </div>

                {/* Skills */}
                <div className="space-y-1.5">
                  <label className="text-xs text-[#848E9C] flex items-center justify-between">
                    <span>{t('sid.register.skills')}</span>
                    <span className="text-[#848E9C]/50">{isZh ? `最多 ${LIMITS.skillCount} 个，每个最多 ${LIMITS.skillTag} 字符` : `Max ${LIMITS.skillCount} tags, ${LIMITS.skillTag} chars each`}</span>
                  </label>
                  <input
                    type="text"
                    value={skillsInput}
                    onChange={(e) => setSkillsInput(e.target.value)}
                    placeholder={t('sid.register.skillsPlaceholder')}
                    disabled={mintStep !== 'idle'}
                    className="w-full px-4 py-2.5 bg-[#0B0E11] border border-[#2B3139] rounded-lg text-[#EAECEF] placeholder-[#848E9C] text-sm focus:outline-none focus:border-[#F0B90B]/50 transition-colors disabled:opacity-50"
                  />
                  {skills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {skills.map((s, i) => (
                        <span key={i} className={`text-[11px] px-2 py-0.5 border rounded-full ${
                          s.length > LIMITS.skillTag
                            ? 'bg-[#F6465D]/10 text-[#F6465D] border-[#F6465D]/20'
                            : 'bg-[#F0B90B]/10 text-[#F0B90B] border-[#F0B90B]/20'
                        }`}>
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </BnbCard>

              {/* Mint Fee + Button */}
              <BnbCard className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-[#848E9C]">{t('sid.register.mintFee')}</span>
                  <div className="text-right">
                    <span className="text-lg font-bold text-[#F0B90B]">{MINT_FEE_BNB} BNB</span>
                    <span className="text-xs text-[#848E9C] ml-2">{feeUsd}</span>
                  </div>
                </div>

                {error && (
                  <div className="text-xs text-[#F6465D] mb-3 p-2 bg-[#F6465D]/10 border border-[#F6465D]/20 rounded-lg">
                    {error}
                  </div>
                )}

                {!isConnected ? (
                  <BnbButton
                    disabled
                    variant="primary"
                    className="w-full text-base py-3 opacity-60"
                  >
                    🔗 {t('sid.register.connectWallet')}
                  </BnbButton>
                ) : mintStep === 'done' ? (
                  <div className="text-center py-4">
                    <div className="text-3xl mb-2">✅</div>
                    <p className="text-[#0ECB81] font-bold mb-1">
                      {isZh ? 'SynthID 铸造成功！' : 'SynthID Minted Successfully!'}
                    </p>
                    <p className="text-xs text-[#848E9C]">
                      {isZh ? 'NFT 头像已设置，钱包中即可查看' : 'NFT image set, viewable in your wallet'}
                    </p>
                  </div>
                ) : mintStep !== 'idle' ? (
                  <div className="text-center py-3">
                    <div className="text-sm text-[#F0B90B] font-mono animate-pulse">{stepLabel()}</div>
                    <p className="text-[10px] text-[#848E9C] mt-2">
                      {isZh ? '请在钱包中确认交易' : 'Please confirm transaction in wallet'}
                    </p>
                  </div>
                ) : (
                  <BnbButton
                    onClick={handleMint}
                    disabled={isMinting}
                    variant="primary"
                    className="w-full text-base py-3"
                  >
                    {t('sid.register.mintButton')}
                  </BnbButton>
                )}

                <p className="text-[10px] text-[#848E9C] text-center mt-3">
                  ⛓ Soulbound · Non-transferable · One per wallet · BSC Mainnet
                </p>
              </BnbCard>
            </div>

            {/* Preview */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-[#848E9C] uppercase tracking-wider">{t('sid.register.preview')}</h3>
              <AgentPreviewCard
                name={name}
                platform={platform}
                platformId={platformId}
                avatar={avatar}
                description={description}
                skills={skills}
              />
            </div>
          </div>
      </div>
    </BnbThemeProvider>
  );
}
