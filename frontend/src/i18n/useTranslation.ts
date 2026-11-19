import { create } from 'zustand';
import { type Language, type LanguageInfo, SUPPORTED_LANGUAGES, detectBrowserLanguage } from './types';
import { translations } from './translations';

interface TranslationState {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, fallback?: string) => string;
  currentLanguageInfo: () => LanguageInfo;
}

export const useTranslation = create<TranslationState>((set, get) => ({
  language: detectBrowserLanguage(),

  setLanguage: (lang: Language) => {
    try {
      localStorage.setItem('botstudio_language', lang);
    } catch {}
    set({ language: lang });
  },

  t: (key: string, fallback?: string): string => {
    const lang = get().language;
    const langDict = translations[lang] || translations.ru;
    if (langDict && langDict[key]) {
      return langDict[key];
    }
    // Fallback to English or Russian, then fallback string or key itself
    if (translations.ru && translations.ru[key]) {
      return translations.ru[key];
    }
    return fallback || key;
  },

  currentLanguageInfo: (): LanguageInfo => {
    const lang = get().language;
    return SUPPORTED_LANGUAGES.find((l) => l.code === lang) || SUPPORTED_LANGUAGES[0];
  }
}));
