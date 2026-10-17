export const STATUS_STYLES = {
  MATCH: {
    chipText: '#6ee7b7',
    chipBg: '#047857',
    chipBorder: '#047857',
    rowBg: 'transparent',
    rowBorder: 'transparent',
    textColor: '#cccccc',
    hoverBg: '#1a1a1a',
    borderBottom: '#262626',
  },
  MISMATCH: {
    chipText: '#fcd34d',
    chipBg: '#78350f',
    chipBorder: '#78350f',
    rowBg: '#3b1219',
    rowBorder: '#b91c1c',
    textColor: '#fcd34d',
    hoverBg: '#1a1a1a',
    borderBottom: '#262626',
  },
  ONLY_LEFT: {
    chipText: '#fcd34d',
    chipBg: '#78350f',
    chipBorder: '#78350f',
    rowBg: '#2d2208',
    rowBorder: '#78350f',
    textColor: '#fcd34d',
    hoverBg: '#1a1a1a',
    borderBottom: '#262626',
  },
  ONLY_RIGHT: {
    chipText: '#c3d9f3',
    chipBg: '#3a3a3a',
    chipBorder: '#3a3a3a',
    rowBg: '#1e1b4b',
    rowBorder: '#3a3a3a',
    textColor: '#c3d9f3',
    hoverBg: '#1a1a1a',
    borderBottom: '#262626',
  },
  DUPLICATE_KEY: {
    chipText: '#d4a017',
    chipBg: '#3a3a3a',
    chipBorder: '#3a3a3a',
    rowBg: '#141414',
    rowBorder: '#3a3a3a',
    textColor: '#d4a017',
    hoverBg: '#1a1a1a',
    borderBottom: '#262626',
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