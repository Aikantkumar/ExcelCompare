/**
 * High performance cell-by-cell diff engine with Diffchecker options:
 * - Character & Word level diffing
 * - Column matching by headers
 * - Whitespace & Case sensitivity toggles
 * - US & EU date normalization
 * - Granular changes audit list (C2, H2, etc.)
 */

export function compareSheets(sheetA, sheetB, options = {}) {
  const {
    compareFormulas = true,
    smartRowMatch = true,
    diffGranularity = 'smart', // 'smart' | 'word' | 'char'
    matchColumnsByHeaders = false,
    ignoreWhitespace = false,
    ignoreCase = false,
    hideUnchangedRows = false,
    hideUnchangedColumns = false,
    normalizeDatesUS = false,
    normalizeDatesEU = false,
    sortRows = 'none',
  } = options;

  let rawRowsA = sheetA?.rows ? JSON.parse(JSON.stringify(sheetA.rows)) : [];
  let rawRowsB = sheetB?.rows ? JSON.parse(JSON.stringify(sheetB.rows)) : [];

  // 1. Optional Column Sorting & Header Matching
  let colMappingB = null;
  if (matchColumnsByHeaders && rawRowsA.length > 0 && rawRowsB.length > 0) {
    const headersA = rawRowsA[0].map(c => String(c.val || '').trim().toLowerCase());
    const headersB = rawRowsB[0].map(c => String(c.val || '').trim().toLowerCase());

    colMappingB = headersA.map(h => headersB.indexOf(h));
  }

  // Apply row sorting if requested
  if (sortRows && sortRows.startsWith('col')) {
    const colIdx = parseInt(sortRows.replace('col', ''), 10);
    if (!isNaN(colIdx)) {
      rawRowsA = sortRowsByCol(rawRowsA, colIdx);
      rawRowsB = sortRowsByCol(rawRowsB, colIdx);
    }
  }

  const maxCols = Math.max(
    sheetA?.colCount || (rawRowsA[0] ? rawRowsA[0].length : 0),
    sheetB?.colCount || (rawRowsB[0] ? rawRowsB[0].length : 0)
  );

  // 2. Row Alignment
  const mappedRows = smartRowMatch 
    ? alignRowsSmart(rawRowsA, rawRowsB)
    : alignRowsSequential(rawRowsA, rawRowsB);

  let totalChanges = 0;
  let totalAdded = 0;
  let totalDeleted = 0;
  let totalModified = 0;
  let totalFormulaChanges = 0;
  const changesList = [];
  let changeCounter = 0;

  let diffRows = mappedRows.map((pair, rowIndex) => {
    const rowA = pair.rowA;
    let rowB = pair.rowB;

    if (colMappingB && rowB) {
      rowB = remapRowCols(rowB, colMappingB, maxCols);
    }

    if (!rowA && rowB) {
      totalAdded++;
      const cellsB = padRow(rowB, maxCols);
      cellsB.forEach((cell, colIdx) => {
        if (cell.val) {
          changeCounter++;
          const colLetter = getColumnLetter(colIdx);
          const cellRef = `${colLetter}${pair.origIndexB !== null ? pair.origIndexB + 1 : rowIndex + 1}`;
          changesList.push({
            id: changeCounter,
            type: 'ADDED',
            cellRef,
            rowIdx: rowIndex,
            colIdx,
            valA: '',
            valB: cell.val,
            formulaA: '',
            formulaB: cell.formula || '',
            charDiff: computeCharDiff('', cell.val, diffGranularity),
          });
        }
      });

      return {
        type: 'ADDED',
        indexA: null,
        indexB: pair.origIndexB,
        cellsA: Array(maxCols).fill({ val: '', type: 'empty' }),
        cellsB,
        cellStatuses: Array(maxCols).fill('ADDED'),
      };
    }

    if (rowA && !rowB) {
      totalDeleted++;
      const cellsA = padRow(rowA, maxCols);
      cellsA.forEach((cell, colIdx) => {
        if (cell.val) {
          changeCounter++;
          const colLetter = getColumnLetter(colIdx);
          const cellRef = `${colLetter}${pair.origIndexA !== null ? pair.origIndexA + 1 : rowIndex + 1}`;
          changesList.push({
            id: changeCounter,
            type: 'DELETED',
            cellRef,
            rowIdx: rowIndex,
            colIdx,
            valA: cell.val,
            valB: '',
            formulaA: cell.formula || '',
            formulaB: '',
            charDiff: computeCharDiff(cell.val, '', diffGranularity),
          });
        }
      });

      return {
        type: 'DELETED',
        indexA: pair.origIndexA,
        indexB: null,
        cellsA,
        cellsB: Array(maxCols).fill({ val: '', type: 'empty' }),
        cellStatuses: Array(maxCols).fill('DELETED'),
      };
    }

    // Both rowA and rowB exist - compare cell by cell
    const cellsA = padRow(rowA, maxCols);
    const cellsB = padRow(rowB, maxCols);
    const cellStatuses = [];
    let rowHasChanges = false;

    for (let c = 0; c < maxCols; c++) {
      const cellA = cellsA[c] || { val: '', formula: '' };
      const cellB = cellsB[c] || { val: '', formula: '' };

      let valA = String(cellA.val || '');
      let valB = String(cellB.val || '');

      // Apply date normalizations
      if (normalizeDatesUS) {
        valA = normalizeDate(valA, 'US');
        valB = normalizeDate(valB, 'US');
      } else if (normalizeDatesEU) {
        valA = normalizeDate(valA, 'EU');
        valB = normalizeDate(valB, 'EU');
      }

      // Apply case & whitespace normalization for matching comparison
      let cleanValA = valA;
      let cleanValB = valB;
      if (ignoreWhitespace) {
        cleanValA = cleanValA.replace(/\s+/g, ' ').trim();
        cleanValB = cleanValB.replace(/\s+/g, ' ').trim();
      } else {
        cleanValA = cleanValA.trim();
        cleanValB = cleanValB.trim();
      }

      if (ignoreCase) {
        cleanValA = cleanValA.toLowerCase();
        cleanValB = cleanValB.toLowerCase();
      }

      const formA = String(cellA.formula || '').trim();
      const formB = String(cellB.formula || '').trim();

      let status = 'SAME';

      if (compareFormulas && (formA || formB) && formA !== formB) {
        status = 'FORMULA_CHANGED';
        totalFormulaChanges++;
        rowHasChanges = true;

        changeCounter++;
        const colLetter = getColumnLetter(c);
        const cellRef = `${colLetter}${(pair.origIndexB ?? pair.origIndexA ?? rowIndex) + 1}`;
        changesList.push({
          id: changeCounter,
          type: 'FORMULA_CHANGED',
          cellRef,
          rowIdx: rowIndex,
          colIdx: c,
          valA,
          valB,
          formulaA: formA,
          formulaB: formB,
          charDiff: computeCharDiff(formA || valA, formB || valB, diffGranularity),
        });
      } else if (cleanValA !== cleanValB) {
        status = 'MODIFIED';
        totalModified++;
        rowHasChanges = true;

        changeCounter++;
        const colLetter = getColumnLetter(c);
        const cellRef = `${colLetter}${(pair.origIndexB ?? pair.origIndexA ?? rowIndex) + 1}`;
        changesList.push({
          id: changeCounter,
          type: 'MODIFIED',
          cellRef,
          rowIdx: rowIndex,
          colIdx: c,
          valA,
          valB,
          formulaA: formA,
          formulaB: formB,
          charDiff: computeCharDiff(valA, valB, diffGranularity),
        });
      }

      cellStatuses.push(status);
    }

    if (rowHasChanges) totalChanges++;

    return {
      type: rowHasChanges ? 'MODIFIED' : 'SAME',
      indexA: pair.origIndexA,
      indexB: pair.origIndexB,
      cellsA,
      cellsB,
      cellStatuses,
    };
  });

  // Filter unchanged rows if requested
  if (hideUnchangedRows) {
    diffRows = diffRows.filter(r => r.type !== 'SAME');
  }

  // Filter unchanged columns if requested
  let activeColIndices = Array.from({ length: maxCols }, (_, i) => i);
  if (hideUnchangedColumns) {
    const changedCols = new Set();
    diffRows.forEach(row => {
      row.cellStatuses?.forEach((st, colIdx) => {
        if (st !== 'SAME') changedCols.add(colIdx);
      });
    });
    if (changedCols.size > 0) {
      activeColIndices = Array.from(changedCols).sort((a, b) => a - b);
    }
  }

  return {
    rows: diffRows,
    changesList,
    activeColIndices,
    stats: {
      totalRows: diffRows.length,
      totalChanges: changesList.length,
      totalAdded,
      totalDeleted,
      totalModified,
      totalFormulaChanges,
      maxCols,
    },
  };
}

export function getColumnLetter(colIndex) {
  let temp;
  let letter = '';
  let col = colIndex + 1;
  while (col > 0) {
    temp = (col - 1) % 26;
    letter = String.fromCharCode(65 + temp) + letter;
    col = (col - temp - 1) / 26;
  }
  return letter;
}

export function computeCharDiff(textA, textB, granularity = 'char') {
  const sA = String(textA ?? '');
  const sB = String(textB ?? '');

  if (sA === sB) return [{ type: 'same', text: sA }];
  if (!sA) return [{ type: 'add', text: sB }];
  if (!sB) return [{ type: 'del', text: sA }];

  const tokensA = granularity === 'char' ? sA.split('') : sA.split(/(\s+)/);
  const tokensB = granularity === 'char' ? sB.split('') : sB.split(/(\s+)/);

  return diffArrays(tokensA, tokensB);
}

function diffArrays(arrA, arrB) {
  const N = arrA.length;
  const M = arrB.length;

  if (N > 150 || M > 150) {
    return [
      { type: 'del', text: arrA.join('') },
      { type: 'add', text: arrB.join('') }
    ];
  }

  const L = Array.from({ length: N + 1 }, () => Array(M + 1).fill(0));

  for (let i = N - 1; i >= 0; i--) {
    for (let j = M - 1; j >= 0; j--) {
      if (arrA[i] === arrB[j]) {
        L[i][j] = 1 + L[i + 1][j + 1];
      } else {
        L[i][j] = Math.max(L[i + 1][j], L[i][j + 1]);
      }
    }
  }

  const result = [];
  let i = 0, j = 0;
  while (i < N && j < M) {
    if (arrA[i] === arrB[j]) {
      if (result.length > 0 && result[result.length - 1].type === 'same') {
        result[result.length - 1].text += arrA[i];
      } else {
        result.push({ type: 'same', text: arrA[i] });
      }
      i++;
      j++;
    } else if (L[i + 1][j] >= L[i][j + 1]) {
      if (result.length > 0 && result[result.length - 1].type === 'del') {
        result[result.length - 1].text += arrA[i];
      } else {
        result.push({ type: 'del', text: arrA[i] });
      }
      i++;
    } else {
      if (result.length > 0 && result[result.length - 1].type === 'add') {
        result[result.length - 1].text += arrB[j];
      } else {
        result.push({ type: 'add', text: arrB[j] });
      }
      j++;
    }
  }
  while (i < N) {
    if (result.length > 0 && result[result.length - 1].type === 'del') {
      result[result.length - 1].text += arrA[i];
    } else {
      result.push({ type: 'del', text: arrA[i] });
    }
    i++;
  }
  while (j < M) {
    if (result.length > 0 && result[result.length - 1].type === 'add') {
      result[result.length - 1].text += arrB[j];
    } else {
      result.push({ type: 'add', text: arrB[j] });
    }
    j++;
  }
  return result;
}

export function normalizeDate(val, format = 'US') {
  if (!val) return val;
  const str = String(val).trim();
  const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    const mm = m.padStart(2, '0');
    const dd = d.padStart(2, '0');
    return format === 'US' ? `${mm}/${dd}/${y}` : `${dd}/${mm}/${y}`;
  }
  const slashMatch = str.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (slashMatch) {
    const [, p1, p2, year] = slashMatch;
    const y = year.length === 2 ? `20${year}` : year;
    const m = p1.padStart(2, '0');
    const d = p2.padStart(2, '0');
    return format === 'US' ? `${m}/${d}/${y}` : `${d}/${m}/${y}`;
  }
  return str;
}

function remapRowCols(row, mapping, maxCols) {
  const newRow = Array(maxCols).fill({ val: '', formula: '', type: 'empty' });
  row.forEach((cell, origIdx) => {
    const targetIdx = mapping[origIdx];
    if (targetIdx !== -1 && targetIdx < maxCols) {
      newRow[targetIdx] = cell;
    }
  });
  return newRow;
}

function sortRowsByCol(rows, colIdx) {
  if (rows.length <= 1) return rows;
  const header = rows[0];
  const body = rows.slice(1);
  body.sort((a, b) => {
    const valA = String(a[colIdx]?.val || '').toLowerCase();
    const valB = String(b[colIdx]?.val || '').toLowerCase();
    return valA.localeCompare(valB, undefined, { numeric: true });
  });
  return [header, ...body];
}

function alignRowsSequential(rowsA, rowsB) {
  const maxRows = Math.max(rowsA.length, rowsB.length);
  const result = [];
  for (let i = 0; i < maxRows; i++) {
    result.push({
      rowA: rowsA[i] || null,
      rowB: rowsB[i] || null,
      origIndexA: i < rowsA.length ? i : null,
      origIndexB: i < rowsB.length ? i : null,
    });
  }
  return result;
}

function alignRowsSmart(rowsA, rowsB) {
  const result = [];
  const usedB = new Set();

  const hashBMap = new Map();
  rowsB.forEach((row, bIdx) => {
    const h = getRowHash(row);
    if (!hashBMap.has(h)) hashBMap.set(h, []);
    hashBMap.get(h).push(bIdx);
  });

  for (let aIdx = 0; aIdx < rowsA.length; aIdx++) {
    const rowA = rowsA[aIdx];
    const hA = getRowHash(rowA);

    if (hashBMap.has(hA) && hashBMap.get(hA).length > 0) {
      const candidateList = hashBMap.get(hA);
      let bestBIdx = candidateList[0];
      let minDistance = Math.abs(bestBIdx - aIdx);

      for (const candidateB of candidateList) {
        if (!usedB.has(candidateB)) {
          const dist = Math.abs(candidateB - aIdx);
          if (dist < minDistance) {
            minDistance = dist;
            bestBIdx = candidateB;
          }
        }
      }

      if (!usedB.has(bestBIdx)) {
        usedB.add(bestBIdx);
        result.push({
          rowA,
          rowB: rowsB[bestBIdx],
          origIndexA: aIdx,
          origIndexB: bestBIdx,
        });
        continue;
      }
    }

    if (aIdx < rowsB.length && !usedB.has(aIdx)) {
      usedB.add(aIdx);
      result.push({
        rowA,
        rowB: rowsB[aIdx],
        origIndexA: aIdx,
        origIndexB: aIdx,
      });
    } else {
      result.push({
        rowA,
        rowB: null,
        origIndexA: aIdx,
        origIndexB: null,
      });
    }
  }

  for (let bIdx = 0; bIdx < rowsB.length; bIdx++) {
    if (!usedB.has(bIdx)) {
      result.push({
        rowA: null,
        rowB: rowsB[bIdx],
        origIndexA: null,
        origIndexB: bIdx,
      });
    }
  }

  return result;
}

function getRowHash(row) {
  if (!row || !Array.isArray(row)) return '';
  return row.map((c) => String(c.val || '').trim()).join('||');
}

function padRow(row, length) {
  const newRow = [...row];
  while (newRow.length < length) {
    newRow.push({ val: '', formula: '', type: 'empty' });
  }
  return newRow;
}

export function compareColumns(colAValues, colBValues) {
  const setA = new Set(colAValues.map((v) => String(v).trim()).filter(Boolean));
  const setB = new Set(colBValues.map((v) => String(v).trim()).filter(Boolean));

  const intersection = [];
  const onlyInA = [];
  const onlyInB = [];

  setA.forEach((val) => {
    if (setB.has(val)) {
      intersection.push(val);
    } else {
      onlyInA.push(val);
    }
  });

  setB.forEach((val) => {
    if (!setA.has(val)) {
      onlyInB.push(val);
    }
  });

  return {
    intersection,
    onlyInA,
    onlyInB,
    stats: {
      totalA: setA.size,
      totalB: setB.size,
      intersectionCount: intersection.length,
      onlyInACount: onlyInA.length,
      onlyInBCount: onlyInB.length,
    },
  };
}

export function reconcileSheets(sheetA, sheetB, keyColIdx = 0, valColIdx = 1) {
  const rowsA = sheetA?.rows || [];
  const rowsB = sheetB?.rows || [];

  const mapA = new Map();
  rowsA.slice(1).forEach((row, idx) => {
    const key = String(row[keyColIdx]?.val || '').trim();
    const val = String(row[valColIdx]?.val || '').trim();
    if (key) mapA.set(key, { key, val, rowIdx: idx + 1, row });
  });

  const mapB = new Map();
  rowsB.slice(1).forEach((row, idx) => {
    const key = String(row[keyColIdx]?.val || '').trim();
    const val = String(row[valColIdx]?.val || '').trim();
    if (key) mapB.set(key, { key, val, rowIdx: idx + 1, row });
  });

  const matched = [];
  const mismatched = [];
  const onlyA = [];
  const onlyB = [];

  mapA.forEach((itemA, key) => {
    if (mapB.has(key)) {
      const itemB = mapB.get(key);
      if (itemA.val === itemB.val) {
        matched.push({ key, valA: itemA.val, valB: itemB.val, status: 'MATCH' });
      } else {
        mismatched.push({ key, valA: itemA.val, valB: itemB.val, status: 'MISMATCH' });
      }
    } else {
      onlyA.push({ key, valA: itemA.val, valB: '-', status: 'ONLY_LEFT' });
    }
  });

  mapB.forEach((itemB, key) => {
    if (!mapA.has(key)) {
      onlyB.push({ key, valA: '-', valB: itemB.val, status: 'ONLY_RIGHT' });
    }
  });

  return {
    matched,
    mismatched,
    onlyA,
    onlyB,
    all: [...mismatched, ...onlyA, ...onlyB, ...matched],
    stats: {
      matchedCount: matched.length,
      mismatchedCount: mismatched.length,
      onlyACount: onlyA.length,
      onlyBCount: onlyB.length,
      totalKeys: mapA.size + mapB.size - matched.length - mismatched.length,
    },
  };
}
