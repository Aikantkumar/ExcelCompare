import React, { useRef, useMemo, useEffect, useImperativeHandle, forwardRef, useState, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

const DEFAULT_COL_WIDTH = 120;
const MIN_COL_WIDTH = 80;
const MAX_COL_WIDTH = 400;
const DEFAULT_ROW_HEIGHT = 32;
const HEADER_HEIGHT = 36;
const FIRST_COL_WIDTH = 48;

function parseWidth(w) {
  if (typeof w === 'number') return w;
  if (typeof w === 'string') {
    const parsed = parseFloat(w);
    return isNaN(parsed) ? DEFAULT_COL_WIDTH : parsed;
  }
  return DEFAULT_COL_WIDTH;
}

function clampWidth(w) {
  const parsed = parseWidth(w);
  return Math.max(MIN_COL_WIDTH, Math.min(MAX_COL_WIDTH, parsed));
}

export function VirtualizedTable({
  rows,
  columns,
  rowHeight = DEFAULT_ROW_HEIGHT,
  headerHeight = HEADER_HEIGHT,
  renderCell,
  renderHeader,
  getCellProps,
  className = '',
  style = {},
  containerHeight = 620,
  overscan = 5,
  stickyHeader = true,
  onRowClick,
  rowKey = (row, idx) => idx,
  estimatedRowSize,
  onScroll,
}) {
  const parentRef = useRef(null);
  const tableRef = useRef(null);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: estimatedRowSize || (() => rowHeight),
    overscan,
    paddingStart: headerHeight,
  });

  useEffect(() => {
    virtualizer.measure();
  }, [rows.length, virtualizer]);

  const virtualRows = virtualizer.getVirtualItems();
  const totalHeight = virtualizer.getTotalSize() + headerHeight;

  const colWidths = useMemo(() =>
    columns.map(c => clampWidth(c.width || c.minWidth || DEFAULT_COL_WIDTH)),
    [columns]
  );

  const totalWidth = colWidths.reduce((a, b) => a + b, 0);
  const totalWidthPx = `${totalWidth}px`;

  return (
    <div
      ref={parentRef}
      className={`overflow-auto relative ${className}`}
      style={{ height: containerHeight, ...style, contain: 'layout paint', overscrollBehavior: 'contain', scrollBehavior: 'auto' }}
      onScroll={(e) => {
        onScroll?.(e);
      }}
    >
      <div style={{ height: totalHeight, position: 'relative', width: totalWidthPx, minWidth: '100%' }}>
        {stickyHeader && (
          <div
            className="sticky top-0 z-20 bg-[#000000] border-b border-[#262626]"
            style={{ height: headerHeight, width: totalWidthPx, minWidth: '100%' }}
          >
            <table className="w-full border-collapse" ref={tableRef} style={{ tableLayout: 'fixed', width: totalWidthPx }}>
              <colgroup>
                {colWidths.map((w, i) => (
                  <col key={i} style={{ width: `${w}px` }} />
                ))}
              </colgroup>
              <thead>
                <tr className="text-[#999999] text-xs font-mono">
                  {columns.map((col, cIdx) => (
                    <th
                      key={cIdx}
                      className="py-2 px-3 border-r border-[#262626] text-left font-semibold text-white uppercase sticky top-0 bg-[#000000] z-10"
                      style={{ width: `${colWidths[cIdx]}px` }}
                    >
                      {renderHeader ? renderHeader(col, cIdx) : col.label}
                    </th>
                  ))}
                </tr>
              </thead>
            </table>
          </div>
        )}

        <div style={{ paddingTop: stickyHeader ? headerHeight : 0, width: totalWidthPx }}>
          <table className="w-full border-collapse text-xs font-mono" style={{ tableLayout: 'fixed', width: totalWidthPx }}>
            <tbody>
              {virtualRows.map((virtualRow) => {
                const row = rows[virtualRow.index];
                const isSelected = onRowClick && row.__selected;
                return (
                  <tr
                    key={rowKey(row, virtualRow.index)}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: totalWidthPx,
                      transform: `translateY(${virtualRow.start}px)`,
                      height: `${virtualRow.size}px`,
                    }}
                    className={`border-b border-[#262626]/60 transition-colors ${
                      isSelected ? 'bg-[#1f1f1f]/80' : 'hover:bg-[#1a1a1a]/50'
                    }`}
                    onClick={() => onRowClick?.(row, virtualRow.index)}
                  >
                    {columns.map((col, cIdx) => {
                      const cellProps = getCellProps ? getCellProps(row, cIdx, virtualRow.index) : {};
                      return (
                        <td
                          key={cIdx}
                          className="py-2 px-3 border-r border-[#262626] relative cursor-pointer font-mono whitespace-nowrap overflow-hidden text-ellipsis"
                          style={{ width: `${colWidths[cIdx]}px` }}
                          {...cellProps}
                        >
                          {renderCell(row, cIdx, virtualRow.index)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export const SpreadsheetVirtualizedTable = forwardRef((
  {
    rows,
    columns,
    rowHeight = DEFAULT_ROW_HEIGHT,
    headerHeight = HEADER_HEIGHT,
    firstColWidth = FIRST_COL_WIDTH,
    renderFirstColHeader,
    renderFirstColCell,
    renderCell,
    renderHeader,
    getCellProps,
    className = '',
    style = {},
    containerHeight = 620,
    overscan = 5,
    onRowClick,
    rowKey = (row, idx) => idx,
    estimatedRowSize,
    getRowClassName,
    renderCollapsedRow,
    onToggleCollapse,
    onScroll,
    fixedRowHeight = false,
  },
  ref
) => {
  const parentRef = useRef(null);
  const [colWidths, setColWidths] = useState(() =>
    columns.map(c => clampWidth(c.width || c.minWidth || DEFAULT_COL_WIDTH))
  );
  const [measuredRowHeights, setMeasuredRowHeights] = useState(new Map());

  useEffect(() => {
    setColWidths(columns.map(c => clampWidth(c.width || c.minWidth || DEFAULT_COL_WIDTH)));
  }, [columns]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      if (fixedRowHeight) {
        return estimatedRowSize ? estimatedRowSize(index) : rowHeight;
      }
      const measured = measuredRowHeights.get(index);
      if (measured) return measured;
      return estimatedRowSize ? estimatedRowSize(index) : rowHeight;
    },
    overscan,
    paddingStart: headerHeight,
  });

  useImperativeHandle(ref, () => ({
    scrollToIndex: (index, alignment = 'center') => {
      virtualizer.scrollToIndex(index, { align: alignment });
    },
    getVirtualizer: () => virtualizer,
    measureAll: () => virtualizer.measure(),
  }), [virtualizer]);

  useEffect(() => {
    virtualizer.measure();
  }, [rows.length, virtualizer]);

  const virtualRows = virtualizer.getVirtualItems();
  const totalHeight = virtualizer.getTotalSize() + headerHeight;
  const totalWidth = firstColWidth + colWidths.reduce((a, b) => a + b, 0);
  const totalWidthPx = `${totalWidth}px`;

  const handleRowMeasure = useCallback((index, height) => {
    setMeasuredRowHeights(prev => {
      const next = new Map(prev);
      if (next.get(index) !== height) {
        next.set(index, height);
        return next;
      }
      return prev;
    });
  }, []);

  return (
    <div
      ref={parentRef}
      className={`overflow-auto relative ${className}`}
      style={{ height: containerHeight, ...style, contain: 'layout paint', overscrollBehavior: 'contain', scrollBehavior: 'auto' }}
      onScroll={(e) => {
        onScroll?.(e);
      }}
    >
      <div style={{ height: totalHeight, position: 'relative', width: totalWidthPx, minWidth: '100%' }}>
        {/* Sticky Header Row */}
        <div
          className="sticky top-0 z-20 bg-[#000000] border-b border-[#262626]"
          style={{ height: headerHeight, width: totalWidthPx, minWidth: '100%' }}
        >
          <table className="w-full border-collapse" style={{ tableLayout: 'fixed', width: totalWidthPx }}>
<colgroup>
                <col style={{ width: `${firstColWidth}px` }} />
                {colWidths.map((w, i) => (
                  <col key={i} style={{ width: `${w}px` }} />
                ))}
              </colgroup>
            <thead>
              <tr className="text-[#999999] text-xs font-mono">
                {/* First Column Header (Line Numbers) - Sticky Left */}
                <th
                  className="py-2 px-2 border-r border-[#262626] text-center font-normal text-[10px] sticky left-0 bg-[#000000] z-30"
                  style={{ width: `${firstColWidth}px`, minWidth: `${firstColWidth}px`, maxWidth: `${firstColWidth}px` }}
                >
                  {renderFirstColHeader ? renderFirstColHeader() : ''}
                </th>
                {/* Data Column Headers */}
                {columns.map((col, cIdx) => (
                  <th
                    key={cIdx}
                    className="py-2 px-3 border-r border-[#262626] text-left font-semibold text-white uppercase min-w-0 sticky top-0 bg-[#000000] z-10"
                    style={{ width: `${colWidths[cIdx]}px`, minWidth: `${colWidths[cIdx]}px`, maxWidth: `${colWidths[cIdx]}px` }}
                  >
                    {renderHeader ? renderHeader(col, cIdx) : col.label}
                  </th>
                ))}
              </tr>
            </thead>
          </table>
        </div>

        {/* Virtualized Body */}
        <div style={{ paddingTop: headerHeight, width: totalWidthPx }}>
          <table className="w-full border-collapse text-xs font-mono" style={{ tableLayout: 'fixed', width: totalWidthPx }}>
            <tbody>
              {virtualRows.map((virtualRow) => {
                const row = rows[virtualRow.index];
                const rowClassName = getRowClassName ? getRowClassName(row, virtualRow.index) : '';
                const isSelected = onRowClick && row.__selected;

                if (row && row.type === 'COLLAPSED' && renderCollapsedRow) {
                  return (
                    <tr
                      key={rowKey(row, virtualRow.index)}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: totalWidthPx,
                        transform: `translateY(${virtualRow.start}px)`,
                        height: `${virtualRow.size}px`,
                      }}
                      className="border-b border-[#262626] bg-[#141414] hover:bg-[#1f1f1f] transition-colors cursor-pointer"
                      onClick={() => onToggleCollapse && onToggleCollapse(row, virtualRow.index)}
                    >
                      <td
                        colSpan={columns.length + 1}
                        className="py-2 px-4 text-center text-xs font-mono text-[#c3d9f3] bg-[#0d0d0d] hover:bg-[#1a1a1a] border-y border-[#262626] transition-all select-none"
                        style={{ width: totalWidthPx }}
                      >
                        {renderCollapsedRow(row, virtualRow.index)}
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr
                    key={rowKey(row, virtualRow.index)}
                    ref={fixedRowHeight ? undefined : (el) => {
                      if (el) {
                        const h = el.offsetHeight;
                        if (h > 0 && h !== rowHeight) {
                          handleRowMeasure(virtualRow.index, h);
                        }
                      }
                    }}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: totalWidthPx,
                      transform: `translateY(${virtualRow.start}px)`,
                      height: fixedRowHeight ? `${virtualRow.size}px` : 'auto',
                      minHeight: fixedRowHeight ? undefined : virtualRow.size,
                      overflow: fixedRowHeight ? 'hidden' : undefined,
                    }}
                    className={`border-b border-[#262626]/60 transition-colors ${
                      isSelected ? 'bg-[#1f1f1f]/80' : 'hover:bg-[#1a1a1a]/50'
                    } ${rowClassName}`}
                    onClick={() => onRowClick?.(row, virtualRow.index)}
                  >
                    {/* First Column (Line Numbers) - Sticky Left */}
                    <td
                      className="py-2 px-2 border-r border-[#262626] text-center text-[#666666] select-none text-[10px] font-mono bg-[#050505] sticky left-0 z-20"
                      style={{ width: `${firstColWidth}px`, minWidth: `${firstColWidth}px`, maxWidth: `${firstColWidth}px` }}
                    >
                      {renderFirstColCell(row, virtualRow.index)}
                    </td>
                    {/* Data Cells */}
                    {columns.map((col, cIdx) => {
                      const cellProps = getCellProps ? getCellProps(row, cIdx, virtualRow.index) : {};
                      return (
                        <td
                          key={cIdx}
                          className="py-2 px-3 border-r border-[#262626] relative cursor-pointer font-mono min-w-0"
                          style={{ width: `${colWidths[cIdx]}px`, minWidth: `${colWidths[cIdx]}px`, maxWidth: `${colWidths[cIdx]}px` }}
                          {...cellProps}
                        >
                          <div className="cell-content-wrapper" style={{ overflow: 'hidden' }}>
                            {renderCell(row, cIdx, virtualRow.index)}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
});

SpreadsheetVirtualizedTable.displayName = 'SpreadsheetVirtualizedTable';

export function VirtualizedTableBody({
  rows,
  columns,
  rowHeight = DEFAULT_ROW_HEIGHT,
  renderCell,
  getCellProps,
  className = '',
  style = {},
  containerHeight = 620,
  overscan = 5,
  rowKey = (row, idx) => idx,
  estimatedRowSize,
  onScroll,
}) {
  const parentRef = useRef(null);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: estimatedRowSize || (() => rowHeight),
    overscan,
  });

  useEffect(() => {
    virtualizer.measure();
  }, [rows.length, virtualizer]);

  const virtualRows = virtualizer.getVirtualItems();
  const totalHeight = virtualizer.getTotalSize();
  const colWidths = useMemo(() =>
    columns.map(c => clampWidth(c.width || c.minWidth || DEFAULT_COL_WIDTH)),
    [columns]
  );
  const totalWidth = colWidths.reduce((a, b) => a + b, 0);
  const totalWidthPx = `${totalWidth}px`;

  return (
    <div
      ref={parentRef}
      className={`overflow-auto relative ${className}`}
      style={{ height: containerHeight, ...style, contain: 'layout paint', overscrollBehavior: 'contain', scrollBehavior: 'auto' }}
      onScroll={(e) => {
        onScroll?.(e);
      }}
    >
      <div style={{ height: totalHeight, position: 'relative', width: totalWidthPx, minWidth: '100%' }}>
        <table className="w-full border-collapse text-xs font-mono" style={{ tableLayout: 'fixed', width: totalWidthPx }}>
          <tbody>
            {virtualRows.map((virtualRow) => {
              const row = rows[virtualRow.index];
              return (
                <tr
                  key={rowKey(row, virtualRow.index)}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: totalWidthPx,
                    transform: `translateY(${virtualRow.start}px)`,
                    height: `${virtualRow.size}px`,
                  }}
                  className="border-b border-[#262626]/60 transition-colors hover:bg-[#1a1a1a]/50"
                >
{columns.map((col, cIdx) => {
                      const cellProps = getCellProps ? getCellProps(row, cIdx, virtualRow.index) : {};
                      return (
                        <td
                          key={cIdx}
                          className="py-2 px-3 border-r border-[#262626] relative font-mono min-w-0"
                          style={{ width: `${colWidths[cIdx]}px`, minWidth: `${colWidths[cIdx]}px`, maxWidth: `${colWidths[cIdx]}px` }}
                          {...cellProps}
                        >
                          <div className="cell-content-wrapper" style={{ overflow: 'hidden' }}>
                            {renderCell(row, cIdx, virtualRow.index)}
                          </div>
                        </td>
                      );
                    })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function useVirtualizerHook({
  count,
  getScrollElement,
  estimateSize,
  overscan = 5,
  paddingStart = 0,
}) {
  return useVirtualizer({
    count,
    getScrollElement,
    estimateSize,
    overscan,
    paddingStart,
  });
}