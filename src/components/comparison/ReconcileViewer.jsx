import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { KeyRound, ShieldCheck, Filter, Download, Search, AlertTriangle, Maximize, Minimize, ChevronDown } from 'lucide-react';
import { reconcileSheets } from './diffEngine';
import { useFullView } from './useFullView';
import { 
  getStatusStyle, 
  getStatusLabel, 
  hasNumericDifference, 
  getNumericDifference,
  parseNumber 
} from './statusStyles';
import { useVirtualizer } from '@tanstack/react-virtual';
import { t } from '../../utils/translations';

const GRID_COLUMNS_BASE = 'minmax(180px, 1.4fr) minmax(140px, 1fr) minmax(140px, 1fr) minmax(150px, 0.9fr)';
const GRID_COLUMNS_WITH_DIFF = 'minmax(180px, 1.4fr) minmax(140px, 1fr) minmax(140px, 1fr) minmax(150px, 0.9fr) minmax(110px, 0.7fr)';
const HEADER_HEIGHT = 40;
const ROW_HEIGHT = 40;
const TABLE_MIN_HEIGHT = 320;
const TABLE_DEFAULT_HEIGHT = 560;

export default function ReconcileViewer({ sheetA, sheetB, locale = 'en' }) {
  const [keyColIndex, setKeyColIndex] = useState(0);
  const [valColIndex, setValColIndex] = useState(1);
  const [filterType, setFilterType] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1024);

  const { isFullView, toggleFullView, exitFullView } = useFullView({ isDesktop });

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const rowsA = useMemo(() => sheetA?.rows || [], [sheetA]);
  const rowsB = useMemo(() => sheetB?.rows || [], [sheetB]);

  const headers = useMemo(() => 
    rowsA[0]?.map((c, i) => c.val || `Col ${String.fromCharCode(65 + i)}`) || ['ID Col', 'Value Col'],
    [rowsA]
  );

  const totalRowsA = rowsA.length - 1;
  const totalRowsB = rowsB.length - 1;

  const keyCountsA = useMemo(() => {
    const counts = new Map();
    rowsA.slice(1).forEach((row) => {
      const key = String(row[keyColIndex]?.val || '').trim();
      if (key) counts.set(key, (counts.get(key) || 0) + 1);
    });
    return counts;
  }, [rowsA, keyColIndex]);

  const keyCountsB = useMemo(() => {
    const counts = new Map();
    rowsB.slice(1).forEach((row) => {
      const key = String(row[keyColIndex]?.val || '').trim();
      if (key) counts.set(key, (counts.get(key) || 0) + 1);
    });
    return counts;
  }, [rowsB, keyColIndex]);

  const uniqueKeysA = useMemo(() => Array.from(keyCountsA.keys()).length, [keyCountsA]);
  const uniqueKeysB = useMemo(() => Array.from(keyCountsB.keys()).length, [keyCountsB]);
  const hasDuplicateKeys = useMemo(() => 
    Array.from(keyCountsA.values()).some(c => c > 1) || Array.from(keyCountsB.values()).some(c => c > 1),
    [keyCountsA, keyCountsB]
  );

  const sameColumnWarning = keyColIndex === valColIndex;

  const reconResult = useMemo(() => 
    reconcileSheets(sheetA, sheetB, keyColIndex, valColIndex),
    [sheetA, sheetB, keyColIndex, valColIndex]
  );

  const filteredRecords = useMemo(() => {
    return reconResult.all.filter((item) => {
      if (filterType === 'MISMATCH' && item.status !== 'MISMATCH') return false;
      if (filterType === 'MATCH' && item.status !== 'MATCH') return false;
      if (filterType === 'ONLY_L' && item.status !== 'ONLY_LEFT') return false;
      if (filterType === 'ONLY_R' && item.status !== 'ONLY_RIGHT') return false;
      if (filterType === 'DUPLICATE' && item.status !== 'DUPLICATE_KEY') return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        return (
          item.key.toLowerCase().includes(q) ||
          String(item.valA).toLowerCase().includes(q) ||
          String(item.valB).toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [reconResult.all, filterType, searchTerm]);

  const showDiffColumn = useMemo(() => 
    filteredRecords.some(r => hasNumericDifference(r.valA, r.valB)),
    [filteredRecords]
  );

  const gridColumns = showDiffColumn ? GRID_COLUMNS_WITH_DIFF : GRID_COLUMNS_BASE;
  const minWidths = showDiffColumn 
    ? [180, 140, 140, 150, 110]
    : [180, 140, 140, 150];
  const minTableWidth = minWidths.reduce((a, b) => a + b, 0);

  const parentRef = useRef(null);

  const virtualizer = useVirtualizer({
    count: filteredRecords.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
    paddingStart: HEADER_HEIGHT,
  });

  const virtualRows = virtualizer.getVirtualItems();

  const exportReconciliationReport = useCallback(() => {
    const diffHeader = showDiffColumn ? ',Difference' : '';
    const csvHeader = `Key / ID,Value (Left File),Value (Right File),Reconciliation Status${diffHeader}\n`;
    const csvRows = filteredRecords
      .map((r) => {
        const diff = showDiffColumn ? `,"${getNumericDifference(r.valA, r.valB) ?? ''}"` : '';
        return `"${r.key}","${r.valA}","${r.valB}","${r.status}"${diff}`;
      })
      .join('\n');

    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvHeader + csvRows);
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', `reconciliation_report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [filteredRecords, showDiffColumn]);

  const tableContainerStyle = isFullView
    ? { flex: 1, minHeight: 0, overflow: 'hidden' }
    : { height: TABLE_DEFAULT_HEIGHT };

  return (
    <div className={isFullView ? 'fixed left-0 top-0 right-0 bottom-0 z-[60] bg-canvas h-[100dvh] flex flex-col gap-4 p-4 overflow-y-auto [padding-bottom:env(safe-area-inset-bottom)] [padding-top:env(safe-area-inset-top)]' : 'space-y-6'}>
      {/* Key & Value Column Matcher Config */}
      <div className={`bg-surface-card border border-hairline p-6 space-y-4 ${isFullView ? 'shrink-0' : ''}`}>
        <div className="flex items-center justify-between gap-2 text-title-sm text-ink">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-link" />
            ID-BASED RECONCILIATION CONFIGURATION
          </div>
          <button
            onClick={toggleFullView}
            className={`px-3 py-1.5 text-xs font-mono tracking-wider uppercase border rounded transition-all flex items-center gap-1 ${
              isFullView
                ? 'border-success text-success bg-diff-added-bg'
                : 'border-hairline-strong text-muted hover:border-white hover:text-ink'
            }`}
            title={isFullView ? 'Exit Full View' : 'Enter Full View'}
            aria-pressed={isFullView}
            aria-label={isFullView ? 'Exit Full View' : 'Enter Full View'}
          >
            {isFullView ? <Minimize className="w-3.5 h-3.5 inline" /> : <Maximize className="w-3.5 h-3.5 inline" />}
            <span className="ml-1 text-[11px] font-bold hidden sm:inline">
              {isFullView ? t(locale, 'comparison.exitFullView', 'EXIT FULL VIEW') : t(locale, 'comparison.fullView', 'FULL VIEW')}
            </span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          <div>
            <label className="text-caption text-ink mb-2 block">PRIMARY KEY / ID COLUMN:</label>
            <select
              value={keyColIndex}
              onChange={(e) => setKeyColIndex(Number(e.target.value))}
              className="w-full bg-canvas border border-hairline-strong text-ink p-3 font-mono text-sm focus:border-ink focus:outline-none"
            >
              {headers.map((h, i) => (
                <option key={i} value={i}>
                  Col {String.fromCharCode(65 + i)}: {h}
                </option>
              ))}
            </select>
            <div className="text-xs font-mono mt-2 flex items-center gap-2">
              <span className="text-muted">{totalRowsA} rows · {uniqueKeysA} unique keys</span>
              {hasDuplicateKeys && (
                <span className="text-diff-modified-text flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  2+ duplicate keys. Pick a more unique column.
                </span>
              )}
            </div>
            {sameColumnWarning && (
              <div className="text-xs font-mono text-diff-modified-text mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Key and value are the same column
              </div>
            )}
          </div>

          <div>
            <label className="text-caption text-ink mb-2 block">VALUE COLUMN TO RECONCILE:</label>
            <select
              value={valColIndex}
              onChange={(e) => setValColIndex(Number(e.target.value))}
              className="w-full bg-canvas border border-hairline-strong text-ink p-3 font-mono text-sm focus:border-ink focus:outline-none"
            >
              {headers.map((h, i) => (
                <option key={i} value={i}>
                  Col {String.fromCharCode(65 + i)}: {h}
                </option>
              ))}
            </select>
            <div className="text-xs font-mono text-muted mt-2">
              {totalRowsB} rows · {uniqueKeysB} unique keys
            </div>
            {sameColumnWarning && (
              <div className="text-xs font-mono text-diff-modified-text mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Key and value are the same column
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Summary Filter Pills */}
      <div className={`grid grid-cols-2 sm:grid-cols-6 gap-3 ${isFullView ? 'shrink-0' : ''}`}>
        <button
          onClick={() => setFilterType('ALL')}
          className={`p-4 border text-left transition-colors ${
            filterType === 'ALL' ? 'border-ink bg-surface-elevated' : 'border-hairline bg-surface-soft'
          }`}
        >
          <div className="text-[10px] font-mono text-muted uppercase">TOTAL RECORDS</div>
          <div className="text-2xl font-display text-ink">{reconResult.all.length}</div>
        </button>

        <button
          onClick={() => setFilterType('MISMATCH')}
          className={`p-4 border text-left transition-colors ${
            filterType === 'MISMATCH' ? 'border-diff-modified-border bg-diff-modified-bg' : 'border-hairline bg-surface-soft'
          }`}
        >
          <div className="text-[10px] font-mono text-diff-modified-text uppercase">MISMATCHES</div>
          <div className="text-2xl font-display text-diff-modified-text">{reconResult.stats.mismatchedCount}</div>
        </button>

        <button
          onClick={() => setFilterType('MATCH')}
          className={`p-4 border text-left transition-colors ${
            filterType === 'MATCH' ? 'border-diff-added-border bg-diff-added-bg' : 'border-hairline bg-surface-soft'
          }`}
        >
          <div className="text-[10px] font-mono text-diff-added-text uppercase">EXACT MATCHES</div>
          <div className="text-2xl font-display text-diff-added-text">{reconResult.stats.matchedCount}</div>
        </button>

        <button
          onClick={() => setFilterType('ONLY_L')}
          className={`p-4 border text-left transition-colors ${
            filterType === 'ONLY_L' ? 'border-diff-deleted-border bg-diff-deleted-bg' : 'border-hairline bg-surface-soft'
          }`}
        >
          <div className="text-[10px] font-mono text-diff-deleted-text uppercase">LEFT ONLY</div>
          <div className="text-2xl font-display text-diff-deleted-text">{reconResult.stats.onlyACount}</div>
        </button>

        <button
          onClick={() => setFilterType('ONLY_R')}
          className={`p-4 border text-left transition-colors ${
            filterType === 'ONLY_R' ? 'border-link bg-diff-formula-bg' : 'border-hairline bg-surface-soft'
          }`}
        >
          <div className="text-[10px] font-mono text-link uppercase">RIGHT ONLY</div>
          <div className="text-2xl font-display text-link">{reconResult.stats.onlyBCount}</div>
        </button>

        {reconResult.stats.duplicateCount > 0 && (
          <button
            onClick={() => setFilterType('DUPLICATE')}
            className={`p-4 border text-left transition-colors ${
              filterType === 'DUPLICATE' ? 'border-warning bg-surface-card' : 'border-hairline bg-surface-soft'
            }`}
          >
            <div className="text-[10px] font-mono text-warning uppercase">DUPLICATE KEY</div>
            <div className="text-2xl font-display text-warning">{reconResult.stats.duplicateCount}</div>
          </button>
        )}
      </div>

      {reconResult.stats.skippedEmptyKey > 0 && (
        <div className={`text-xs font-mono text-diff-modified-text ${isFullView ? 'shrink-0' : ''}`}>
          {reconResult.stats.skippedEmptyKey} rows skipped (empty key)
        </div>
      )}

      {/* Toolbar: Search + Export */}
      <div className={`bg-surface-card border border-hairline p-4 flex flex-wrap items-center justify-between gap-4 ${isFullView ? 'shrink-0' : ''}`}>
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-muted-soft" />
          <input
            type="text"
            placeholder={t(locale, 'comparison.searchByKeyOrValue', 'SEARCH BY KEY OR VALUE...')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-canvas border border-hairline-strong pl-10 pr-4 py-2 font-mono text-xs text-ink placeholder-muted-soft focus:border-ink focus:outline-none"
          />
        </div>

        <button onClick={exportReconciliationReport} className="btn-primary text-xs whitespace-normal text-center sm:text-left sm:h-9 min-h-[40px] h-auto py-1.5 sm:py-1 px-4">
          <Download className="w-3.5 h-3.5 inline mr-2" />
          <span className="block sm:hidden">{t(locale, 'comparison.exportCsv', 'EXPORT CSV')}</span>
          <span className="hidden sm:block">{t(locale, 'comparison.exportReconciliationCsv', 'EXPORT RECONCILIATION CSV')}</span>
        </button>
      </div>

      {/* Reconciliation Data Table */}
      <div className={`border border-hairline bg-surface-soft flex flex-col ${isFullView ? 'flex-1 min-h-0' : ''}`} style={isFullView ? {} : { height: TABLE_DEFAULT_HEIGHT }}>
        <div 
          ref={parentRef} 
          className="overflow-auto relative" 
          style={{ 
            flex: 1, 
            minHeight: 0,
            minWidth: `${minTableWidth}px`
          }}
        >
          <div style={{ 
            height: virtualizer.getTotalSize() + HEADER_HEIGHT, 
            width: 'max-content',
            minWidth: `${minTableWidth}px`,
            position: 'relative'
          }}>
            {/* Sticky Header */}
            <div 
              className="sticky top-0 z-10 bg-canvas border-b border-hairline"
              style={{ height: HEADER_HEIGHT, display: 'grid', gridTemplateColumns: gridColumns }}
            >
              <div className="px-4 py-2 text-caption text-muted font-semibold truncate flex items-center">PRIMARY KEY / ID</div>
              <div className="px-4 py-2 text-caption text-muted font-semibold truncate flex items-center">LEFT FILE VALUE</div>
              <div className="px-4 py-2 text-caption text-muted font-semibold truncate flex items-center">RIGHT FILE VALUE</div>
              <div className="px-4 py-2 text-caption text-muted font-semibold truncate flex items-center">RECONCILIATION STATUS</div>
              {showDiffColumn && (
                <div className="px-4 py-2 text-caption text-muted font-semibold truncate flex items-center justify-end">DIFFERENCE</div>
              )}
            </div>

            {/* Virtualized Rows */}
            <div style={{ position: 'relative', paddingTop: HEADER_HEIGHT }}>
              {virtualRows.map((virtualRow) => {
                const item = filteredRecords[virtualRow.index];
                const style = getStatusStyle(item.status);
                const label = getStatusLabel(item.status);
                const diff = showDiffColumn ? getNumericDifference(item.valA, item.valB) : null;
                const isNumeric = diff !== null;

                const rowStyle = {
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      transform: `translateY(${virtualRow.start}px)`,
                      height: `${ROW_HEIGHT}px`,
                      display: 'grid',
                      gridTemplateColumns: gridColumns,
                      ...(item.status === 'MATCH' ? {} : { borderLeftColor: style.rowBorder }),
                      backgroundColor: item.status === 'MATCH' ? 'var(--color-surface-soft)' : style.rowBg,
                      color: style.textColor,
                    };

                    return (
                      <div
                        key={`${item.status}:${item.key}:${virtualRow.index}`}
                        style={rowStyle}
                        className={`border-b border-hairline/60 transition-colors hover:bg-surface-hover ${
                          item.status === 'MATCH' ? '' : 'border-l-2'
                        }`}
                      >
                    <div className="px-4 py-2 font-semibold truncate flex items-center min-w-0" title={item.key}>
                      {item.key}
                    </div>
                    <div className={`px-4 py-2 truncate flex items-center min-w-0 ${isNumeric ? 'font-mono tabular-nums text-right pr-4' : ''}`} title={item.valA}>
                      {item.valA || '—'}
                    </div>
                    <div className={`px-4 py-2 truncate flex items-center min-w-0 ${isNumeric ? 'font-mono tabular-nums text-right pr-4' : ''}`} title={item.valB}>
                      {item.status === 'MISMATCH' && item.valA !== item.valB && item.valA !== '-' ? (
                        <>
                          <span className="line-through opacity-60 mr-2">{item.valA}</span>
                          <span className="text-diff-added-text">{item.valB}</span>
                        </>
                      ) : (
                        item.valB || '—'
                      )}
                    </div>
                    <div className="px-4 py-2 flex items-center min-w-0">
                      <span 
                        className={`px-2.5 py-1 text-[10px] font-mono tracking-wider uppercase border ${style.chipBorder} bg-transparent text-[${style.chipText}]`}
                      >
                        {label}
                      </span>
                    </div>
                    {showDiffColumn && (
                      <div className="px-4 py-2 flex items-center justify-end min-w-0">
                        {isNumeric && (
                          <span className={`font-mono tabular-nums ${diff > 0 ? 'text-diff-added-text' : diff < 0 ? 'text-diff-deleted-text' : 'text-muted'}`}>
                            {diff > 0 ? '+' : ''}{diff}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Empty State / Caption */}
        <div className={`p-3 border-t border-hairline bg-surface-soft ${isFullView ? 'shrink-0' : ''}`}>
          {filteredRecords.length === 0 ? (
            <div className="text-center py-8 text-xs font-mono text-muted-soft">
              {reconResult.all.length === 0 
                ? 'No records to display. Check your key/value column selection.' 
                : searchTerm 
                  ? 'No results match your search.' 
                  : filterType !== 'ALL' 
                    ? `No ${filterType.toLowerCase().replace('_', ' ')} records found.` 
                    : 'No records to display.'}
            </div>
          ) : (
            <div className="text-[10px] font-mono text-muted text-right">
              SHOWING {filteredRecords.length} OF {reconResult.all.length} RECORDS
            </div>
          )}
        </div>
      </div>
    </div>
  );
}