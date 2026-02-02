'use client';

import { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther } from 'viem';
import { useI18n } from '@/lib/i18n';
import { SYNTHID_ABI, SYNTHID_ADDRESS } from '@/lib/synthid';
import { BnbThemeProvider, BnbCard, BnbButton } from '@/components/identity/BnbTheme';
import { IdentityNav } from '@/components/identity/IdentityNav';
import { AgentPreviewCard } from '@/components/identity/AgentPreviewCard';

export default function RegisterPage() {
  const { t } = useI18n();
  const { isConnected } = useAccount();

  const [name, setName] = useState('');
  const [platform, setPlatform] = useState('moltbook');
  const [platformId, setPlatformId] = useState('');
  const [avatar, setAvatar] = useState('');
  const [description, setDescription] = useState('');
  const [skillsInput, setSkillsInput] = useState('');
  const [error, setError] = useState('');

  const skills = skillsInput.split(',').map(s => s.trim()).filter(Boolean);

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const handleMint = () => {
    setError('');
    if (!name.trim()) {
      setError(t('sid.register.nameRequired'));
      return;
    }
    if (!platformId.trim()) {
      setError(t('sid.register.platformIdRequired'));
      return;
    }
    writeContract({
      address: SYNTHID_ADDRESS,
      abi: SYNTHID_ABI,
      functionName: 'register',
      args: [name, platform, platformId, avatar, description],
      value: parseEther('0.04'),
    });
  };

  return (
    <BnbThemeProvider>
      <div className="max-w-6xl mx-auto px-4 py-6">
        <IdentityNav />

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#EAECEF] mb-1">{t('sid.register.title')}</h1>
          <p className="text-sm text-[#848E9C]">{t('sid.register.subtitle')}</p>
        </div>

        {!isConnected ? (
          <BnbCard className="p-12 text-center">
            <div className="text-4xl mb-4">🔗</div>
            <h3 className="text-lg font-bold text-[#EAECEF] mb-2">{t('sid.register.connectWallet')}</h3>
            <p className="text-sm text-[#848E9C]">{t('sid.register.connectDesc')}</p>
          </BnbCard>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Form */}
            <div className="space-y-4">
              <BnbCard className="p-6 space-y-5">
                {/* Agent Name */}
                <div className="space-y-1.5">
                  <label className="text-xs text-[#848E9C] flex items-center gap-1">
                    {t('sid.register.agentName')} <span className="text-[#F6465D]">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('sid.register.agentNamePlaceholder')}
                    className="w-full px-4 py-2.5 bg-[#0B0E11] border border-[#2B3139] rounded-lg text-[#EAECEF] placeholder-[#848E9C] text-sm focus:outline-none focus:border-[#F0B90B]/50 transition-colors"
                  />
                </div>

                {/* Platform */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs text-[#848E9C]">{t('sid.register.platform')}</label>
                    <select
                      value={platform}
                      onChange={(e) => setPlatform(e.target.value)}
                      className="w-full px-4 py-2.5 bg-[#0B0E11] border border-[#2B3139] rounded-lg text-[#EAECEF] text-sm focus:outline-none focus:border-[#F0B90B]/50 transition-colors"
                    >
                      <option value="moltbook">🦞 Moltbook</option>
                      <option value="twitter">𝕏 Twitter</option>
                      <option value="custom">🔗 Custom</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-[#848E9C] flex items-center gap-1">
                      {t('sid.register.platformId')} <span className="text-[#F6465D]">*</span>
                    </label>
                    <input
                      type="text"
                      value={platformId}
                      onChange={(e) => setPlatformId(e.target.value)}
                      placeholder={t('sid.register.platformIdPlaceholder')}
                      className="w-full px-4 py-2.5 bg-[#0B0E11] border border-[#2B3139] rounded-lg text-[#EAECEF] placeholder-[#848E9C] text-sm focus:outline-none focus:border-[#F0B90B]/50 transition-colors"
                    />
                  </div>
                </div>

                {/* Avatar */}
                <div className="space-y-1.5">
                  <label className="text-xs text-[#848E9C]">{t('sid.register.avatarUrl')}</label>
                  <input
                    type="text"
                    value={avatar}
                    onChange={(e) => setAvatar(e.target.value)}
                    placeholder={t('sid.register.avatarUrlPlaceholder')}
                    className="w-full px-4 py-2.5 bg-[#0B0E11] border border-[#2B3139] rounded-lg text-[#EAECEF] placeholder-[#848E9C] text-sm focus:outline-none focus:border-[#F0B90B]/50 transition-colors"
                  />
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label className="text-xs text-[#848E9C]">{t('sid.register.description')}</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t('sid.register.descriptionPlaceholder')}
                    rows={3}
                    className="w-full px-4 py-2.5 bg-[#0B0E11] border border-[#2B3139] rounded-lg text-[#EAECEF] placeholder-[#848E9C] text-sm focus:outline-none focus:border-[#F0B90B]/50 transition-colors resize-none"
                  />
                </div>

                {/* Skills */}
                <div className="space-y-1.5">
                  <label className="text-xs text-[#848E9C]">{t('sid.register.skills')}</label>
                  <input
                    type="text"
                    value={skillsInput}
                    onChange={(e) => setSkillsInput(e.target.value)}
                    placeholder={t('sid.register.skillsPlaceholder')}
                    className="w-full px-4 py-2.5 bg-[#0B0E11] border border-[#2B3139] rounded-lg text-[#EAECEF] placeholder-[#848E9C] text-sm focus:outline-none focus:border-[#F0B90B]/50 transition-colors"
                  />
                  {skills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {skills.map((s, i) => (
                        <span key={i} className="text-[11px] px-2 py-0.5 bg-[#F0B90B]/10 text-[#F0B90B] border border-[#F0B90B]/20 rounded-full">
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
                    <span className="text-lg font-bold text-[#F0B90B]">0.04 BNB</span>
                    <span className="text-xs text-[#848E9C] ml-2">~$30</span>
                  </div>
                </div>

                {error && (
                  <div className="text-xs text-[#F6465D] mb-3 p-2 bg-[#F6465D]/10 border border-[#F6465D]/20 rounded-lg">
                    {error}
                  </div>
                )}

                {isSuccess ? (
                  <div className="text-center py-4">
                    <div className="text-3xl mb-2">✅</div>
                    <p className="text-[#0ECB81] font-bold">SynthID Minted Successfully!</p>
                  </div>
                ) : (
                  <BnbButton
                    onClick={handleMint}
                    disabled={isPending}
                    variant="primary"
                    className="w-full text-base py-3"
                  >
                    {isPending ? t('sid.register.minting') : t('sid.register.mintButton')}
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
        )}
      </div>
    </BnbThemeProvider>
  );
}
