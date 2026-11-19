export type Language =
  | 'ru'
  | 'en'
  | 'fr'
  | 'de'
  | 'es'
  | 'ja'
  | 'ko'
  | 'pt'
  | 'it';

export interface LanguageInfo {
  code: Language;
  name: string;
  nativeName: string;
  flag: string;
  speechCode: string;
}

export const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺', speechCode: 'ru-RU' },
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸', speechCode: 'en-US' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷', speechCode: 'fr-FR' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪', speechCode: 'de-DE' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', speechCode: 'es-ES' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵', speechCode: 'ja-JP' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷', speechCode: 'ko-KR' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇧🇷', speechCode: 'pt-BR' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹', speechCode: 'it-IT' }
];

export function detectBrowserLanguage(): Language {
  try {
    const saved = localStorage.getItem('botstudio_language') as Language;
    if (saved && SUPPORTED_LANGUAGES.some((l) => l.code === saved)) {
      return saved;
    }
  } catch {
    // ignore localStorage errors
  }

  try {
    const navLangs = navigator.languages || [navigator.language || ''];
    for (const raw of navLangs) {
      const code = raw.toLowerCase().slice(0, 2);
      if (code === 'ru' || code === 'be' || code === 'uk') return 'ru';
      if (code === 'en') return 'en';
      if (code === 'fr') return 'fr';
      if (code === 'de') return 'de';
      if (code === 'es') return 'es';
      if (code === 'ja') return 'ja';
      if (code === 'ko') return 'ko';
      if (code === 'pt') return 'pt';
      if (code === 'it') return 'it';
    }
  } catch {
    // fallback
  }

  return 'ru';
}
