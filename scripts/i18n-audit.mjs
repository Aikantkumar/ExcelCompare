import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const LANG_DIR = join(ROOT, 'src', 'lang');
const locales = ['en', 'es', 'zh', 'ja', 'fr', 'de', 'pt', 'ko', 'it'];

function flatten(obj, prefix = '') {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flatten(v, key));
    } else {
      out[key] = v;
    }
  }
  return out;
}

const EN = JSON.parse(readFileSync(join(LANG_DIR, 'en.json'), 'utf8'));
const enFlat = flatten(EN);

const BRAND_TOKENS = ['CompareExcel', 'Excel', 'SheetJS', '.xlsx', '.xls', '.csv', 'compareexcel.com'];
const IGNORE_SUBSTR = ['.xlsx, .xls, .csv', '.xlsx,.xls,.csv'];

function isExempt(val) {
  if (typeof val !== 'string') return false;
  if (val.length < 4) return true;
  if (IGNORE_SUBSTR.includes(val)) return true;
  let stripped = val;
  for (const token of BRAND_TOKENS) {
    stripped = stripped.replace(new RegExp(token.replace(/[.]/g, '\\.'), 'g'), '');
  }
  return stripped.trim().length === 0;
}

let hasMissing = false;
let totalNonEqual = 0;
let totalChecked = 0;
let anyOverThreshold = false;

const results = {};

for (const loc of locales) {
  if (loc === 'en') continue;
  const path = join(LANG_DIR, `${loc}.json`);
  let data;
  try {
    data = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    console.error(`${loc}: failed to read ${path}: ${e.message}`);
    process.exit(1);
  }
  const flat = flatten(data);

  const missing = [];
  const identical = [];

  for (const [key, enVal] of Object.entries(enFlat)) {
    if (!(key in flat)) {
      missing.push(key);
      hasMissing = true;
      continue;
    }
    const locVal = flat[key];
    if (typeof locVal === 'string' && typeof enVal === 'string' && locVal === enVal && !isExempt(enVal)) {
      identical.push(key);
    }
  }

  totalNonEqual += identical.length;
  totalChecked += Object.keys(flat).length;

  const pct = totalChecked > 0 ? (identical.length / Object.keys(flat).length) * 100 : 0;
  if (pct > 5) anyOverThreshold = true;

  results[loc] = { missing, identical, pct };

  console.log(`\n=== ${loc.toUpperCase()} ===`);
  console.log(`Keys missing: ${missing.length}`);
  if (missing.length > 0) console.log('  ' + missing.join('\n  '));
  console.log(`Identical to EN (>3 chars, non-brand): ${identical.length} (${pct.toFixed(1)}%)`);
  if (identical.length > 0) console.log('  ' + identical.join('\n  '));
}

console.log('\n========================================');
if (hasMissing) {
  console.error('FAIL: One or more languages are missing keys vs en.json.');
  process.exit(1);
}
if (anyOverThreshold) {
  console.error('FAIL: One or more languages have >5% identical values to English.');
  process.exit(1);
}
console.log('PASS: All languages have all keys and <=5% identical-to-EN values.');
process.exit(0);
