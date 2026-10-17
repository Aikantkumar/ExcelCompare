import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronUp, ChevronDown } from 'lucide-react';

const COLUMNS = [
  { key: 'sheet', label: 'SHEET', minWidth: 120 },
  { key: 'cell', label: 'CELL', minWidth: 80 },
  { key: 'valA', label: 'VALUE 1', minWidth: 140 },
  { key: 'valB', label: 'VALUE 2', minWidth: 140 },
  { key: 'description', label: 'CHANGE DESCRIPTION', minWidth: 280 },
];

const ROW_HEIGHT = 32;
const HEADER_HEIGHT = 36;

function parseNumber(val) {
  if (val == null) return NaN;
  const str = String(val).trim();
  if (!str) return NaN;
  const cleaned = str.replace(/[$,£€¥₹,\s]/g, '');
  const num = Number(cleaned);
  return isFinite(num) ? num : NaN;
}

function compareValues(a, b, sortDirection, key) {
  if (a === b) return 0;
  if (a === '—' || a === '' || a == null) return 1;
  if (b === '—' || b === '' || b == null) return -1;

  const numA = parseNumber(a);
  const numB = parseNumber(b);
  if (isFinite(numA) && isFinite(numB)) {
    return sortDirection === 'asc' ? numA - numB : numB - numA;
  }

  const strA = String(a).toLowerCase();
  const strB = String(b).toLowerCase();
  return sortDirection === 'asc' ? strA.localeCompare(strB, undefined, { numeric: true }) : strB.localeCompare(strA, undefined, { numeric: true });
}

export default function ResultsGrid({
  items,
  onRowClick,
  activeRowId,
  getCategoryColor,
  getCategoryPattern,
}) {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const parentRef = useRef(null);

  const sortedItems = useMemo(() => {
    if (!sortConfig.key) return items;
    return [...items].sort((a, b) => compareValues(a[sortConfig.key], b[sortConfig.key], sortConfig.direction, sortConfig.key));
  }, [items, sortConfig]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const virtualizer = useVirtualizer({
    count: sortedItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
    paddingStart: HEADER_HEIGHT,
  });

  const virtualRows = virtualizer.getVirtualItems();
  const totalHeight = virtualizer.getTotalSize() + HEADER_HEIGHT;

  const colWidths = useMemo(() => COLUMNS.map(c => c.minWidth), []);
  const totalWidth = colWidths.reduce((a, b) => a + b, 0);
  const totalWidthPx = `${totalWidth}px`;

  const gridTemplateColumns = colWidths.map(w => `${w}px`).join(' ');

  return (
    <div className="border border-[#262626] bg-[#0d0d0d] flex flex-col overflow-hidden">
      <div
        ref={parentRef}
        className="overflow-auto relative"
        style={{ flex: 1, minHeight: 0, contain: 'layout paint', overscrollBehavior: 'contain' }}
      >
        <div style={{ height: totalHeight, width: totalWidthPx, minWidth: '100%', position: 'relative' }}>
          <div className="sticky top-0 z-20 bg-[#000000] border-b border-[#262626]" style={{ height: HEADER_HEIGHT, width: totalWidthPx, minWidth: '100%' }}>
            <div style={{ display: 'grid', gridTemplateColumns, height: '100%' }}>
              {COLUMNS.map((col, idx) => (
                <button
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="px-2 py-2 text-left text-[10px] font-mono uppercase text-[#999999] hover:text-white border-r border-[#262626] flex items-center gap-1 transition-colors"
                  style={{ width: `${colWidths[idx]}px`, minWidth: `${colWidths[idx]}px`, maxWidth: `${colWidths[idx]}px` }}
                >
                  {col.label}
                  {sortConfig.key === col.key && (
                    sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3 text-[#c3d9f3]" /> : <ChevronDown className="w-3 h-3 text-[#c3d9f3]" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div style={{ paddingTop: HEADER_HEIGHT, width: totalWidthPx }}>
            {virtualRows.map((virtualRow) => {
              const item = sortedItems[virtualRow.index];
              const color = getCategoryColor ? getCategoryColor(item.category, item.subtype) : '#999999';
              const pattern = getCategoryPattern ? getCategoryPattern(item.category, item.subtype) : 'solid';
              const isActive = activeRowId === item.id;

              const rowStyle = {
                position: 'absolute',
                top: 0,
                left: 0,
                width: totalWidthPx,
                transform: `translateY(${virtualRow.start}px)`,
                height: `${ROW_HEIGHT}px`,
                display: 'grid',
                gridTemplateColumns,
                backgroundColor: isActive ? '#1f1f1f' : (virtualRow.index % 2 === 0 ? '#0d0d0d' : '#141414'),
                borderBottom: '1px solid #262626',
                borderLeft: `3px ${pattern === 'dashed' ? 'dashed' : 'solid'} ${color}`,
              };

              return (
                <div
                  key={item.id}
                  style={rowStyle}
                  className="transition-colors cursor-pointer"
                  onClick={() => onRowClick?.(item)}
                >
                  {COLUMNS.map((col, idx) => (
                    <div
                      key={col.key}
                      className="px-2 py-2 text-[11px] font-mono truncate flex items-center overflow-hidden"
                      style={{ width: `${colWidths[idx]}px`, minWidth: `${colWidths[idx]}px`, maxWidth: `${colWidths[idx]}px`, color: idx === 2 || idx === 3 ? '#cccccc' : '#e6e6e6' }}
                      title={String(item[col.key] || '')}
                    >
                      {col.key === 'valA' || col.key === 'valB' ? (
                        <span className="font-mono tabular-nums">{item[col.key] || '—'}</span>
                      ) : (
                        item[col.key] || '—'
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="p-2 border-t border-[#262626] bg-[#0d0d0d] shrink-0">
        <div className="text-[10px] font-mono text-[#999999] text-right">
          {sortedItems.length} ROW(S)
        </div>
      </div>
    </div>
  );
}