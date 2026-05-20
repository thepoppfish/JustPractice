import type { UiLocale } from '../lib/storage';
import { isResolvedLocale, type ResolvedLocale } from './localeMeta';
import en from './locales/en.json';
import fr from './locales/fr.json';
import ja from './locales/ja.json';
import he from './locales/he.json';
import es from './locales/es.json';
import de from './locales/de.json';

export type MessageKey = keyof typeof en;

export type { ResolvedLocale } from './localeMeta';
export {
  formatLocaleOptionLabel,
  isResolvedLocale,
  languageLabelForLocale,
  LOCALE_DROPDOWN,
  LOCALE_LABEL_KEYS,
  nativeNameForResolvedLocale,
} from './localeMeta';

const baseEn = en as Record<string, string>;

function mergeDict(over: Record<string, string>): Record<string, string> {
  return { ...baseEn, ...over };
}

const dicts: Record<ResolvedLocale, Record<string, string>> = {
  en: baseEn,
  fr: mergeDict(fr as Record<string, string>),
  ja: mergeDict(ja as Record<string, string>),
  he: mergeDict(he as Record<string, string>),
  es: mergeDict(es as Record<string, string>),
  de: mergeDict(de as Record<string, string>),
};

/** Map stored preference + browser language to a supported UI locale. */
export function resolveLocale(uiLocale: UiLocale | undefined, navigatorLanguage?: string): ResolvedLocale {
  if (uiLocale && uiLocale !== 'auto' && isResolvedLocale(uiLocale)) return uiLocale;
  const nav = (
    navigatorLanguage ??
    (typeof navigator !== 'undefined' ? navigator.language : 'en') ??
    'en'
  ).toLowerCase();
  if (nav.startsWith('ja')) return 'ja';
  if (nav.startsWith('he') || nav.startsWith('iw')) return 'he';
  if (nav.startsWith('fr')) return 'fr';
  if (nav.startsWith('es')) return 'es';
  if (nav.startsWith('de')) return 'de';
  return 'en';
}

export type Translator = (key: string, params?: Record<string, string | number>) => string;

export function createTranslator(locale: ResolvedLocale): Translator {
  const table = dicts[locale] ?? dicts.en;
  const fallback = dicts.en;
  return (key: string, params?: Record<string, string | number>) => {
    let s = table[key] ?? fallback[key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        s = s.replaceAll(`{${k}}`, String(v));
      }
    }
    return s;
  };
}
