'use client';

import { BnbCard } from './BnbTheme';
import { useI18n } from '@/lib/i18n';

export function FeatureCards() {
  const { t } = useI18n();

  const features = [
    {
      icon: '🆔',
      title: t('sid.feature1Title'),
      desc: t('sid.feature1Desc'),
      accent: '#F0B90B',
    },
    {
      icon: '⭐',
      title: t('sid.feature2Title'),
      desc: t('sid.feature2Desc'),
      accent: '#0ECB81',
      badge: t('sid.comingSoon'),
    },
    {
      icon: '✅',
      title: t('sid.feature3Title'),
      desc: t('sid.feature3Desc'),
      accent: '#00D4FF',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {features.map((f, i) => (
        <BnbCard key={i} className="p-6 relative overflow-hidden">
          {/* Top accent */}
          <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${f.accent}60, transparent)` }} />
          
          <div className="text-3xl mb-3">{f.icon}</div>
          <h3 className="text-base font-bold text-[#EAECEF] mb-2 flex items-center gap-2">
            {f.title}
            {f.badge && (
              <span className="text-[10px] px-1.5 py-0.5 bg-[#0ECB81]/15 text-[#0ECB81] border border-[#0ECB81]/30 rounded font-medium">
                {f.badge}
              </span>
            )}
          </h3>
          <p className="text-sm text-[#848E9C] leading-relaxed">{f.desc}</p>
        </BnbCard>
      ))}
    </div>
  );
}
