import React, { useState } from 'react';
import { Columns3, CheckCircle2, AlertTriangle, ArrowRight, Download, Search } from 'lucide-react';
import { compareColumns } from './diffEngine';

export default function ColumnCompareViewer({ sheetA, sheetB }) {
  const [colAIndex, setColAIndex] = useState(0);
  const [colBIndex, setColBIndex] = useState(0);
  const [searchFilter, setSearchFilter] = useState('');

  const rowsA = sheetA?.rows || [];
  const rowsB = sheetB?.rows || [];

  const headersA = rowsA[0]?.map((c, i) => c.val || `Col ${String.fromCharCode(65 + i)}`) || ['Col A'];
  const headersB = rowsB[0]?.map((c, i) => c.val || `Col ${String.fromCharCode(65 + i)}`) || ['Col B'];

  const valuesA = rowsA.slice(1).map((r) => r[colAIndex]?.val).filter(Boolean);
  const valuesB = rowsB.slice(1).map((r) => r[colBIndex]?.val).filter(Boolean);

  const result = compareColumns(valuesA, valuesB);

  const filterList = (arr) => {
    if (!searchFilter.trim()) return arr;
    return arr.filter((v) => String(v).toLowerCase().includes(searchFilter.toLowerCase()));
  };

  const exportSetCsv = (filename, list) => {
    const csvContent = 'data:text/csv;charset=utf-8,' + list.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Column Pickers Header */}
      <div className="bg-[#141414] border border-[#262626] p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="text-caption text-white mb-2 block">SELECT COLUMN FROM LEFT FILE:</label>
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#062c19] border border-[#047857] p-5 space-y-1">
          <div className="text-caption text-[#6ee7b7]">INTERSECTION (EXISTS IN BOTH)</div>
          <div className="text-3xl font-display text-[#6ee7b7]">{result.stats.intersectionCount}</div>
          <div className="text-xs font-mono text-[#999999]">Matching unique items</div>
        </div>

        <div className="bg-[#3b1219] border border-[#b91c1c] p-5 space-y-1">
          <div className="text-caption text-[#fca5a5]">ONLY IN LEFT COLUMN</div>
          <div className="text-3xl font-display text-[#fca5a5]">{result.stats.onlyInACount}</div>
          <div className="text-xs font-mono text-[#999999]">Missing from right file</div>
        </div>

        <div className="bg-[#2d2208] border border-[#78350f] p-5 space-y-1">
          <div className="text-caption text-[#fcd34d]">ONLY IN RIGHT COLUMN</div>
          <div className="text-3xl font-display text-[#fcd34d]">{result.stats.onlyInBCount}</div>
          <div className="text-xs font-mono text-[#999999]">Missing from left file</div>
        </div>
      </div>

      {/* Search Filter */}
      <div className="relative">
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Column 1: Intersection */}
        <div className="border border-[#262626] bg-[#0d0d0d]">
          <div className="bg-[#141414] p-3 border-b border-[#262626] flex items-center justify-between">
            <span className="text-xs font-mono uppercase text-[#6ee7b7]">INTERSECTION ({result.intersection.length})</span>
            <button
              onClick={() => exportSetCsv('intersection.csv', result.intersection)}
              className="text-[10px] font-mono text-[#999999] hover:text-white flex items-center gap-1"
            >
              <Download className="w-3 h-3" /> CSV
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto p-2 font-mono text-xs space-y-1">
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
        <div className="border border-[#262626] bg-[#0d0d0d]">
          <div className="bg-[#141414] p-3 border-b border-[#262626] flex items-center justify-between">
            <span className="text-xs font-mono uppercase text-[#fca5a5]">ONLY LEFT ({result.onlyInA.length})</span>
            <button
              onClick={() => exportSetCsv('only_left.csv', result.onlyInA)}
              className="text-[10px] font-mono text-[#999999] hover:text-white flex items-center gap-1"
            >
              <Download className="w-3 h-3" /> CSV
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto p-2 font-mono text-xs space-y-1">
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
        <div className="border border-[#262626] bg-[#0d0d0d]">
          <div className="bg-[#141414] p-3 border-b border-[#262626] flex items-center justify-between">
            <span className="text-xs font-mono uppercase text-[#fcd34d]">ONLY RIGHT ({result.onlyInB.length})</span>
            <button
              onClick={() => exportSetCsv('only_right.csv', result.onlyInB)}
              className="text-[10px] font-mono text-[#999999] hover:text-white flex items-center gap-1"
            >
              <Download className="w-3 h-3" /> CSV
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto p-2 font-mono text-xs space-y-1">
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
