export const locales = ['en', 'es', 'zh', 'ja', 'fr', 'de', 'pt', 'ko', 'it'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

export const localeConfig: Record<Locale, { dir: 'ltr' | 'rtl'; locale: string; name: string; nativeName: string }> = {
  en: { dir: 'ltr', locale: 'en_US', name: 'English', nativeName: 'English' },
  es: { dir: 'ltr', locale: 'es_ES', name: 'Spanish', nativeName: 'Español' },
  zh: { dir: 'ltr', locale: 'zh_CN', name: 'Chinese', nativeName: '中文' },
  ja: { dir: 'ltr', locale: 'ja_JP', name: 'Japanese', nativeName: '日本語' },
  fr: { dir: 'ltr', locale: 'fr_FR', name: 'French', nativeName: 'Français' },
  de: { dir: 'ltr', locale: 'de_DE', name: 'German', nativeName: 'Deutsch' },
  pt: { dir: 'ltr', locale: 'pt_PT', name: 'Portuguese', nativeName: 'Português' },
  ko: { dir: 'ltr', locale: 'ko_KR', name: 'Korean', nativeName: '한국어' },
  it: { dir: 'ltr', locale: 'it_IT', name: 'Italian', nativeName: 'Italiano' },
};

export const gaMeasurementId = 'G-RWL8QFE4RW';

export const siteUrl = 'https://compareexcel.com';

export function getLocaleFromPathname(pathname: string): Locale {
  for (const loc of locales) {
    if (pathname === `/${loc}/` || pathname.startsWith(`/${loc}/`)) {
      return loc;
    }
  }
  return defaultLocale;
}

export function getLocalizedPathname(locale: Locale, pathname: string): string {
  const base = stripLocalePrefix(pathname);
  if (locale === defaultLocale) return base;
  return `/${locale}${base === '/' ? '' : base}`;
}

export function stripLocalePrefix(pathname: string): string {
  for (const l of locales) {
    if (pathname === `/${l}/` || pathname.startsWith(`/${l}/`)) {
      return pathname.slice(`/${l}`.length);
    }
    if (pathname === `/${l}`) return '/';
  }
  return pathname;
}

export function localizePath(pathname: string, locale: Locale): string {
  const base = stripLocalePrefix(pathname);
  const prefix = locale === defaultLocale ? '' : `/${locale}`;
  return prefix === '' ? base : `${prefix}${base}`;
}

export function buildCanonical(locale: Locale, pathname: string): string {
  return `${siteUrl}${localizePath(pathname, locale)}`;
}

export function isDefaultLocale(locale: Locale): boolean {
  return locale === defaultLocale;
}
