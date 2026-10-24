import assert from 'node:assert';
import { localizeHref } from '../src/utils/links.ts';
import {
  stripLocalePrefix,
  getLocalizedPathname,
  locales,
  defaultLocale,
} from '../src/config.ts';

const LOCALES = locales;

function eq(actual, expected, msg) {
  assert.strictEqual(actual, expected, msg);
}

// ---------- localizeHref ----------
eq(localizeHref('en', '/'), '/', 'en home');
eq(localizeHref('es', '/'), '/es', 'es home');
eq(localizeHref('es', '/compare'), '/es/compare', 'es compare');
eq(localizeHref('es', '/compare/'), '/es/compare', 'es compare trailing slash normalized');
eq(localizeHref('es', '/es/compare'), '/es/compare', 'es compare idempotent no double prefix');
eq(localizeHref('ja', '/ja/compare'), '/ja/compare', 'ja idempotent');
eq(localizeHref('es', '/#features'), '/es#features', 'es fragment preserved');
eq(localizeHref('es', '/compare?x=1#y'), '/es/compare?x=1#y', 'es query and hash preserved');
eq(localizeHref('es', '/compare?q=1'), '/es/compare?q=1', 'es query preserved');
eq(localizeHref('es', 'https://compareexcel.com/compare'), 'https://compareexcel.com/compare', 'external https unchanged');
eq(localizeHref('es', 'http://example.com'), 'http://example.com', 'external http unchanged');
eq(localizeHref('es', 'mailto:legal@compareexcel.com'), 'mailto:legal@compareexcel.com', 'mailto unchanged');
eq(localizeHref('es', 'tel:+1234567890'), 'tel:+1234567890', 'tel unchanged');
eq(localizeHref('es', '/og-image.png'), '/og-image.png', 'png asset unchanged');
eq(localizeHref('es', '/favicon.svg'), '/favicon.svg', 'svg asset unchanged');
eq(localizeHref('es', '/sitemap-index.xml'), '/sitemap-index.xml', 'xml asset unchanged');
eq(localizeHref('es', '/site.webmanifest'), '/site.webmanifest', 'webmanifest asset unchanged');
eq(localizeHref('en', '/compare'), '/compare', 'en compare no prefix');
eq(localizeHref('en', '/'), '/', 'en root no prefix');

// Every locale localizes /compare correctly (no double prefix).
for (const loc of LOCALES) {
  const expected = loc === defaultLocale ? '/compare' : `/${loc}/compare`;
  eq(localizeHref(loc, '/compare'), expected, `localizeHref(${loc}, /compare)`);
  // Double-prefixing must never happen even when input already prefixed.
  eq(localizeHref(loc, `/${loc}/compare`), expected, `localizeHref(${loc}, /${loc}/compare) idempotent`);
}

// ---------- stripLocalePrefix ----------
eq(stripLocalePrefix('/es/compare'), '/compare', 'strip es/compare');
eq(stripLocalePrefix('/es/'), '/', 'strip es/');
eq(stripLocalePrefix('/es'), '/', 'strip es');
eq(stripLocalePrefix('/compare'), '/compare', 'strip non-localized');
eq(stripLocalePrefix('/'), '/', 'strip root');
eq(stripLocalePrefix('/en/compare'), '/compare', 'strip en/compare');

// ---------- getLocalizedPathname ----------
eq(getLocalizedPathname('es', '/'), '/es', 'getLocalized es root');
eq(getLocalizedPathname('es', '/compare'), '/es/compare', 'getLocalized es compare');
eq(getLocalizedPathname('en', '/compare'), '/compare', 'getLocalized en compare');
eq(getLocalizedPathname('ja', '/'), '/ja', 'getLocalized ja root');

console.log('All link tests passed.');
