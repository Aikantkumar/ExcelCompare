import { defaultLocale, type Locale } from '../config';
import en from '../lang/en.json';
import es from '../lang/es.json';
import zh from '../lang/zh.json';
import ja from '../lang/ja.json';
import fr from '../lang/fr.json';
import de from '../lang/de.json';
import pt from '../lang/pt.json';
import ko from '../lang/ko.json';
import it from '../lang/it.json';

const translations: Record<Locale, Record<string, unknown>> = {
  en,
  es,
  zh,
  ja,
  fr,
  de,
  pt,
  ko,
  it,
};

export function t(lang: Locale, path: string, fallback = ''): string {
  const dict = translations[lang] ?? translations[defaultLocale];
  let val: unknown = dict;
  for (const key of path.split('.')) {
    if (val && typeof val === 'object' && key in (val as Record<string, unknown>)) {
      val = (val as Record<string, unknown>)[key];
    } else {
      return fallback;
    }
  }
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  return fallback;
}

export type { Locale };
export { translations };
