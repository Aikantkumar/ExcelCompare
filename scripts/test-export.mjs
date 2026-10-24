import assert from 'node:assert';
import {
  csvEscape,
  sanitizeForCsv,
  toCsv,
  buildFilename,
  buildWorkbook,
} from '../src/components/comparison/exportUtils.js';
import {
  buildChangesExport,
  buildColumnsExport,
  buildReconcileExport,
  buildBatchExport,
} from '../src/components/comparison/exportBuilders.js';
import {
  compareColumns,
  compareColumnsDetailed,
} from '../src/components/comparison/diffEngine.js';

let passed = 0;
const ok = (name) => { passed++; console.log(`PASS: ${name}`); };

// ---- csvEscape ----
assert.strictEqual(csvEscape('a,b'), '"a,b"', 'comma quoted');
assert.strictEqual(csvEscape('say "hi"'), '"say ""hi"""', 'inner quotes doubled');
assert.strictEqual(csvEscape('line1\nline2'), '"line1\nline2"', 'LF quoted');
assert.strictEqual(csvEscape('line1\rline2'), '"line1\rline2"', 'CR quoted');
assert.strictEqual(csvEscape(0), '0', 'numeric 0 kept');
assert.strictEqual(csvEscape('0'), '0', 'string 0 kept');
assert.strictEqual(csvEscape(null), '', 'null becomes empty');
assert.strictEqual(csvEscape(undefined), '', 'undefined becomes empty');
assert.strictEqual(csvEscape('plain'), 'plain', 'plain unquoted');
ok('csvEscape');

// ---- toCsv: BOM, CRLF, # preserved ----
const cols = [{ key: 'a', header: 'Col A' }, { key: 'b', header: 'Col B' }];
const rows = [{ a: 'x#y', b: 'z' }, { a: '0', b: '' }];
const csv = toCsv(cols, rows);
assert.ok(csv.startsWith('\uFEFF'), 'BOM present');
assert.ok(csv.includes('\r\n'), 'CRLF line endings');
assert.ok(csv.includes('x#y'), '# preserved (not truncated)');
assert.ok(csv.endsWith('\r\n'), 'trailing CRLF');
ok('toCsv BOM/CRLF/#');

// ---- sanitizeForCsv (CSV only) ----
assert.strictEqual(sanitizeForCsv('=1+1'), "'=1+1", 'equals prefixed');
assert.strictEqual(sanitizeForCsv('+1'), "'+1", 'plus prefixed');
assert.strictEqual(sanitizeForCsv('@1'), "'@1", 'at prefixed');
assert.strictEqual(sanitizeForCsv('\tfoo'), "'\tfoo", 'tab prefixed');
assert.strictEqual(sanitizeForCsv('-foo'), "'-foo", 'dash-nondigit prefixed');
assert.strictEqual(sanitizeForCsv('-1.5'), '-1.5', 'dash-number not prefixed');
assert.strictEqual(sanitizeForCsv('0'), '0', 'zero not prefixed');
assert.strictEqual(sanitizeForCsv('normal'), 'normal', 'normal unchanged');
ok('sanitizeForCsv');

// ---- buildFilename ----
const fn = buildFilename({ mode: 'changes', left: 'Register V1.xlsx', right: 'Financial Q3, Report!.xls', part: 'all-changes', ext: 'csv' });
assert.ok(fn.startsWith('compareexcel_changes_all-changes_'), 'prefix');
assert.ok(fn.endsWith('.csv'), 'ext');
assert.ok(!/[\[\]:*?\\/]/.test(fn.split('_vs_')[1]), 'no invalid right-chars');
// extension stripped
assert.ok(!fn.includes('.xlsx'), 'left extension stripped');
assert.ok(!fn.includes('.xls'), 'right extension stripped');
// special chars replaced
assert.ok(!/[,!]/.test(fn), 'special chars replaced');
// length cap
const long = buildFilename({ mode: 'changes', left: 'A'.repeat(100), right: 'B', ext: 'csv' });
const leftPart = long.split('_vs_')[0];
assert.ok(leftPart.length <= 'compareexcel_changes_'.length + 40, 'left name capped');
ok('buildFilename');

// ---- buildChangesExport: ordering + row numbers ----
const changes = [
  { id: 3, type: 'MODIFIED', cellRef: 'B2', rowIdx: 1, colIdx: 1, valA: '1', valB: '2', formulaA: '', formulaB: '', rowNumA: 2, rowNumB: 2, header: 'B', colIdx: 1 },
  { id: 1, type: 'ADDED', cellRef: 'A5', rowIdx: 4, colIdx: 0, valA: '', valB: 'new', formulaA: '', formulaB: '', rowNumA: null, rowNumB: 5, header: 'A', colIdx: 0 },
  { id: 2, type: 'DELETED', cellRef: 'C1', rowIdx: 0, colIdx: 2, valA: 'old', valB: '', formulaA: '', formulaB: '', rowNumA: 1, rowNumB: null, header: 'C', colIdx: 2 },
  { id: 4, type: 'FORMULA_CHANGED', cellRef: 'A1', rowIdx: 0, colIdx: 0, valA: '1', valB: '1', formulaA: '=A1', formulaB: '=B1', rowNumA: 1, rowNumB: 1, header: 'A', colIdx: 0 },
];
const diffData = { changesList: changes, stats: { totalChanges: 4 } };
const ch = buildChangesExport(diffData, { fileA: 'A.xlsx', fileB: 'B.xlsx', sheetA: 'S1', sheetB: 'S1' });
const lines = ch.csv.content.split('\r\n').filter(Boolean);
// header + 4 rows
assert.strictEqual(lines.length, 5, 'all 4 changes exported (header + 4 rows)');
const header = lines[0];
assert.ok(header.includes('Change ID'), 'Change ID column');
assert.ok(header.includes('Change Type'), 'Change Type column');
assert.ok(header.includes('Row (Left)'), 'Row (Left) column');
assert.ok(header.includes('Row (Right)'), 'Row (Right) column');
assert.ok(header.includes('Column Header'), 'Column Header column');
assert.ok(header.includes('Note'), 'Note column');
// verify sorting: min(rowNumA,rowNumB) asc => id4 (min1), id2 (min1), id1 (min5), id3 (min2)
// min1 group: id4(col0), id2(col2) -> col asc: id4 then id2; then id3(min2); then id1(min5)
const order = lines.slice(1).map((l) => l.split(',')[0]);
assert.deepStrictEqual(order, ['4', '2', '3', '1'], 'sort order by min row then col then type');
ok('buildChangesExport ordering + row numbers');

// ---- buildColumnsExport counts match compareColumns; numeric 0 kept; duplicates ----
const valuesA = ['a', 0, 'b', 'a', ''];
const valuesB = ['a', 0, 'c'];
const rowsA = [{ cells: [] }]; // header row
const sheetA = { rows: [ [{ val: 'Col' } ], [{ val: 'a' }], [{ val: 0 }], [{ val: 'b' }], [{ val: 'a' }], [{ val: '' }] ] };
const sheetB = { rows: [ [{ val: 'Col' } ], [{ val: 'a' }], [{ val: 0 }], [{ val: 'c' }] ] };
const detailed = compareColumnsDetailed(sheetA.rows, 0, sheetB.rows, 0);
// numeric 0 kept (not skipped)
assert.ok(detailed.intersection.includes('0'), 'numeric 0 kept in intersection');
assert.ok(detailed.order.includes('0'), 'numeric 0 in first-appearance order');
// counts match compareColumns (non-empty values)
const cc = compareColumns(['a', 0, 'b', 'a'], ['a', 0, 'c']);
assert.strictEqual(detailed.stats.intersectionCount, cc.stats.intersectionCount, 'intersection count matches compareColumns');
assert.strictEqual(detailed.stats.onlyInLeftCount, cc.stats.onlyInACount, 'only-in-left count matches compareColumns');
assert.strictEqual(detailed.stats.onlyInRightCount, cc.stats.onlyInBCount, 'only-in-right count matches compareColumns');
// duplicates counted: 'a' appears twice on left
assert.strictEqual(detailed.stats.duplicateValuesA, 1, 'duplicate value counted on left');
assert.strictEqual(detailed.stats.blankSkipped, 1, 'blank skipped counted (left empty)');

const colExport = buildColumnsExport(detailed, { fileA: 'A', fileB: 'B', columnA: 'Col', columnB: 'Col' });
const cl = colExport.csv.content.split('\r\n').filter(Boolean);
assert.ok(cl.length >= 2, 'columns csv has header + rows');
const sets = cl.slice(1).map((l) => l.split(',')[0]);
assert.ok(sets.includes('INTERSECTION'), 'INTERSECTION set present');
assert.ok(sets.includes('ONLY_IN_LEFT'), 'ONLY_IN_LEFT set present');
assert.ok(sets.includes('ONLY_IN_RIGHT'), 'ONLY_IN_RIGHT set present');
ok('buildColumnsExport counts + 0 + duplicates');

// ---- buildReconcileExport ----
const recon = {
  all: [
    { key: 'K1', valA: '10', valB: '12', status: 'MISMATCH', rowNumA: 2, rowNumB: 2 },
    { key: 'K2', valA: '5', valB: '-', status: 'ONLY_LEFT', rowNumA: 3, rowNumB: null },
    { key: 'K3', valA: '-', valB: '7', status: 'ONLY_RIGHT', rowNumA: null, rowNumB: 4 },
    { key: 'K4', valA: '9', valB: '9', status: 'MATCH', rowNumA: 5, rowNumB: 5 },
    { key: 'K5', valA: '1', valB: '2', status: 'DUPLICATE_KEY', rowNumA: null, rowNumB: null },
  ],
  stats: { matchedCount: 1, mismatchedCount: 1, onlyACount: 1, onlyBCount: 1, duplicateCount: 1, totalKeys: 5, totalRowsA: 6, totalRowsB: 6 },
};
const rec = buildReconcileExport(recon, { fileA: 'A', fileB: 'B' });
const rl = rec.csv.content.split('\r\n').filter(Boolean);
assert.strictEqual(rl.length, 6, 'reconcile header + 5 rows');
const statuses = rl.slice(1).map((l) => l.split(',')[3]);
assert.deepStrictEqual(statuses, ['MISMATCH', 'LEFT_ONLY', 'RIGHT_ONLY', 'DUPLICATE_KEY', 'MATCH'], 'reconcile status order');
// difference only for MISMATCH numeric
const mismatchRow = rl[1].split(',');
assert.ok(mismatchRow[4] !== '', 'difference present for numeric mismatch');
ok('buildReconcileExport');

// ---- buildBatchExport ----
const pairs = [
  { id: 1, nameA: 'A.xlsx', nameB: 'B.xlsx', status: 'DONE', result: { totalChanges: 3, totalAdded: 1, totalDeleted: 1, totalModified: 1, totalFormulaChanges: 0 } },
  { id: 2, nameA: 'C', nameB: 'D', status: 'ERROR', error: 'boom' },
];
const bat = buildBatchExport(pairs);
const bl = bat.csv.content.split('\r\n').filter(Boolean);
assert.ok(bl.length === 3, 'batch header + 2 rows');
assert.ok(bl.some((r) => r.includes('ERROR')), 'error row present');
ok('buildBatchExport');

// ---- buildWorkbook runs (xlsx cells as strings) ----
const wb = buildWorkbook([{ name: 'S1', columns: [{ key: 'a', header: 'H' }], rows: [{ a: '00123' }] }]);
assert.ok(wb.SheetNames.length === 1, 'workbook has sheet');
const ws = wb.Sheets[wb.SheetNames[0]];
const cell = ws['A2'];
assert.strictEqual(cell.t, 's', 'cell typed as string');
assert.strictEqual(cell.v, '00123', 'leading zeros preserved');
ok('buildWorkbook string-typed cells');

console.log(`\nAll ${passed} export tests passed.`);
