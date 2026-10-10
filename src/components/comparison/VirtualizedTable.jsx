import React, { useRef, useMemo, useEffect, useImperativeHandle, forwardRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

export function VirtualizedTable({
  rows,
  columns,
  rowHeight = 32,
  headerHeight = 36,
  renderCell,
  renderHeader,
  className = '',
  style = {},
  containerHeight = 620,
  overscan = 5,
  stickyHeader = true,
  onRowClick,
  rowKey = (row, idx) => idx,
  estimatedRowSize,
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

  return (
    <div
      ref={parentRef}
      className={`overflow-auto relative ${className}`}
      style={{ height: containerHeight, ...style }}
      onScroll={() => virtualizer.measure()}
    >
      <div style={{ height: totalHeight, position: 'relative', width: '100%' }}>
        {stickyHeader && (
          <div
            className="sticky top-0 z-20 bg-[#000000] border-b border-[#262626]"
            style={{ height: headerHeight }}
          >
            <table className="w-full border-collapse" ref={tableRef}>
              <thead>
                <tr className="text-[#999999] text-xs font-mono">
                  {columns.map((col, cIdx) => (
                    <th
                      key={cIdx}
                      className="py-2 px-3 border-r border-[#262626] text-left font-semibold text-white uppercase min-w-[120px] sticky top-0 bg-[#000000] z-10"
                      style={{ width: col.width, minWidth: col.minWidth || '120px' }}
                    >
                      {renderHeader ? renderHeader(col, cIdx) : col.label}
                    </th>
                  ))}
                </tr>
              </thead>
            </table>
          </div>
        )}

        <div style={{ paddingTop: stickyHeader ? headerHeight : 0 }}>
          <table className="w-full border-collapse text-xs font-mono">
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
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`,
                      height: `${virtualRow.size}px`,
                    }}
                    className={`border-b border-[#262626]/60 transition-colors ${
                      isSelected ? 'bg-[#1f1f1f]/80' : 'hover:bg-[#1a1a1a]/50'
                    }`}
                    onClick={() => onRowClick?.(row, virtualRow.index)}
                  >
                    {columns.map((col, cIdx) => (
                      <td
                        key={cIdx}
                        className="py-2 px-3 border-r border-[#262626] relative cursor-pointer font-mono whitespace-nowrap overflow-hidden text-ellipsis max-w-[220px]"
                        style={{ width: col.width, minWidth: col.minWidth || '120px' }}
                      >
                        {renderCell(row, cIdx, virtualRow.index)}
                      </td>
                    ))}
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

export const SpreadsheetVirtualizedTable = forwardRef(({
  rows,
  columns,
  rowHeight = 32,
  headerHeight = 36,
  firstColWidth = 48,
  renderFirstColHeader,
  renderFirstColCell,
  renderCell,
  renderHeader,
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
}, ref) => {
  const parentRef = useRef(null);
  const headerRef = useRef(null);
  const firstColHeaderRef = useRef(null);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: estimatedRowSize || (() => rowHeight),
    overscan,
    paddingStart: headerHeight,
  });

  useImperativeHandle(ref, () => ({
    scrollToIndex: (index, alignment = 'center') => {
      virtualizer.scrollToIndex(index, { align: alignment });
    },
    getVirtualizer: () => virtualizer,
  }), [virtualizer]);

  useEffect(() => {
    virtualizer.measure();
  }, [rows.length, virtualizer]);

  const virtualRows = virtualizer.getVirtualItems();
  const totalHeight = virtualizer.getTotalSize() + headerHeight;

  const colWidths = useMemo(() => 
    columns.map(c => c.width || c.minWidth || '120px'), 
    [columns]
  );

  return (
    <div
      ref={parentRef}
      className={`overflow-auto relative ${className}`}
      style={{ height: containerHeight, ...style }}
      onScroll={() => virtualizer.measure()}
    >
      <div style={{ height: totalHeight, position: 'relative', width: '100%' }}>
        {/* Sticky Header Row */}
        <div
          className="sticky top-0 z-20 bg-[#000000] border-b border-[#262626]"
          style={{ height: headerHeight }}
        >
          <table className="w-full border-collapse" ref={headerRef}>
            <thead>
              <tr className="text-[#999999] text-xs font-mono">
                {/* First Column Header (Line Numbers) - Sticky Left */}
                <th
                  ref={firstColHeaderRef}
                  className="py-2 px-2 border-r border-[#262626] text-center font-normal text-[10px] sticky left-0 bg-[#000000] z-30"
                  style={{ width: firstColWidth, minWidth: firstColWidth }}
                >
                  {renderFirstColHeader ? renderFirstColHeader() : ''}
                </th>
                {/* Data Column Headers */}
                {columns.map((col, cIdx) => (
                  <th
                    key={cIdx}
                    className="py-2 px-3 border-r border-[#262626] text-left font-semibold text-white uppercase min-w-[120px] sticky top-0 bg-[#000000] z-10"
                    style={{ width: col.width, minWidth: col.minWidth || '120px' }}
                  >
                    {renderHeader ? renderHeader(col, cIdx) : col.label}
                  </th>
                ))}
              </tr>
            </thead>
          </table>
        </div>

        {/* Virtualized Body */}
        <div style={{ paddingTop: headerHeight }}>
          <table className="w-full border-collapse text-xs font-mono">
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
                        width: '100%',
                        transform: `translateY(${virtualRow.start}px)`,
                        height: `${virtualRow.size}px`,
                      }}
                      className="border-b border-[#262626] bg-[#141414] hover:bg-[#1f1f1f] transition-colors cursor-pointer"
                      onClick={() => onToggleCollapse && onToggleCollapse(row, virtualRow.index)}
                    >
                      <td
                        colSpan={columns.length + 1}
                        className="py-2 px-4 text-center text-xs font-mono text-[#c3d9f3] bg-[#0d0d0d] hover:bg-[#1a1a1a] border-y border-[#262626] transition-all select-none"
                      >
                        {renderCollapsedRow(row, virtualRow.index)}
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr
                    key={rowKey(row, virtualRow.index)}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`,
                      height: `${virtualRow.size}px`,
                    }}
                    className={`border-b border-[#262626]/60 transition-colors ${
                      isSelected ? 'bg-[#1f1f1f]/80' : 'hover:bg-[#1a1a1a]/50'
                    } ${rowClassName}`}
                    onClick={() => onRowClick?.(row, virtualRow.index)}
                  >
                    {/* First Column (Line Numbers) - Sticky Left */}
                    <td
                      className="py-2 px-2 border-r border-[#262626] text-center text-[#666666] select-none text-[10px] font-mono bg-[#050505] sticky left-0 z-20"
                      style={{ width: firstColWidth, minWidth: firstColWidth }}
                    >
                      {renderFirstColCell(row, virtualRow.index)}
                    </td>
                    {/* Data Cells */}
                    {columns.map((col, cIdx) => (
                      <td
                        key={cIdx}
                        className="py-2 px-3 border-r border-[#262626] relative cursor-pointer font-mono whitespace-nowrap overflow-hidden text-ellipsis max-w-[220px]"
                        style={{ width: col.width, minWidth: col.minWidth || '120px' }}
                      >
                        {renderCell(row, cIdx, virtualRow.index)}
                      </td>
                    ))}
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
  rowHeight = 32,
  renderCell,
  className = '',
  style = {},
  containerHeight = 620,
  overscan = 5,
  rowKey = (row, idx) => idx,
  estimatedRowSize,
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

  return (
    <div
      ref={parentRef}
      className={`overflow-auto relative ${className}`}
      style={{ height: containerHeight, ...style }}
      onScroll={() => virtualizer.measure()}
    >
      <div style={{ height: totalHeight, position: 'relative', width: '100%' }}>
        <table className="w-full border-collapse text-xs font-mono">
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
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                    height: `${virtualRow.size}px`,
                  }}
                  className="border-b border-[#262626]/60 transition-colors hover:bg-[#1a1a1a]/50"
                >
                  {columns.map((col, cIdx) => (
                    <td
                      key={cIdx}
                      className="py-2 px-3 border-r border-[#262626] relative font-mono whitespace-nowrap overflow-hidden text-ellipsis max-w-[220px]"
                      style={{ width: col.width, minWidth: col.minWidth || '120px' }}
                    >
                      {renderCell(row, cIdx, virtualRow.index)}
                    </td>
                  ))}
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