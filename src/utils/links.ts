import { defaultLocale, getLocalizedPathname, stripLocalePrefix, type Locale } from '../config.ts';

// Static file asset extensions that must never receive a locale prefix.
const ASSET_EXT = /\.(?:png|jpe?g|gif|svg|ico|webp|xml|txt|pdf|zip|json|webmanifest|css|js|woff2?|ttf|otf|eot)(?:[?#].*)?$/i;

function stripTrailingSlash(path: string): string {
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
}

/**
 * Localize a root-relative href for the given locale.
 *
 * - Absolute URLs (http/https) and other protocols (mailto:, tel:) are returned unchanged.
 * - Fragment-only links (#...) are returned unchanged.
 * - Static file assets (.png, .xml, .txt, ...) are returned unchanged.
 * - Internal paths are prefixed with the locale (e.g. /compare -> /es/compare).
 * - Idempotent: an existing locale prefix is stripped before re-prefixing, so
 *   /es/es/compare can never be produced.
 * - Trailing slashes are normalized (consistent with Astro's default trailingSlash: 'never').
 * - Query strings and hashes are preserved.
 */
export function localizeHref(lang: Locale, href: string): string {
  if (/^https?:\/\//i.test(href)) return href;
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return href;
  if (href.startsWith('#')) return href;

  const match = href.match(/^([^?#]*)(\?.*)?(#.*)?$/);
  const path = match ? match[1] : href;
  const suffix = match ? (match[2] ?? '') + (match[3] ?? '') : '';

  if (ASSET_EXT.test(path)) return href;

  const base = stripTrailingSlash(stripLocalePrefix(path));
  return getLocalizedPathname(lang, base === '' ? '/' : base) + suffix;
}

export { defaultLocale };
