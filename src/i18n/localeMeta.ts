import type { UiLocale } from '../lib/storage';

export const SUPPORTED_RESOLVED_LOCALES = ['en', 'fr', 'ja', 'he', 'es', 'de'] as const;

export type ResolvedLocale = (typeof SUPPORTED_RESOLVED_LOCALES)[number];

export function isResolvedLocale(x: string): x is ResolvedLocale {
  return (SUPPORTED_RESOLVED_LOCALES as readonly string[]).includes(x);
}

/** Manual picks shown in settings (not `auto`). */
export type UiLocaleChoice = Exclude<UiLocale, 'auto'>;

export const LOCALE_DROPDOWN: readonly {
  value: UiLocale;
  flag: string;
  /** Endonym for stable display in any UI language */
  nativeName: string;
}[] = [
  { value: 'auto', flag: '🌐', nativeName: '' },
  { value: 'en', flag: '🇺🇸', nativeName: 'English' },
  { value: 'fr', flag: '🇫🇷', nativeName: 'Français' },
  { value: 'ja', flag: '🇯🇵', nativeName: '日本語' },
  { value: 'he', flag: '🇮🇱', nativeName: 'עברית' },
  { value: 'es', flag: '🇪🇸', nativeName: 'Español' },
  { value: 'de', flag: '🇩🇪', nativeName: 'Deutsch' },
];

export function nativeNameForResolvedLocale(locale: ResolvedLocale): string {
  const row = LOCALE_DROPDOWN.find((x) => x.value === locale);
  return row?.nativeName ?? locale;
}

/** Label for `<option>`: auto shows browser mode + currently active language; others show flag + endonym. */
export function formatLocaleOptionLabel(
  value: UiLocale,
  resolvedWhenAuto: ResolvedLocale,
  t: (k: string, p?: Record<string, string>) => string,
): string {
  if (value === 'auto') {
    const current = nativeNameForResolvedLocale(resolvedWhenAuto);
    return `${t('settings.languageAuto')} — ${current}`;
  }
  const row = LOCALE_DROPDOWN.find((x) => x.value === value);
  if (!row) return value;
  return `${row.flag} ${row.nativeName}`;
}
