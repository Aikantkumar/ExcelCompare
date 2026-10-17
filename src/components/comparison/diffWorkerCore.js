/**
 * Pure diff logic extracted from diffEngine.js for Web Worker usage.
 * No DOM dependencies, pure computation.
 */

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
  const newRow = Array.isArray(row) ? [...row] : [];
  while (newRow.length < length) {
    newRow.push({ val: '', formula: '', type: 'empty' });
  }
  return newRow;
}

/**
 * Core comparison function - returns full result (for backward compatibility)
 */
export function compareSheetsCore(sheetA, sheetB, options = {}) {
  const {
    compareFormulas = true,
    smartRowMatch = true,
    diffGranularity = 'smart',
    matchColumnsByHeaders = false,
    ignoreWhitespace = false,
    ignoreCase = false,
    hideUnchangedRows = false,
    hideUnchangedColumns = false,
    normalizeDatesUS = false,
    normalizeDatesEU = false,
    sortRows = 'none',
  } = options;

  let rawRowsA = Array.isArray(sheetA?.rows) ? sheetA.rows.map(row => Array.isArray(row) ? [...row] : []) : [];
  let rawRowsB = Array.isArray(sheetB?.rows) ? sheetB.rows.map(row => Array.isArray(row) ? [...row] : []) : [];

  let colMappingB = null;
  if (matchColumnsByHeaders && rawRowsA.length > 0 && rawRowsB.length > 0) {
    const headersA = rawRowsA[0].map(c => String(c.val || '').trim().toLowerCase());
    const headersB = rawRowsB[0].map(c => String(c.val || '').trim().toLowerCase());
    colMappingB = headersA.map(h => headersB.indexOf(h));
  }

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

    if (colMappingB && rowB && Array.isArray(rowB)) {
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

    const cellsA = padRow(rowA, maxCols);
    const cellsB = padRow(rowB, maxCols);
    const cellStatuses = [];
    let rowHasChanges = false;

    for (let c = 0; c < maxCols; c++) {
      const cellA = cellsA[c] || { val: '', formula: '' };
      const cellB = cellsB[c] || { val: '', formula: '' };

      let valA = String(cellA.val || '');
      let valB = String(cellB.val || '');

      if (normalizeDatesUS) {
        valA = normalizeDate(valA, 'US');
        valB = normalizeDate(valB, 'US');
      } else if (normalizeDatesEU) {
        valA = normalizeDate(valA, 'EU');
        valB = normalizeDate(valB, 'EU');
      }

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

  const { collapseUnchangedBlocks = false } = options;

  if (collapseUnchangedBlocks && !hideUnchangedRows) {
    const collapsedResult = [];
    let currentUnchangedBlock = [];

    diffRows.forEach((row) => {
      if (row.type === 'SAME') {
        currentUnchangedBlock.push(row);
      } else {
        if (currentUnchangedBlock.length > 0) {
          if (currentUnchangedBlock.length >= 3) {
            collapsedResult.push({
              type: 'COLLAPSED',
              count: currentUnchangedBlock.length,
              hiddenRows: currentUnchangedBlock,
              startIdxA: currentUnchangedBlock[0].indexA,
              startIdxB: currentUnchangedBlock[0].indexB,
              endIdxA: currentUnchangedBlock[currentUnchangedBlock.length - 1].indexA,
              endIdxB: currentUnchangedBlock[currentUnchangedBlock.length - 1].indexB,
            });
          } else {
            collapsedResult.push(...currentUnchangedBlock);
          }
          currentUnchangedBlock = [];
        }
        collapsedResult.push(row);
      }
    });

    if (currentUnchangedBlock.length > 0) {
      if (currentUnchangedBlock.length >= 3) {
        collapsedResult.push({
          type: 'COLLAPSED',
          count: currentUnchangedBlock.length,
          hiddenRows: currentUnchangedBlock,
          startIdxA: currentUnchangedBlock[0].indexA,
          startIdxB: currentUnchangedBlock[0].indexB,
          endIdxA: currentUnchangedBlock[currentUnchangedBlock.length - 1].indexA,
          endIdxB: currentUnchangedBlock[currentUnchangedBlock.length - 1].indexB,
        });
      } else {
        collapsedResult.push(...currentUnchangedBlock);
      }
    }

    diffRows = collapsedResult;
  } else if (hideUnchangedRows) {
    diffRows = diffRows.filter(r => r.type !== 'SAME');
  }

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

/**
 * Compress result for worker transfer - index-based payload
 */
export function compressResult(result) {
  const { rows, changesList, activeColIndices, stats } = result;

  return {
    rows: rows.map(r => {
      if (r.type === 'COLLAPSED') {
        return {
          type: 'COLLAPSED',
          count: r.count,
          startIdxA: r.startIdxA,
          startIdxB: r.startIdxB,
          endIdxA: r.endIdxA,
          endIdxB: r.endIdxB,
          hiddenRows: r.hiddenRows,
        };
      }
      return {
        type: r.type,
        indexA: r.indexA,
        indexB: r.indexB,
        cellsA: r.cellsA,
        cellsB: r.cellsB,
        cellStatuses: r.cellStatuses,
        changes: r.cellStatuses
          ? r.cellStatuses
              .map((status, c) => status !== 'SAME' ? {
                c,
                status,
                valA: r.cellsA?.[c]?.val,
                valB: r.cellsB?.[c]?.val,
                formulaA: r.cellsA?.[c]?.formula,
                formulaB: r.cellsB?.[c]?.formula,
              } : null)
              .filter(Boolean)
          : []
      };
    }),
    changesList: changesList.map(c => ({
      id: c.id,
      type: c.type,
      cellRef: c.cellRef,
      rowIdx: c.rowIdx,
      colIdx: c.colIdx,
      valA: c.valA,
      valB: c.valB,
      formulaA: c.formulaA,
      formulaB: c.formulaB,
      charDiff: c.charDiff,
    })),
    activeColIndices,
    stats,
  };
}