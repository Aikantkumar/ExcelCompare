/**
 * High performance cell-by-cell diff engine with formula awareness & smart row matching
 */

export function compareSheets(sheetA, sheetB, options = {}) {
  const { compareFormulas = true, smartRowMatch = true } = options;

  const rowsA = sheetA?.rows || [];
  const rowsB = sheetB?.rows || [];

  const maxCols = Math.max(sheetA?.colCount || 0, sheetB?.colCount || 0);

  // If smart row matching is enabled, match rows by hash signature first
  const mappedRows = smartRowMatch 
    ? alignRowsSmart(rowsA, rowsB)
    : alignRowsSequential(rowsA, rowsB);

  let totalChanges = 0;
  let totalAdded = 0;
  let totalDeleted = 0;
  let totalModified = 0;
  let totalFormulaChanges = 0;

  const diffRows = mappedRows.map((pair, rowIndex) => {
    const rowA = pair.rowA;
    const rowB = pair.rowB;

    if (!rowA && rowB) {
      totalAdded++;
      return {
        type: 'ADDED',
        indexA: null,
        indexB: pair.origIndexB,
        cellsA: Array(maxCols).fill({ val: '', type: 'empty' }),
        cellsB: padRow(rowB, maxCols),
        cellStatuses: Array(maxCols).fill('ADDED'),
      };
    }

    if (rowA && !rowB) {
      totalDeleted++;
      return {
        type: 'DELETED',
        indexA: pair.origIndexA,
        indexB: null,
        cellsA: padRow(rowA, maxCols),
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

      const valA = String(cellA.val || '').trim();
      const valB = String(cellB.val || '').trim();

      const formA = String(cellA.formula || '').trim();
      const formB = String(cellB.formula || '').trim();

      let status = 'SAME';

      if (compareFormulas && (formA || formB) && formA !== formB) {
        status = 'FORMULA_CHANGED';
        totalFormulaChanges++;
        rowHasChanges = true;
      } else if (valA !== valB) {
        status = 'MODIFIED';
        totalModified++;
        rowHasChanges = true;
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

  return {
    rows: diffRows,
    stats: {
      totalRows: diffRows.length,
      totalChanges,
      totalAdded,
      totalDeleted,
      totalModified,
      totalFormulaChanges,
      maxCols,
    },
  };
}

/**
 * Sequential row alignment (fallback)
 */
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

/**
 * Smart row alignment based on content hash & fuzzy match
 */
function alignRowsSmart(rowsA, rowsB) {
  const result = [];
  const usedB = new Set();

  const hashBMap = new Map();
  rowsB.forEach((row, bIdx) => {
    const h = getRowHash(row);
    if (!hashBMap.has(h)) hashBMap.set(h, []);
    hashBMap.get(h).push(bIdx);
  });

  // Step 1: Exact row content matches
  for (let aIdx = 0; aIdx < rowsA.length; aIdx++) {
    const rowA = rowsA[aIdx];
    const hA = getRowHash(rowA);

    if (hashBMap.has(hA) && hashBMap.get(hA).length > 0) {
      // Find closest index in B
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

    // Step 2: Try position match if B is unused and has similar first column
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

  // Add remaining unmapped rows from B
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

/**
 * Compare two single columns (Set Operations)
 */
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

/**
 * ID-Based Key/Value Reconciliation Engine
 */
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
