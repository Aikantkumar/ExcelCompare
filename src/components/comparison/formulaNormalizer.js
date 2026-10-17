const CELL_REF_PATTERN = /(?<![A-Za-z0-9_!.'$])(\$?[A-Z]{1,3})(\$?)(\d+)(?![\d(A-Za-z_])/g;
const SHEET_QUALIFIED_PATTERN = /^'?[^']+'!/;
const RANGE_PATTERN = /(\$?[A-Z]{1,3})(\$?)(\d+)\s*:\s*(\$?[A-Z]{1,3})(\$?)(\d+)/g;
const FUNCTION_CALL_PATTERN = /\b([A-Z][A-Z0-9]*)\s*\(/g;

function tokenizeFormula(formula) {
  const tokens = [];
  let lastIndex = 0;
  let match;

  while ((match = CELL_REF_PATTERN.exec(formula)) !== null) {
    const [fullMatch, col, colAbs, row] = match;
    const start = match.index;
    const end = start + fullMatch.length;

    if (start > lastIndex) {
      tokens.push({ type: 'text', value: formula.slice(lastIndex, start) });
    }

    const isRange = false;
    const rangeMatch = formula.slice(start).match(RANGE_PATTERN);
    if (rangeMatch && rangeMatch.index === 0) {
      const rangeParts = rangeMatch[0].match(/(\$?[A-Z]{1,3})(\$?)(\d+)\s*:\s*(\$?[A-Z]{1,3})(\$?)(\d+)/);
      if (rangeParts) {
        tokens.push({
          type: 'range',
          startCol: rangeParts[1],
          startColAbs: rangeParts[2] === '$',
          startRow: parseInt(rangeParts[3], 10),
          endCol: rangeParts[4],
          endColAbs: rangeParts[5] === '$',
          endRow: parseInt(rangeParts[6], 10),
          original: rangeMatch[0],
        });
        lastIndex = start + rangeMatch[0].length;
        CELL_REF_PATTERN.lastIndex = lastIndex;
        continue;
      }
    }

    tokens.push({
      type: 'ref',
      col,
      colAbs: colAbs === '$',
      row: parseInt(row, 10),
      original: fullMatch,
    });
    lastIndex = end;
  }

  if (lastIndex < formula.length) {
    tokens.push({ type: 'text', value: formula.slice(lastIndex) });
  }

  return tokens;
}

function colToIndex(col) {
  let result = 0;
  for (let i = 0; i < col.length; i++) {
    result = result * 26 + (col.charCodeAt(i) - 64);
  }
  return result - 1;
}

function indexToCol(idx) {
  let col = '';
  idx += 1;
  while (idx > 0) {
    const rem = (idx - 1) % 26;
    col = String.fromCharCode(65 + rem) + col;
    idx = Math.floor((idx - rem - 1) / 26);
  }
  return col;
}

function mapReference(ref, rowMap, colMap, currentSheetName) {
  if (ref.type === 'ref') {
    const newRow = rowMap.get(ref.row) ?? ref.row;
    const newColIdx = colMap.get(colToIndex(ref.col)) ?? colToIndex(ref.col);
    const newCol = indexToCol(newColIdx);
    const colAbs = ref.colAbs ? '$' : '';
    const rowAbs = ref.original.includes('$' + ref.row) ? '$' : '';
    return `${colAbs}${newCol}${rowAbs}${newRow}`;
  }
  if (ref.type === 'range') {
    const newStartRow = rowMap.get(ref.startRow) ?? ref.startRow;
    const newEndRow = rowMap.get(ref.endRow) ?? ref.endRow;
    const newStartColIdx = colMap.get(colToIndex(ref.startCol)) ?? colToIndex(ref.startCol);
    const newEndColIdx = colMap.get(colToIndex(ref.endCol)) ?? colToIndex(ref.endCol);
    const newStartCol = indexToCol(newStartColIdx);
    const newEndCol = indexToCol(newEndColIdx);
    const startColAbs = ref.startColAbs ? '$' : '';
    const endColAbs = ref.endColAbs ? '$' : '';
    const startRowAbs = ref.original.includes('$' + ref.startRow) ? '$' : '';
    const endRowAbs = ref.original.includes('$' + ref.endRow) ? '$' : '';
    return `${startColAbs}${newStartCol}${startRowAbs}${newStartRow}:${endColAbs}${newEndCol}${endRowAbs}${newEndRow}`;
  }
  return ref.value;
}

function isSheetQualified(formula, sheetName) {
  const escaped = sheetName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`'?${escaped}'!`);
  return pattern.test(formula);
}

function removeSheetQualifier(formula, sheetName) {
  const escaped = sheetName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`'?${escaped}'!`, 'g');
  return formula.replace(pattern, '');
}

export function normalizeFormula(formulaA, formulaB, rowMap, colMap, sheetName) {
  if (!formulaA || !formulaB) return false;
  if (formulaA === formulaB) return true;

  const tokensA = tokenizeFormula(formulaA);
  const tokensB = tokenizeFormula(formulaB);

  if (tokensA.length !== tokensB.length) return false;

  let hasUnmappedRef = false;

  for (let i = 0; i < tokensA.length; i++) {
    const tokenA = tokensA[i];
    const tokenB = tokensB[i];

    if (tokenA.type === 'text' && tokenB.type === 'text') {
      if (tokenA.value !== tokenB.value) return false;
      continue;
    }

    if (tokenA.type === 'ref' && tokenB.type === 'ref') {
      const mapped = mapReference(tokenA, rowMap, colMap, sheetName);
      if (mapped !== tokenB.original) {
        if (!rowMap.has(tokenA.row) || !colMap.has(colToIndex(tokenA.col))) {
          hasUnmappedRef = true;
        }
        return false;
      }
      continue;
    }

    if (tokenA.type === 'range' && tokenB.type === 'range') {
      const mapped = mapReference(tokenA, rowMap, colMap, sheetName);
      if (mapped !== tokenB.original) {
        if (!rowMap.has(tokenA.startRow) || !rowMap.has(tokenA.endRow) ||
            !colMap.has(colToIndex(tokenA.startCol)) || !colMap.has(colToIndex(tokenA.endCol))) {
          hasUnmappedRef = true;
        }
        return false;
      }
      continue;
    }

    return false;
  }

  if (hasUnmappedRef) return false;
  return true;
}

export function buildRowMap(mappedRows) {
  const rowMap = new Map();
  mappedRows.forEach(pair => {
    if (pair.origIndexA !== null && pair.origIndexB !== null) {
      rowMap.set(pair.origIndexA, pair.origIndexB);
    }
  });
  return rowMap;
}

export function buildColMap(colMappingB, maxCols) {
  const colMap = new Map();
  if (colMappingB) {
    colMappingB.forEach((targetIdx, sourceIdx) => {
      if (targetIdx !== -1) {
        colMap.set(sourceIdx, targetIdx);
      }
    });
  } else {
    for (let i = 0; i < maxCols; i++) {
      colMap.set(i, i);
    }
  }
  return colMap;
}

export function isSystemGenerated(formulaA, formulaB, mappedRows, colMappingB, maxCols, sheetName) {
  if (!formulaA || !formulaB) return false;
  if (formulaA === formulaB) return true;

  const hasRowInsertDelete = mappedRows.some(p => p.origIndexA !== null && p.origIndexB !== null && p.origIndexA !== p.origIndexB);
  const hasColInsertDelete = colMappingB && colMappingB.some((t, s) => t !== -1 && t !== s);
  if (!hasRowInsertDelete && !hasColInsertDelete) return false;

  const rowMap = buildRowMap(mappedRows);
  const colMap = buildColMap(colMappingB, maxCols);

  const cleanA = formulaA.startsWith('=') ? formulaA.slice(1) : formulaA;
  const cleanB = formulaB.startsWith('=') ? formulaB.slice(1) : formulaB;

  if (isSheetQualified(cleanA, sheetName) || isSheetQualified(cleanB, sheetName)) {
    const unqualifiedA = removeSheetQualifier(cleanA, sheetName);
    const unqualifiedB = removeSheetQualifier(cleanB, sheetName);
    return normalizeFormula(unqualifiedA, unqualifiedB, rowMap, colMap, sheetName);
  }

  return normalizeFormula(cleanA, cleanB, rowMap, colMap, sheetName);
}