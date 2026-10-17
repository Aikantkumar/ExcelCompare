export const CHANGE_CATEGORIES = [
  { id: 'ENTERED_VALUE', label: 'Entered values', group: 'VALUES', tooltip: 'A typed-in (non-formula) value changed', colorToken: '#fcd34d', pattern: null },
  { id: 'CALCULATED_VALUE', label: 'Calculated values', group: 'VALUES', tooltip: 'Same formula on both sides, but its result changed', colorToken: '#c3d9f3', pattern: null },
  { id: 'FORMULA', label: 'Formulas', group: 'FORMULAS', tooltip: 'The formula was really edited', colorToken: '#a5b4fc', pattern: null },
  { id: 'SYSGEN_FORMULA', label: 'Formulas (system-generated)', group: 'FORMULAS', tooltip: 'The formula text changed only because rows or columns were inserted or deleted. Nobody edited it.', colorToken: '#a5b4fc', pattern: 'dashed' },
  { id: 'STRUCTURAL', label: 'Structural', group: 'STRUCTURE', tooltip: 'Rows, columns or sheets added or removed, or a sheet shown or hidden', colorToken: '#6ee7b7', pattern: null },
  { id: 'NAMES', label: 'Names', group: 'STRUCTURE', tooltip: 'A defined name was added, removed or now points elsewhere', colorToken: '#d4a017', pattern: null },
  { id: 'SYSGEN_NAMES', label: 'Names (system-generated)', group: 'STRUCTURE', tooltip: 'A defined name moved only because of inserted or deleted rows or columns', colorToken: '#d4a017', pattern: 'dashed' },
  { id: 'CELL_FORMAT', label: 'Cell format', group: 'PRESENTATION', tooltip: 'Number format changed (fill / font where available). The value is the same.', colorToken: '#cccccc', pattern: null },
  { id: 'MACROS', label: 'Macros', group: 'CODE', tooltip: 'The VBA project was added, removed or changed', colorToken: '#d4a017', pattern: null },
];

export const AUDIT_FLAGS = [
  { id: 'HARDCODED', label: 'Formula replaced by value', group: 'AUDIT', tooltip: 'A formula on side A became a plain constant on side B', icon: '⚠' },
  { id: 'NEW_ERROR', label: 'New errors', group: 'AUDIT', tooltip: 'Side B shows an Excel error where A did not', icon: '⚠' },
  { id: 'ERROR_CLEARED', label: 'Errors cleared', group: 'AUDIT', tooltip: 'Side A had an Excel error that is no longer present on side B', icon: '⚠' },
];

export const CATEGORY_GROUPS = ['VALUES', 'FORMULAS', 'STRUCTURE', 'PRESENTATION', 'CODE', 'AUDIT'];

export function getCategoryById(id) {
  return CHANGE_CATEGORIES.find(c => c.id === id) || AUDIT_FLAGS.find(c => c.id === id);
}

export function getCategoryColor(id) {
  const cat = getCategoryById(id);
  return cat?.colorToken || '#999999';
}

export function getCategoryPattern(id) {
  const cat = getCategoryById(id);
  return cat?.pattern || 'solid';
}

export function getStructuralColor(subtype) {
  switch (subtype) {
    case 'ROW_ADDED':
    case 'COLUMN_ADDED':
    case 'SHEET_ADDED':
      return '#6ee7b7';
    case 'ROW_DELETED':
    case 'COLUMN_DELETED':
    case 'SHEET_REMOVED':
      return '#fca5a5';
    case 'SHEET_VISIBILITY':
      return '#999999';
    default:
      return '#6ee7b7';
  }
}

export function getStructuralPattern(subtype) {
  return 'solid';
}

export function describeChange(change) {
  const { category, subtype, valA, valB, formulaA, formulaB, cellRef, flags = [] } = change;

  const flagText = flags.length > 0 ? ' · ' + flags.map(f => `⚠ ${f}`).join(', ') : '';

  switch (category) {
    case 'ENTERED_VALUE':
      return `Entered value changed${flagText}`;
    case 'CALCULATED_VALUE':
      return `Calculated value changed${flagText}`;
    case 'FORMULA':
      return `Formula changed${flagText}`;
    case 'SYSGEN_FORMULA':
      return `Formula adjusted by inserted/deleted rows${flagText}`;
    case 'STRUCTURAL':
      switch (subtype) {
        case 'ROW_ADDED':
          return `Row added${flagText}`;
        case 'ROW_DELETED':
          return `Row deleted${flagText}`;
        case 'COLUMN_ADDED':
          return `Column added${flagText}`;
        case 'COLUMN_DELETED':
          return `Column deleted${flagText}`;
        case 'SHEET_ADDED':
          return `Sheet added${flagText}`;
        case 'SHEET_REMOVED':
          return `Sheet removed${flagText}`;
        case 'SHEET_VISIBILITY':
          return `Sheet visibility changed${flagText}`;
        default:
          return `Structural change${flagText}`;
      }
    case 'NAMES':
      return `Name "${change.name || ''}" ${subtype === 'ADDED' ? 'added' : subtype === 'REMOVED' ? 'removed' : 'now refers to ' + (change.ref || '')}${flagText}`;
    case 'SYSGEN_NAMES':
      return `Name "${change.name || ''}" moved by row/column shifts${flagText}`;
    case 'CELL_FORMAT':
      return `Number format changed${flagText}`;
    case 'MACROS':
      return `Macros ${subtype === 'VBA_ADDED' ? 'added' : subtype === 'VBA_REMOVED' ? 'removed' : 'changed'}${flagText}`;
    default:
      return `Change${flagText}`;
  }
}

export function groupChanges(changes) {
  const groups = new Map();
  
  changes.forEach(change => {
    const { category, subtype, rowIdx, colIdx } = change;
    
    if (category === 'STRUCTURAL' && (subtype === 'ROW_ADDED' || subtype === 'ROW_DELETED')) {
      const key = `ROW_${subtype}_${rowIdx}`;
      if (!groups.has(key)) {
        groups.set(key, {
          category: 'STRUCTURAL',
          subtype,
          rowIdx,
          colIdx: -1,
          cellRef: '',
          valA: '—',
          valB: '—',
          description: describeChange(change),
          count: 0,
          changes: [],
        });
      }
      groups.get(key).changes.push(change);
      groups.get(key).count++;
    } else if (category === 'STRUCTURAL' && (subtype === 'COLUMN_ADDED' || subtype === 'COLUMN_DELETED')) {
      const key = `COL_${subtype}_${colIdx}`;
      if (!groups.has(key)) {
        groups.set(key, {
          category: 'STRUCTURAL',
          subtype,
          rowIdx: -1,
          colIdx,
          cellRef: '',
          valA: '—',
          valB: '—',
          description: describeChange(change),
          count: 0,
          changes: [],
        });
      }
      groups.get(key).changes.push(change);
      groups.get(key).count++;
    } else {
      const key = `${category}_${rowIdx}_${colIdx}`;
      if (!groups.has(key)) {
        groups.set(key, {
          ...change,
          description: describeChange(change),
          count: 1,
          changes: [change],
        });
      } else {
        groups.get(key).changes.push(change);
        groups.get(key).count++;
      }
    }
  });

  return Array.from(groups.values());
}