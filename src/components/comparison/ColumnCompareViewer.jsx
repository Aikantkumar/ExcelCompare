import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Columns3, CheckCircle2, AlertTriangle, ArrowRight, Download, FileText, Search, Maximize, Minimize, ChevronDown } from 'lucide-react';
import { compareColumnsDetailed } from './diffEngine';
import { buildColumnsExport } from './exportBuilders';
import { toCsv, downloadBlob, buildFilename } from './exportUtils';
import { useFullView } from './useFullView';
import { t } from '../../utils/translations';
import * as XLSX from 'xlsx';

export default function ColumnCompareViewer({ sheetA, sheetB, locale = 'en' }) {
  const [colAIndex, setColAIndex] = useState(0);
  const [colBIndex, setColBIndex] = useState(0);
  const [searchFilter, setSearchFilter] = useState('');
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1024);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  const { isFullView, toggleFullView, exitFullView } = useFullView({ isDesktop });

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const rowsA = sheetA?.rows || [];
  const rowsB = sheetB?.rows || [];

  const headersA = useMemo(() => rowsA[0]?.map((c, i) => c.val || `Col ${String.fromCharCode(65 + i)}`) || ['Col A'], [rowsA]);
  const headersB = useMemo(() => rowsB[0]?.map((c, i) => c.val || `Col ${String.fromCharCode(65 + i)}`) || ['Col B'], [rowsB]);

  // Keep numeric 0: only skip null, undefined and "" (do not .filter(Boolean)).
  const valuesA = useMemo(() => rowsA.slice(1).map((r) => r[colAIndex]?.val), [rowsA, colAIndex]);
  const valuesB = useMemo(() => rowsB.slice(1).map((r) => r[colBIndex]?.val), [rowsB, colBIndex]);

  const result = useMemo(() => compareColumnsDetailed(rowsA, colAIndex, rowsB, colBIndex), [rowsA, colAIndex, rowsB, colBIndex]);

  const headerLeftName = headersA[colAIndex] || 'Left Column';
  const headerRightName = headersB[colBIndex] || 'Right Column';

  const filterList = useCallback((arr) => {
    if (!searchFilter.trim()) return arr;
    return arr.filter((v) => String(v).toLowerCase().includes(searchFilter.toLowerCase()));
  }, [searchFilter]);

  const csvColumns = useMemo(() => [
    { key: 'set', header: 'Result Set' },
    { key: 'value', header: 'Value' },
    { key: 'leftColumn', header: 'Left Column' },
    { key: 'rightColumn', header: 'Right Column' },
    { key: 'leftRows', header: 'Left Rows' },
    { key: 'rightRows', header: 'Right Rows' },
    { key: 'leftCount', header: 'Left Count' },
    { key: 'rightCount', header: 'Right Count' },
  ], []);

  const setRowsFor = useCallback((label, values) => {
    return values.map((v) => ({
      set: label,
      value: v === undefined ? '' : v,
      leftColumn: headerLeftName,
      rightColumn: headerRightName,
      leftRows: (result?.leftOccurrences?.get(v) || []).join('; '),
      rightRows: (result?.rightOccurrences?.get(v) || []).join('; '),
      leftCount: (result?.leftOccurrences?.get(v) || []).length,
      rightCount: (result?.rightOccurrences?.get(v) || []).length,
    }));
  }, [result, headerLeftName, headerRightName]);

  const exportSetCsv = useCallback((label, values, filename) => {
    if (!values || values.length === 0) return;
    const rows = setRowsFor(label, values);
    const content = toCsv(csvColumns, rows);
    downloadBlob(new Blob([content], { type: 'text/csv;charset=utf-8;' }), filename);
  }, [setRowsFor, csvColumns]);

  const exportAllCsv = useCallback(() => {
    const resultExport = buildColumnsExport(result, {
      fileA: 'File A',
      fileB: 'File B',
      sheetA: 'Sheet 1',
      sheetB: 'Sheet 1',
      columnA: headerLeftName,
      columnB: headerRightName,
    });
    downloadBlob(new Blob([resultExport.csv.content], { type: 'text/csv;charset=utf-8;' }), resultExport.csv.filename);
  }, [result, headerLeftName, headerRightName]);

  const exportAllXlsx = useCallback(() => {
    const resultExport = buildColumnsExport(result, {
      fileA: 'File A',
      fileB: 'File B',
      sheetA: 'Sheet 1',
      sheetB: 'Sheet 1',
      columnA: headerLeftName,
      columnB: headerRightName,
    });
    if (resultExport.workbook) {
      XLSX.writeFile(resultExport.workbook, resultExport.xlsxFilename);
    }
  }, [result, headerLeftName, headerRightName]);

  const rootClassName = isFullView
    ? 'fixed left-0 top-0 right-0 bottom-0 z-[60] bg-canvas h-[100dvh] flex flex-col gap-4 p-4 overflow-y-auto [padding-bottom:env(safe-area-inset-bottom)] [padding-top:env(safe-area-inset-top)]'
    : 'space-y-6';

  const panelClassName = isFullView ? 'shrink-0' : '';
  const resultsAreaClassName = isFullView ? 'flex-1 min-h-0' : '';
  const listScrollClassName = isFullView ? 'flex-1 min-h-0 overflow-y-auto' : 'max-h-96 overflow-y-auto';

  const intersection = result?.intersection || [];
  const onlyInLeft = result?.onlyInLeft || [];
  const onlyInRight = result?.onlyInRight || [];
  const stats = result?.stats || {};

  return (
    <div className={rootClassName}>
      {/* Column Pickers Header */}
      <div className={`bg-surface-card border border-hairline p-3 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 ${panelClassName}`}>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-caption text-ink mb-0 block">{t(locale, 'comparison.selectColumnLeft', 'SELECT COLUMN FROM LEFT FILE:')}</label>
            <button
              onClick={toggleFullView}
              className={`px-3 py-1.5 text-xs font-mono tracking-wider uppercase border rounded transition-all flex items-center gap-1 ${
                isFullView
                  ? 'border-success text-success bg-diff-added-bg'
                  : 'border-hairline-strong text-muted hover:border-ink hover:text-ink'
              }`}
              title={isFullView ? t(locale, 'comparison.exitFullView', 'EXIT FULL VIEW') : t(locale, 'comparison.fullView', 'ENTER FULL VIEW')}
              aria-pressed={isFullView}
              aria-label={isFullView ? t(locale, 'comparison.exitFullView', 'EXIT FULL VIEW') : t(locale, 'comparison.fullView', 'ENTER FULL VIEW')}
            >
              {isFullView ? <Minimize className="w-3.5 h-3.5 inline" /> : <Maximize className="w-3.5 h-3.5 inline" />}
              <span className="ml-1 text-[11px] font-bold hidden sm:inline">
                {isFullView ? t(locale, 'comparison.exitFullView', 'EXIT FULL VIEW') : t(locale, 'comparison.fullView', 'FULL VIEW')}
              </span>
            </button>
          </div>
          <select
            value={colAIndex}
            onChange={(e) => setColAIndex(Number(e.target.value))}
            className="w-full bg-canvas border border-hairline-strong text-ink p-3 font-mono text-sm focus:border-ink focus:outline-none"
          >
            {headersA.map((h, i) => (
              <option key={i} value={i}>
                {t(locale, 'comparison.colLabel', 'Col {letter}: {name}').replace('{letter}', String.fromCharCode(65 + i)).replace('{name}', h)}
              </option>
            ))}
          </select>
            <div className="text-xs font-mono text-muted mt-2">
              {t(locale, 'comparison.totalItems', 'Total Items:')} {valuesA.length} | {t(locale, 'comparison.unique', 'Unique:')} {stats.totalA}
            </div>
        </div>

        <div>
          <label className="text-caption text-ink mb-2 block">{t(locale, 'comparison.selectColumnRight', 'SELECT COLUMN FROM RIGHT FILE:')}</label>
          <select
            value={colBIndex}
            onChange={(e) => setColBIndex(Number(e.target.value))}
            className="w-full bg-canvas border border-hairline-strong text-ink p-3 font-mono text-sm focus:border-ink focus:outline-none"
          >
            {headersB.map((h, i) => (
              <option key={i} value={i}>
                {t(locale, 'comparison.colLabel', 'Col {letter}: {name}').replace('{letter}', String.fromCharCode(65 + i)).replace('{name}', h)}
              </option>
            ))}
          </select>
          <div className="text-xs font-mono text-muted mt-2">
            {t(locale, 'comparison.totalItems', 'Total Items:')} {valuesB.length} | {t(locale, 'comparison.unique', 'Unique:')} {stats.totalB}
          </div>
        </div>
      </div>

      {/* Summary Cards + Export All */}
      <div className={`grid grid-cols-1 sm:grid-cols-3 gap-4 ${panelClassName}`}>
        <div className="bg-diff-added-bg border border-diff-added-border p-3 sm:p-5 space-y-1">
          <div className="text-caption text-diff-added-text">{t(locale, 'comparison.intersectionExistsInBoth', 'INTERSECTION (EXISTS IN BOTH)')}</div>
          <div className="text-3xl font-display text-diff-added-text">{stats.intersectionCount}</div>
          <div className="text-xs font-mono text-muted">{t(locale, 'comparison.matchingUniqueItems', 'Matching unique items')}</div>
        </div>

        <div className="bg-diff-deleted-bg border border-diff-deleted-border p-3 sm:p-5 space-y-1">
          <div className="text-caption text-diff-deleted-text">{t(locale, 'comparison.onlyInLeftColumn', 'ONLY IN LEFT COLUMN')}</div>
          <div className="text-3xl font-display text-diff-deleted-text">{stats.onlyInLeftCount}</div>
          <div className="text-xs font-mono text-muted">{t(locale, 'comparison.missingFromRight', 'Missing from right file')}</div>
        </div>

        <div className="bg-diff-modified-bg border border-diff-modified-border p-3 sm:p-5 space-y-1">
          <div className="text-caption text-diff-modified-text">{t(locale, 'comparison.onlyInRightColumn', 'ONLY IN RIGHT COLUMN')}</div>
          <div className="text-3xl font-display text-diff-modified-text">{stats.onlyInRightCount}</div>
          <div className="text-xs font-mono text-muted">{t(locale, 'comparison.missingFromLeft', 'Missing from left file')}</div>
        </div>
      </div>

      {/* Export All toolbar */}
      <div className={`bg-surface-card border border-hairline p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 ${panelClassName}`}>
        <div className="flex items-center gap-3">
          <button
            onClick={exportAllCsv}
            disabled={intersection.length === 0 && onlyInLeft.length === 0 && onlyInRight.length === 0}
            className="btn-primary text-xs h-9 px-5 flex items-center gap-1"
            title={t(locale, 'comparison.exportAllCsv', 'Export all (CSV)')}
          >
            <Download className="w-3.5 h-3.5 inline mr-1" />
            {t(locale, 'comparison.exportAllCsv', 'EXPORT ALL (CSV)')}
          </button>
          <button
            onClick={exportAllXlsx}
            disabled={intersection.length === 0 && onlyInLeft.length === 0 && onlyInRight.length === 0}
            className="btn-secondary text-xs h-9 px-5 flex items-center gap-1"
            title={t(locale, 'comparison.exportAllXlsx', 'Export all (XLSX)')}
          >
            <FileText className="w-3.5 h-3.5 inline mr-1" />
            {t(locale, 'comparison.exportAllXlsx', 'EXPORT ALL (.XLSX)')}
          </button>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono text-muted">
          <span>{t(locale, 'comparison.exportColumnsSetTooltip', 'Per-set CSV buttons export that result set only.')}</span>
        </div>
      </div>

      {/* Search Filter */}
      <div className={`relative ${panelClassName}`}>
        <Search className="w-4 h-4 absolute left-3 top-3.5 text-muted-soft" />
        <input
          type="text"
          placeholder={t(locale, 'comparison.searchValuesAcrossSets', 'SEARCH VALUES ACROSS SETS...')}
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          className="w-full bg-surface-soft border border-hairline pl-10 pr-4 py-3 font-mono text-xs text-ink placeholder-muted-soft focus:border-ink focus:outline-none"
        />
      </div>

      {/* 3-Column Breakdown Grids */}
      <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 ${resultsAreaClassName}`}>
        {/* Column 1: Intersection */}
        <div className="border border-hairline bg-surface-soft flex flex-col">
          <div className="bg-surface-card p-3 border-b border-hairline flex items-center justify-between shrink-0">
            <span className="text-xs font-mono uppercase text-diff-added-text">{t(locale, 'comparison.intersectionHeader', 'INTERSECTION ({count})').replace('{count}', intersection.length)}</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => exportSetCsv('INTERSECTION', intersection, `column_intersection_${buildFilename({ mode: 'columns', left: 'a', right: 'b', part: 'intersection', ext: 'csv' })}`)}
                disabled={intersection.length === 0}
                className="text-[10px] font-mono text-muted hover:text-ink flex items-center gap-1 disabled:opacity-50 disabled:pointer-events-none"
              >
                <Download className="w-3 h-3" /> {t(locale, 'comparison.csvBtn', 'CSV')}
              </button>
            </div>
          </div>
          <div className={`${listScrollClassName} p-2 font-mono text-xs space-y-1`}>
            {filterList(intersection).map((val, idx) => (
              <div key={idx} className="bg-diff-added-bg/50 text-diff-added-text p-2 border-l-2 border-diff-added-border">
                {val}
              </div>
            ))}
            {intersection.length === 0 && (
              <div className="text-muted-soft p-4 text-center">{t(locale, 'comparison.noCommonItems', 'No common items found')}</div>
            )}
          </div>
        </div>

        {/* Column 2: Only Left */}
        <div className="border border-hairline bg-surface-soft flex flex-col">
          <div className="bg-surface-card p-3 border-b border-hairline flex items-center justify-between shrink-0">
            <span className="text-xs font-mono uppercase text-diff-deleted-text">{t(locale, 'comparison.onlyLeftHeader', 'ONLY LEFT ({count})').replace('{count}', onlyInLeft.length)}</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => exportSetCsv('ONLY_IN_LEFT', onlyInLeft, `column_only_left_${buildFilename({ mode: 'columns', left: 'a', right: 'b', part: 'only-left', ext: 'csv' })}`)}
                disabled={onlyInLeft.length === 0}
                className="text-[10px] font-mono text-muted hover:text-ink flex items-center gap-1 disabled:opacity-50 disabled:pointer-events-none"
              >
                <Download className="w-3 h-3" /> {t(locale, 'comparison.csvBtn', 'CSV')}
              </button>
            </div>
          </div>
          <div className={`${listScrollClassName} p-2 font-mono text-xs space-y-1`}>
            {filterList(onlyInLeft).map((val, idx) => (
              <div key={idx} className="bg-diff-deleted-bg/50 text-diff-deleted-text p-2 border-l-2 border-diff-deleted-border">
                {val}
              </div>
            ))}
            {onlyInLeft.length === 0 && (
              <div className="text-muted-soft p-4 text-center">{t(locale, 'comparison.noUniqueLeftItems', 'No unique left items')}</div>
            )}
          </div>
        </div>

        {/* Column 3: Only Right */}
        <div className="border border-hairline bg-surface-soft flex flex-col">
          <div className="bg-surface-card p-3 border-b border-hairline flex items-center justify-between shrink-0">
            <span className="text-xs font-mono uppercase text-diff-modified-text">{t(locale, 'comparison.onlyRightHeader', 'ONLY RIGHT ({count})').replace('{count}', onlyInRight.length)}</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => exportSetCsv('ONLY_IN_RIGHT', onlyInRight, `column_only_right_${buildFilename({ mode: 'columns', left: 'a', right: 'b', part: 'only-right', ext: 'csv' })}`)}
                disabled={onlyInRight.length === 0}
                className="text-[10px] font-mono text-muted hover:text-ink flex items-center gap-1 disabled:opacity-50 disabled:pointer-events-none"
              >
                <Download className="w-3 h-3" /> {t(locale, 'comparison.csvBtn', 'CSV')}
              </button>
            </div>
          </div>
          <div className={`${listScrollClassName} p-2 font-mono text-xs space-y-1`}>
            {filterList(onlyInRight).map((val, idx) => (
              <div key={idx} className="bg-diff-modified-bg/50 text-diff-modified-text p-2 border-l-2 border-diff-modified-border">
                {val}
              </div>
            ))}
            {onlyInRight.length === 0 && (
              <div className="text-muted-soft p-4 text-center">{t(locale, 'comparison.noUniqueRightItems', 'No unique right items')}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
