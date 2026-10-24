import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = path.resolve(fileURLToPath(import.meta.url), '..', '..', 'dist');
const LOCALES = ['es', 'zh', 'ja', 'fr', 'de', 'pt', 'ko', 'it'];

// Static asset extensions never localized (kept in sync with src/utils/links.ts).
const ASSET_EXT = /\.(?:png|jpe?g|gif|svg|ico|webp|xml|txt|pdf|zip|json|webmanifest|css|js|woff2?|ttf|otf|eot)(?:[?#].*)?$/i;

function collectHtml(dir) {
  let results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results = results.concat(collectHtml(full));
    else if (entry.isFile() && entry.name.endsWith('.html')) results.push(full);
  }
  return results;
}

const aRe = /<a\s+([^>]*?)>/gi;

let violations = 0;
let filesScanned = 0;

for (const locale of LOCALES) {
  const dir = path.join(DIST, locale);
  if (!fs.existsSync(dir)) continue;
  const files = collectHtml(dir);
  for (const file of files) {
    filesScanned++;
    const html = fs.readFileSync(file, 'utf8');
    let match;
    while ((match = aRe.exec(html)) !== null) {
      const attrs = match[1];
      // Language switcher links intentionally point to other locales (or
      // prefix-less English); they are not violations.
      if (attrs.includes('data-lang')) continue;
      const hrefMatch = attrs.match(/href=["']([^"']+)["']/);
      if (!hrefMatch) continue;
      const href = hrefMatch[1];
      // Ignore external URLs, other protocols, fragment-only, and static assets.
      if (/^https?:\/\//i.test(href)) continue;
      if (/^[a-z][a-z0-9+.-]*:/i.test(href)) continue;
      if (href.startsWith('#')) continue;
      // Root-relative internal links must carry the locale prefix.
      if (href.startsWith('/')) {
        if (ASSET_EXT.test(href)) continue;
        if (href.startsWith('/#')) continue;
        const expectedPrefix = '/' + locale + '/';
        const isHome = href === '/' + locale;
        const isPrefixed = href.startsWith(expectedPrefix);
        if (!isHome && !isPrefixed) {
          console.error(`VIOLATION [${locale}] ${path.relative(DIST, file)}: href="${href}"`);
          violations++;
        }
      }
    }
  }
}

console.log(`Scanned ${filesScanned} HTML files across ${LOCALES.length} locale directories.`);
if (violations > 0) {
  console.error(`\n${violations} localized-link violation(s) found.`);
  process.exit(1);
}
console.log('All localized links carry the correct locale prefix. Zero violations.');
