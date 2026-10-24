/**
 * Shared export builders for CompareExcel.
 *
 * All CSV / XLSX headers and type codes are stable ENGLISH constants and are
 * NOT translated. UI labels are handled by the calling components via t().
 *
 * Builders return:
 *   { csv: { content: string, filename: string } | null,
 *     workbook: XLSX.Workbook | null,
 *     xlsxFilename: string | null }
 *
 * The calling UI is responsible for downloading (via exportUtils.downloadBlob
 * for CSV and XLSX.writeFile / write-to-blob for XLSX).
 */

import { toCsv, buildFilename, buildWorkbook } from './exportUtils.js';

const TYPE_ORDER = { ADDED: 0, DELETED: 1, MODIFIED: 2, FORMULA_CHANGED: 3 };
const RECON_STATUS_ORDER = { MISMATCH: 0, LEFT_ONLY: 1, RIGHT_ONLY: 2, DUPLICATE_KEY: 3, MATCH: 4 };
const RECON_STATUS_LABEL = {
  MATCH: 'MATCH',
  MISMATCH: 'MISMATCH',
  ONLY_LEFT: 'LEFT_ONLY',
  ONLY_RIGHT: 'RIGHT_ONLY',
  DUPLICATE_KEY: 'DUPLICATE_KEY',
};

function rowNum(n) {
  return n === null ? Infinity : n;
}

function joinRows(rows) {
  if (!rows || rows.length === 0) return '';
  return rows.join('; ');
}

function isNumericValue(v) {
  if (v === null || v === undefined) return false;
  if (typeof v === 'number') return !isNaN(v);
  const str = String(v).trim();
  if (str === '') return false;
  return !isNaN(Number(str));
}

function numericValue(v) {
  if (v === null || v === undefined) return null;
  const n = Number(String(v).trim());
  return isNaN(n) ? null : n;
}

function difference(valA, valB) {
  const a = numericValue(valA);
  const b = numericValue(valB);
  if (a === null || b === null) return '';
  return b - a;
}

/* ------------------------------------------------------------------ */
/* 1) Changes export                                                  */
/* ------------------------------------------------------------------ */

export function buildChangesExport(diffData, ctx = {}) {
  const {
    fileA = 'File A',
    fileB = 'File B',
    sheetA = 'Sheet 1',
    sheetB = 'Sheet 1',
    options = {},
    annotations = {},
  } = ctx;

  const changes = Array.isArray(diffData?.changesList) ? diffData.changesList : [];
  const stats = diffData?.stats || {};
  const totalChanges = changes.length;

  const sheetLabel = sheetA && sheetB && sheetA !== sheetB ? `${sheetA} -> ${sheetB}` : (sheetA || 'A');

  // CSV rows
  const csvColumns = [
    { key: 'id', header: 'Change ID' },
    { key: 'type', header: 'Change Type' },
    { key: 'sheet', header: 'Sheet' },
    { key: 'cellRef', header: 'Cell Ref' },
    { key: 'header', header: 'Column Header' },
    { key: 'rowNumA', header: 'Row (Left)' },
    { key: 'rowNumB', header: 'Row (Right)' },
    { key: 'valA', header: 'Left Value' },
    { key: 'valB', header: 'Right Value' },
    { key: 'formulaA', header: 'Left Formula' },
    { key: 'formulaB', header: 'Right Formula' },
    { key: 'note', header: 'Note' },
  ];

  const sorted = [...changes].sort((a, b) => {
    const aMin = Math.min(rowNum(a.rowNumA), rowNum(a.rowNumB));
    const bMin = Math.min(rowNum(b.rowNumA), rowNum(b.rowNumB));
    if (aMin !== bMin) return aMin - bMin;
    if ((a.colIdx ?? 0) !== (b.colIdx ?? 0)) return (a.colIdx ?? 0) - (b.colIdx ?? 0);
    return (TYPE_ORDER[a.type] ?? 99) - (TYPE_ORDER[b.type] ?? 99);
  });

  const csvRows = sorted.map((c) => {
    let note = '';
    const noteKeys = [
      c.cellRef,
      c.rowNumA !== null ? `cell-${c.rowNumA}-${c.colIdx}` : null,
      c.rowNumB !== null ? `cell-${c.rowNumB}-${c.colIdx}` : null,
      `${c.rowIdx}_${c.colIdx}_A`,
      `${c.rowIdx}_${c.colIdx}_B`,
    ];
    for (const k of noteKeys) {
      if (k && annotations[k] !== undefined && annotations[k] !== null) {
        note = String(annotations[k]);
        break;
      }
    }
    return {
      id: c.id,
      type: c.type,
      sheet: sheetLabel,
      cellRef: c.cellRef || '',
      header: c.header || '',
      rowNumA: c.rowNumA === null ? '' : c.rowNumA,
      rowNumB: c.rowNumB === null ? '' : c.rowNumB,
      valA: c.valA === undefined ? '' : c.valA,
      valB: c.valB === undefined ? '' : c.valB,
      formulaA: c.formulaA === undefined ? '' : c.formulaA,
      formulaB: c.formulaB === undefined ? '' : c.formulaB,
      note,
    };
  });

  const csvContent = totalChanges === 0
    ? toCsv(csvColumns, [])
    : toCsv(csvColumns, csvRows);
  const csvFilename = buildFilename({
    mode: 'changes',
    left: fileA,
    right: fileB,
    part: 'all-changes',
    ext: 'csv',
  });

  // XLSX sheets
  const countsByType = { ADDED: 0, DELETED: 0, MODIFIED: 0, FORMULA_CHANGED: 0 };
  for (const c of changes) {
    if (countsByType[c.type] !== undefined) countsByType[c.type]++;
  }

  const summaryRows = [
    ['Property', 'Value'],
    ['Tool', 'CompareExcel'],
    ['Generated At', new Date().toISOString()],
    ['Left File', fileA],
    ['Right File', fileB],
    ['Left Sheet', sheetA],
    ['Right Sheet', sheetB],
    ['Compare Formulas', String(options.compareFormulas !== false)],
    ['Date Normalisation', options.normalizeDatesUS ? 'US' : options.normalizeDatesEU ? 'EU' : 'none'],
    ['Fuzzy Row Match', String(options.smartRowMatch !== false)],
    ['Total Changes', String(totalChanges)],
    ['Added', String(countsByType.ADDED)],
    ['Deleted', String(countsByType.DELETED)],
    ['Modified', String(countsByType.MODIFIED)],
    ['Formula Changes', String(countsByType.FORMULA_CHANGED)],
  ];

  const sheets = [
    { name: 'Summary', columns: [{ key: 'a', header: 'Property' }, { key: 'b', header: 'Value' }], rows: summaryRows.slice(1) },
    { name: 'All Changes', columns: csvColumns, rows: csvRows },
  ];

  const typeSheets = [
    { key: 'ADDED', name: 'Added', rows: csvRows.filter((r) => r.type === 'ADDED') },
    { key: 'DELETED', name: 'Deleted', rows: csvRows.filter((r) => r.type === 'DELETED') },
    { key: 'MODIFIED', name: 'Modified', rows: csvRows.filter((r) => r.type === 'MODIFIED') },
    { key: 'FORMULA_CHANGED', name: 'Formula Changes', rows: csvRows.filter((r) => r.type === 'FORMULA_CHANGED') },
  ];

  for (const ts of typeSheets) {
    if (ts.rows.length > 0) {
      sheets.push({ name: ts.name, columns: csvColumns, rows: ts.rows });
    }
  }

  const workbook = buildWorkbook(sheets);
  const xlsxFilename = buildFilename({ mode: 'changes', left: fileA, right: fileB, part: 'workbook', ext: 'xlsx' });

  return { csv: { content: csvContent, filename: csvFilename }, workbook, xlsxFilename };
}

/* ------------------------------------------------------------------ */
/* 2) Columns export                                                  */
/* ------------------------------------------------------------------ */

export function buildColumnsExport(result, ctx = {}) {
  const {
    fileA = 'File A',
    fileB = 'File B',
    sheetA = 'Sheet 1',
    sheetB = 'Sheet 1',
    columnA = 'Column A',
    columnB = 'Column B',
  } = ctx;

  const intersection = Array.isArray(result?.intersection) ? result.intersection : [];
  const onlyInLeft = Array.isArray(result?.onlyInLeft) ? result.onlyInLeft : [];
  const onlyInRight = Array.isArray(result?.onlyInRight) ? result.onlyInRight : [];
  const leftOccurrences = result?.leftOccurrences || new Map();
  const rightOccurrences = result?.rightOccurrences || new Map();
  const stats = result?.stats || {};

  const csvColumns = [
    { key: 'set', header: 'Result Set' },
    { key: 'value', header: 'Value' },
    { key: 'leftColumn', header: 'Left Column' },
    { key: 'rightColumn', header: 'Right Column' },
    { key: 'leftRows', header: 'Left Rows' },
    { key: 'rightRows', header: 'Right Rows' },
    { key: 'leftCount', header: 'Left Count' },
    { key: 'rightCount', header: 'Right Count' },
  ];

  const csvRows = [];
  for (const v of intersection) {
    csvRows.push({
      set: 'INTERSECTION',
      value: v,
      leftColumn: columnA,
      rightColumn: columnB,
      leftRows: joinRows(leftOccurrences.get(v)),
      rightRows: joinRows(rightOccurrences.get(v)),
      leftCount: (leftOccurrences.get(v) || []).length,
      rightCount: (rightOccurrences.get(v) || []).length,
    });
  }
  for (const v of onlyInLeft) {
    csvRows.push({
      set: 'ONLY_IN_LEFT',
      value: v,
      leftColumn: columnA,
      rightColumn: columnB,
      leftRows: joinRows(leftOccurrences.get(v)),
      rightRows: '',
      leftCount: (leftOccurrences.get(v) || []).length,
      rightCount: 0,
    });
  }
  for (const v of onlyInRight) {
    csvRows.push({
      set: 'ONLY_IN_RIGHT',
      value: v,
      leftColumn: columnA,
      rightColumn: columnB,
      leftRows: '',
      rightRows: joinRows(rightOccurrences.get(v)),
      leftCount: 0,
      rightCount: (rightOccurrences.get(v) || []).length,
    });
  }

  const csvContent = toCsv(csvColumns, csvRows);
  const csvFilename = buildFilename({
    mode: 'columns',
    left: fileA,
    right: fileB,
    part: 'column-compare',
    ext: 'csv',
  });

  const summaryRows = [
    ['Property', 'Value'],
    ['Tool', 'CompareExcel'],
    ['Generated At', new Date().toISOString()],
    ['Left File', fileA],
    ['Right File', fileB],
    ['Left Sheet', sheetA],
    ['Right Sheet', sheetB],
    ['Left Column', columnA],
    ['Right Column', columnB],
    ['Matching Rule', 'exact, case-sensitive, trimmed'],
    ['Unique Values Left', String(stats.totalA || 0)],
    ['Unique Values Right', String(stats.totalB || 0)],
    ['Intersection Count', String(stats.intersectionCount || 0)],
    ['Only in Left Count', String(stats.onlyInLeftCount || 0)],
    ['Only in Right Count', String(stats.onlyInRightCount || 0)],
    ['Blanks Skipped', String(stats.blankSkipped || 0)],
    ['Duplicate Values Left', String(stats.duplicateValuesA || 0)],
    ['Duplicate Values Right', String(stats.duplicateValuesB || 0)],
  ];

  const setRows = (label, list) =>
    list.map((v) => ({
      set: label,
      value: v,
      leftColumn: columnA,
      rightColumn: columnB,
      leftRows: joinRows(leftOccurrences.get(v)),
      rightRows: joinRows(rightOccurrences.get(v)),
      leftCount: (leftOccurrences.get(v) || []).length,
      rightCount: (rightOccurrences.get(v) || []).length,
    }));

  const sheets = [
    { name: 'Summary', columns: [{ key: 'a', header: 'Property' }, { key: 'b', header: 'Value' }], rows: summaryRows.slice(1) },
    { name: 'Intersection', columns: csvColumns, rows: setRows('INTERSECTION', intersection) },
  ];

  if (onlyInLeft.length > 0) {
    sheets.push({ name: 'Only in Left', columns: csvColumns, rows: setRows('ONLY_IN_LEFT', onlyInLeft) });
  }
  if (onlyInRight.length > 0) {
    sheets.push({ name: 'Only in Right', columns: csvColumns, rows: setRows('ONLY_IN_RIGHT', onlyInRight) });
  }

  const workbook = buildWorkbook(sheets);
  const xlsxFilename = buildFilename({ mode: 'columns', left: fileA, right: fileB, part: 'workbook', ext: 'xlsx' });

  return { csv: { content: csvContent, filename: csvFilename }, workbook, xlsxFilename };
}

/* ------------------------------------------------------------------ */
/* 3) Reconcile export                                                */
/* ------------------------------------------------------------------ */

export function buildReconcileExport(reconResult, ctx = {}) {
  const {
    fileA = 'File A',
    fileB = 'File B',
    sheetA = 'Sheet 1',
    sheetB = 'Sheet 1',
    keyColumn = 'Key Column',
    valueColumn = 'Value Column',
  } = ctx;

  const all = Array.isArray(reconResult?.all) ? reconResult.all : [];
  const stats = reconResult?.stats || {};

  const csvColumns = [
    { key: 'key', header: 'Key / ID' },
    { key: 'valA', header: 'Left Value' },
    { key: 'valB', header: 'Right Value' },
    { key: 'status', header: 'Status' },
    { key: 'difference', header: 'Difference' },
    { key: 'rowNumA', header: 'Left Row' },
    { key: 'rowNumB', header: 'Right Row' },
  ];

  const ordered = [...all].sort((a, b) => {
    const ao = RECON_STATUS_ORDER[RECON_STATUS_LABEL[a.status] ?? a.status] ?? 99;
    const bo = RECON_STATUS_ORDER[RECON_STATUS_LABEL[b.status] ?? b.status] ?? 99;
    if (ao !== bo) return ao - bo;
    const ka = String(a.key ?? '').toLocaleLowerCase();
    const kb = String(b.key ?? '').toLocaleLowerCase();
    return ka.localeCompare(kb);
  });

  const csvRows = ordered.map((r) => {
    const status = RECON_STATUS_LABEL[r.status] ?? r.status;
    const diff = (status === 'MISMATCH') ? difference(r.valA, r.valB) : '';
    return {
      key: r.key === undefined ? '' : r.key,
      valA: r.valA === undefined ? '' : r.valA,
      valB: r.valB === undefined ? '' : r.valB,
      status,
      difference: diff === '' ? '' : String(diff),
      rowNumA: r.rowNumA === null || r.rowNumA === undefined ? '' : r.rowNumA,
      rowNumB: r.rowNumB === null || r.rowNumB === undefined ? '' : r.rowNumB,
    };
  });

  const csvContent = toCsv(csvColumns, csvRows);
  const csvFilename = buildFilename({
    mode: 'reconcile',
    left: fileA,
    right: fileB,
    part: 'reconciliation',
    ext: 'csv',
  });

  const summaryRows = [
    ['Property', 'Value'],
    ['Tool', 'CompareExcel'],
    ['Generated At', new Date().toISOString()],
    ['Left File', fileA],
    ['Right File', fileB],
    ['Left Sheet', sheetA],
    ['Right Sheet', sheetB],
    ['Key Column', keyColumn],
    ['Value Column', valueColumn],
    ['Matching Rule', 'exact, case-sensitive, trimmed'],
    ['Total Rows Left', String(stats.totalRowsA || 0)],
    ['Total Rows Right', String(stats.totalRowsB || 0)],
    ['Total Keys', String(stats.totalKeys || 0)],
    ['Matches', String(stats.matchedCount || 0)],
    ['Mismatches', String(stats.mismatchedCount || 0)],
    ['Only in Left', String(stats.onlyACount || 0)],
    ['Only in Right', String(stats.onlyBCount || 0)],
    ['Duplicate Keys', String(stats.duplicateCount || 0)],
    ['Rows Skipped (Empty Key)', String(stats.skippedEmptyKey || 0)],
  ];

  const sheets = [
    { name: 'Summary', columns: [{ key: 'a', header: 'Property' }, { key: 'b', header: 'Value' }], rows: summaryRows.slice(1) },
    { name: 'Reconciliation', columns: csvColumns, rows: csvRows },
  ];

  const workbook = buildWorkbook(sheets);
  const xlsxFilename = buildFilename({ mode: 'reconcile', left: fileA, right: fileB, part: 'workbook', ext: 'xlsx' });

  return { csv: { content: csvContent, filename: csvFilename }, workbook, xlsxFilename };
}

/* ------------------------------------------------------------------ */
/* 4) Batch export                                                    */
/* ------------------------------------------------------------------ */

export function buildBatchExport(pairs) {
  const list = Array.isArray(pairs) ? pairs : [];

  const csvColumns = [
    { key: 'pair', header: 'Pair #' },
    { key: 'leftFile', header: 'Left File' },
    { key: 'rightFile', header: 'Right File' },
    { key: 'status', header: 'Status' },
    { key: 'totalChanges', header: 'Total Changes' },
    { key: 'added', header: 'Added' },
    { key: 'deleted', header: 'Deleted' },
    { key: 'modified', header: 'Modified' },
    { key: 'formulaChanges', header: 'Formula Changes' },
    { key: 'error', header: 'Error' },
  ];

  const csvRows = list.map((p, i) => {
    const s = p.result || {};
    return {
      pair: i + 1,
      leftFile: p.nameA || '',
      rightFile: p.nameB || '',
      status: p.status || 'PENDING',
      totalChanges: s.totalChanges || 0,
      added: s.totalAdded || 0,
      deleted: s.totalDeleted || 0,
      modified: s.totalModified || 0,
      formulaChanges: s.totalFormulaChanges || 0,
      error: p.status === 'ERROR' ? p.error || 'Comparison failed' : '',
    };
  });

  const csvContent = toCsv(csvColumns, csvRows);
  const ts = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const timestamp = `${ts.getFullYear()}${pad(ts.getMonth() + 1)}${pad(ts.getDate())}-${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}`;
  const csvFilename = `compareexcel_batch_${timestamp}.csv`;

  const summaryRows = [
    ['Property', 'Value'],
    ['Tool', 'CompareExcel'],
    ['Generated At', new Date().toISOString()],
    ['Total Pairs', String(list.length)],
    ['Completed', String(list.filter((p) => p.status === 'DONE').length)],
    ['Errors', String(list.filter((p) => p.status === 'ERROR').length)],
  ];

  const sheets = [
    { name: 'Summary', columns: [{ key: 'a', header: 'Property' }, { key: 'b', header: 'Value' }], rows: summaryRows.slice(1) },
    { name: 'Batch Summary', columns: csvColumns, rows: csvRows },
  ];

  const workbook = buildWorkbook(sheets);
  const xlsxFilename = `compareexcel_batch_${timestamp}.xlsx`;

  return { csv: { content: csvContent, filename: csvFilename }, workbook, xlsxFilename };
}
