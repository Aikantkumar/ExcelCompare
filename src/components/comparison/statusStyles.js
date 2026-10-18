export const STATUS_STYLES = {
  MATCH: {
    chipText: 'var(--color-diff-added-text)',
    chipBg: 'var(--color-diff-added-border)',
    chipBorder: 'var(--color-diff-added-border)',
    rowBg: 'transparent',
    rowBorder: 'transparent',
    textColor: 'var(--color-body)',
    hoverBg: 'var(--color-surface-hover)',
    borderBottom: 'var(--color-hairline)',
  },
  MISMATCH: {
    chipText: 'var(--color-diff-modified-text)',
    chipBg: 'var(--color-diff-modified-border)',
    chipBorder: 'var(--color-diff-modified-border)',
    rowBg: 'var(--color-diff-deleted-bg)',
    rowBorder: 'var(--color-diff-deleted-border)',
    textColor: 'var(--color-diff-modified-text)',
    hoverBg: 'var(--color-surface-hover)',
    borderBottom: 'var(--color-hairline)',
  },
  ONLY_LEFT: {
    chipText: 'var(--color-diff-modified-text)',
    chipBg: 'var(--color-diff-modified-border)',
    chipBorder: 'var(--color-diff-modified-border)',
    rowBg: 'var(--color-diff-modified-bg)',
    rowBorder: 'var(--color-diff-modified-border)',
    textColor: 'var(--color-diff-modified-text)',
    hoverBg: 'var(--color-surface-hover)',
    borderBottom: 'var(--color-hairline)',
  },
  ONLY_RIGHT: {
    chipText: 'var(--color-link)',
    chipBg: 'var(--color-hairline-strong)',
    chipBorder: 'var(--color-hairline-strong)',
    rowBg: 'var(--color-diff-formula-bg)',
    rowBorder: 'var(--color-hairline-strong)',
    textColor: 'var(--color-link)',
    hoverBg: 'var(--color-surface-hover)',
    borderBottom: 'var(--color-hairline)',
  },
  DUPLICATE_KEY: {
    chipText: 'var(--color-warning)',
    chipBg: 'var(--color-hairline-strong)',
    chipBorder: 'var(--color-hairline-strong)',
    rowBg: 'var(--color-surface-card)',
    rowBorder: 'var(--color-hairline-strong)',
    textColor: 'var(--color-warning)',
    hoverBg: 'var(--color-surface-hover)',
    borderBottom: 'var(--color-hairline)',
  },
};

export const STATUS_LABELS = {
  MATCH: 'MATCH',
  MISMATCH: 'MISMATCH',
  ONLY_LEFT: 'LEFT ONLY',
  ONLY_RIGHT: 'RIGHT ONLY',
  DUPLICATE_KEY: 'DUPLICATE KEY',
};

export function getStatusStyle(status) {
  return STATUS_STYLES[status] || STATUS_STYLES.MATCH;
}

export function getStatusLabel(status) {
  return STATUS_LABELS[status] || status;
}

export function parseNumber(val) {
  if (val == null) return NaN;
  const str = String(val).trim();
  if (!str) return NaN;
  const cleaned = str.replace(/[$,£€¥₹,\s]/g, '');
  const num = Number(cleaned);
  return isFinite(num) ? num : NaN;
}

export function hasNumericDifference(valA, valB) {
  const numA = parseNumber(valA);
  const numB = parseNumber(valB);
  return isFinite(numA) && isFinite(numB);
}

export function getNumericDifference(valA, valB) {
  const numA = parseNumber(valA);
  const numB = parseNumber(valB);
  if (isFinite(numA) && isFinite(numB)) {
    return numB - numA;
  }
  return null;
}
