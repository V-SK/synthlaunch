'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import en from './en.json';
import zh from './zh.json';

type Locale = 'en' | 'zh';
type Translations = typeof en;

const translations: Record<Locale, Translations> = { en, zh };

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: Record<string, string>) => string;
}

const I18nContext = createContext<I18nContextType>({
  locale: 'en',
  setLocale: () => {},
  t: (key) => key,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');

  useEffect(() => {
    const saved = localStorage.getItem('synthlaunch-lang') as Locale;
    if (saved && (saved === 'en' || saved === 'zh')) {
      setLocaleState(saved);
    } else {
      // Auto-detect from browser
      const browserLang = navigator.language.toLowerCase();
      if (browserLang.startsWith('zh')) {
        setLocaleState('zh');
      }
    }
  }, []);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    localStorage.setItem('synthlaunch-lang', l);
  };

  const t = (key: string, vars?: Record<string, string>): string => {
    const keys = key.split('.');
    let result: unknown = translations[locale];
    for (const k of keys) {
      if (result && typeof result === 'object' && k in result) {
        result = (result as Record<string, unknown>)[k];
      } else {
        return key; // Fallback to key
      }
    }
    let str = String(result);
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        str = str.replace(`{${k}}`, v);
      }
    }
    return str;
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}

export function LanguageToggle() {
  const { locale, setLocale } = useI18n();
  return (
    <button
      onClick={() => setLocale(locale === 'en' ? 'zh' : 'en')}
      className="px-2 py-1 text-xs font-mono text-synth-muted hover:text-synth-text border border-synth-border rounded transition-colors"
      title={locale === 'en' ? '切换中文' : 'Switch to English'}
    >
      {locale === 'en' ? '中文' : 'EN'}
    </button>
  );
}
