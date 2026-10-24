// fix-strip-modal.cjs
// Renames Tailwind v4 theme tokens --spacing-* -> --space-* in src/styles/global.css
// so max-w-* utilities no longer resolve to these pixel widths instead of container sizes.
// Idempotent: a second run changes nothing.

const fs = require('fs');
const path = require('path');

const ROOT = process.argv[2];

if (!ROOT) {
  console.error('Usage: node fix-strip-modal.cjs "<path-to-project-root>"');
  process.exit(1);
}

const cssPath = path.join(ROOT, 'src', 'styles', 'global.css');

if (!fs.existsSync(cssPath)) {
  console.error('File not found:', cssPath);
  process.exit(1);
}

const original = fs.readFileSync(cssPath, 'utf8');
const updated = original.replace(/--spacing-/g, '--space-');

if (updated === original) {
  console.log('No changes needed (already fixed).');
  process.exit(0);
}

fs.writeFileSync(cssPath, updated, 'utf8');

const count = (original.match(/--spacing-/g) || []).length;
console.log(`Renamed ${count} --spacing-* token(s) to --space-* in ${cssPath}`);
