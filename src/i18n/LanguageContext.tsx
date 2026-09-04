import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import {
  AVAILABLE_LANGUAGES,
  VoiceLanguageCode,
} from '@/types/product';
import { translations, TranslationKey } from './translations';

export interface TranslationParams {
  [key: string]: string | number;
}

interface LanguageContextValue {
  language: VoiceLanguageCode;
  setLanguage: (code: VoiceLanguageCode) => void;
  t: (key: TranslationKey, params?: TranslationParams) => string;
  nativeLabel: string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [language, setLanguage] = useState<VoiceLanguageCode>('hi-IN');

  const t = useCallback(
    (key: TranslationKey, params?: TranslationParams): string => {
      const table = translations[language] ?? translations['en-US'];
      let text: string = table[key] ?? translations['en-US'][key] ?? key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          text = text.split(`{${k}}`).join(String(v));
        }
      }
      return text;
    },
    [language]
  );

  const nativeLabel = useMemo(() => {
    return (
      AVAILABLE_LANGUAGES.find((l) => l.code === language)?.nativeLabel ??
      'हिन्दी'
    );
  }, [language]);

  const value = useMemo<LanguageContextValue>(
    () => ({ language, setLanguage, t, nativeLabel }),
    [language, t, nativeLabel]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return ctx;
}
