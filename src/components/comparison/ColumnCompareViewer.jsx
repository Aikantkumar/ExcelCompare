import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Columns3, CheckCircle2, AlertTriangle, ArrowRight, Download, Search, Maximize, Minimize } from 'lucide-react';
import { compareColumns } from './diffEngine';
import { useFullView } from './useFullView';

export default function ColumnCompareViewer({ sheetA, sheetB }) {
  const [colAIndex, setColAIndex] = useState(0);
  const [colBIndex, setColBIndex] = useState(0);
  const [searchFilter, setSearchFilter] = useState('');
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1024);

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

  const valuesA = useMemo(() => rowsA.slice(1).map((r) => r[colAIndex]?.val).filter(Boolean), [rowsA, colAIndex]);
  const valuesB = useMemo(() => rowsB.slice(1).map((r) => r[colBIndex]?.val).filter(Boolean), [rowsB, colBIndex]);

  const result = useMemo(() => compareColumns(valuesA, valuesB), [valuesA, valuesB]);

  const filterList = useCallback((arr) => {
    if (!searchFilter.trim()) return arr;
    return arr.filter((v) => String(v).toLowerCase().includes(searchFilter.toLowerCase()));
  }, [searchFilter]);

  const exportSetCsv = useCallback((filename, list) => {
    const csvContent = 'data:text/csv;charset=utf-8,' + list.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const rootClassName = isFullView
    ? 'fixed left-0 top-0 right-0 bottom-0 z-[60] bg-[#000000] h-[100dvh] flex flex-col gap-4 p-4 overflow-y-auto [padding-bottom:env(safe-area-inset-bottom)] [padding-top:env(safe-area-inset-top)]'
    : 'space-y-6';

  const panelClassName = isFullView ? 'shrink-0' : '';
  const resultsAreaClassName = isFullView ? 'flex-1 min-h-0' : '';
  const listScrollClassName = isFullView ? 'flex-1 min-h-0 overflow-y-auto' : 'max-h-96 overflow-y-auto';

  return (
    <div className={rootClassName}>
      {/* Column Pickers Header */}
      <div className={`bg-[#141414] border border-[#262626] p-3 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 ${panelClassName}`}>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-caption text-white mb-0 block">SELECT COLUMN FROM LEFT FILE:</label>
            <button
              onClick={toggleFullView}
              className={`px-3 py-1.5 text-xs font-mono tracking-wider uppercase border rounded transition-all flex items-center gap-1 ${
                isFullView
                  ? 'border-[#5fa657] text-[#5fa657] bg-[#062c19]'
                  : 'border-[#3a3a3a] text-[#999999] hover:border-white hover:text-white'
              }`}
              title={isFullView ? 'Exit Full View' : 'Enter Full View'}
              aria-pressed={isFullView}
              aria-label={isFullView ? 'Exit Full View' : 'Enter Full View'}
            >
              {isFullView ? <Minimize className="w-3.5 h-3.5 inline" /> : <Maximize className="w-3.5 h-3.5 inline" />}
              <span className="ml-1 text-[11px] font-bold hidden sm:inline">
                {isFullView ? 'EXIT FULL VIEW' : 'FULL VIEW'}
              </span>
            </button>
          </div>
          <select
            value={colAIndex}
            onChange={(e) => setColAIndex(Number(e.target.value))}
            className="w-full bg-[#000000] border border-[#3a3a3a] text-white p-3 font-mono text-sm focus:border-white focus:outline-none"
          >
            {headersA.map((h, i) => (
              <option key={i} value={i}>
                Col {String.fromCharCode(65 + i)}: {h}
              </option>
            ))}
          </select>
          <div className="text-xs font-mono text-[#999999] mt-2">
            Total Items: {valuesA.length} | Unique: {result.stats.totalA}
          </div>
        </div>

        <div>
          <label className="text-caption text-white mb-2 block">SELECT COLUMN FROM RIGHT FILE:</label>
          <select
            value={colBIndex}
            onChange={(e) => setColBIndex(Number(e.target.value))}
            className="w-full bg-[#000000] border border-[#3a3a3a] text-white p-3 font-mono text-sm focus:border-white focus:outline-none"
          >
            {headersB.map((h, i) => (
              <option key={i} value={i}>
                Col {String.fromCharCode(65 + i)}: {h}
              </option>
            ))}
          </select>
          <div className="text-xs font-mono text-[#999999] mt-2">
            Total Items: {valuesB.length} | Unique: {result.stats.totalB}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className={`grid grid-cols-1 sm:grid-cols-3 gap-4 ${panelClassName}`}>
        <div className="bg-[#062c19] border border-[#047857] p-3 sm:p-5 space-y-1">
          <div className="text-caption text-[#6ee7b7]">INTERSECTION (EXISTS IN BOTH)</div>
          <div className="text-3xl font-display text-[#6ee7b7]">{result.stats.intersectionCount}</div>
          <div className="text-xs font-mono text-[#999999]">Matching unique items</div>
        </div>

        <div className="bg-[#3b1219] border border-[#b91c1c] p-3 sm:p-5 space-y-1">
          <div className="text-caption text-[#fca5a5]">ONLY IN LEFT COLUMN</div>
          <div className="text-3xl font-display text-[#fca5a5]">{result.stats.onlyInACount}</div>
          <div className="text-xs font-mono text-[#999999]">Missing from right file</div>
        </div>

        <div className="bg-[#2d2208] border border-[#78350f] p-3 sm:p-5 space-y-1">
          <div className="text-caption text-[#fcd34d]">ONLY IN RIGHT COLUMN</div>
          <div className="text-3xl font-display text-[#fcd34d]">{result.stats.onlyInBCount}</div>
          <div className="text-xs font-mono text-[#999999]">Missing from left file</div>
        </div>
      </div>

      {/* Search Filter */}
      <div className={`relative ${panelClassName}`}>
        <Search className="w-4 h-4 absolute left-3 top-3.5 text-[#666666]" />
        <input
          type="text"
          placeholder="SEARCH VALUES ACROSS SETS..."
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          className="w-full bg-[#0d0d0d] border border-[#262626] pl-10 pr-4 py-3 font-mono text-xs text-white placeholder-[#666666] focus:border-white focus:outline-none"
        />
      </div>

      {/* 3-Column Breakdown Grids */}
      <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 ${resultsAreaClassName}`}>
        {/* Column 1: Intersection */}
        <div className="border border-[#262626] bg-[#0d0d0d] flex flex-col">
          <div className="bg-[#141414] p-3 border-b border-[#262626] flex items-center justify-between shrink-0">
            <span className="text-xs font-mono uppercase text-[#6ee7b7]">INTERSECTION ({result.intersection.length})</span>
            <button
              onClick={() => exportSetCsv('intersection.csv', result.intersection)}
              className="text-[10px] font-mono text-[#999999] hover:text-white flex items-center gap-1"
            >
              <Download className="w-3 h-3" /> CSV
            </button>
          </div>
          <div className={`${listScrollClassName} p-2 font-mono text-xs space-y-1`}>
            {filterList(result.intersection).map((val, idx) => (
              <div key={idx} className="bg-[#062c19]/50 text-[#6ee7b7] p-2 border-l-2 border-[#047857]">
                {val}
              </div>
            ))}
            {result.intersection.length === 0 && (
              <div className="text-[#666666] p-4 text-center">No common items found</div>
            )}
          </div>
        </div>

        {/* Column 2: Only Left */}
        <div className="border border-[#262626] bg-[#0d0d0d] flex flex-col">
          <div className="bg-[#141414] p-3 border-b border-[#262626] flex items-center justify-between shrink-0">
            <span className="text-xs font-mono uppercase text-[#fca5a5]">ONLY LEFT ({result.onlyInA.length})</span>
            <button
              onClick={() => exportSetCsv('only_left.csv', result.onlyInA)}
              className="text-[10px] font-mono text-[#999999] hover:text-white flex items-center gap-1"
            >
              <Download className="w-3 h-3" /> CSV
            </button>
          </div>
          <div className={`${listScrollClassName} p-2 font-mono text-xs space-y-1`}>
            {filterList(result.onlyInA).map((val, idx) => (
              <div key={idx} className="bg-[#3b1219]/50 text-[#fca5a5] p-2 border-l-2 border-[#b91c1c]">
                {val}
              </div>
            ))}
            {result.onlyInA.length === 0 && (
              <div className="text-[#666666] p-4 text-center">No unique left items</div>
            )}
          </div>
        </div>

        {/* Column 3: Only Right */}
        <div className="border border-[#262626] bg-[#0d0d0d] flex flex-col">
          <div className="bg-[#141414] p-3 border-b border-[#262626] flex items-center justify-between shrink-0">
            <span className="text-xs font-mono uppercase text-[#fcd34d]">ONLY RIGHT ({result.onlyInB.length})</span>
            <button
              onClick={() => exportSetCsv('only_right.csv', result.onlyInB)}
              className="text-[10px] font-mono text-[#999999] hover:text-white flex items-center gap-1"
            >
              <Download className="w-3 h-3" /> CSV
            </button>
          </div>
          <div className={`${listScrollClassName} p-2 font-mono text-xs space-y-1`}>
            {filterList(result.onlyInB).map((val, idx) => (
              <div key={idx} className="bg-[#2d2208]/50 text-[#fcd34d] p-2 border-l-2 border-[#78350f]">
                {val}
              </div>
            ))}
            {result.onlyInB.length === 0 && (
              <div className="text-[#666666] p-4 text-center">No unique right items</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
