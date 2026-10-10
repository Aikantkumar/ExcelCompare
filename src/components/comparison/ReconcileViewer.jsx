import React, { useState, useMemo } from 'react';
import { KeyRound, ShieldCheck, Filter, Download, Search } from 'lucide-react';
import { reconcileSheets } from './diffEngine';
import { VirtualizedTableBody } from './VirtualizedTable';

export default function ReconcileViewer({ sheetA, sheetB }) {
  const [keyColIndex, setKeyColIndex] = useState(0);
  const [valColIndex, setValColIndex] = useState(1);
  const [filterType, setFilterType] = useState('ALL'); // 'ALL' | 'MISMATCH' | 'MATCH' | 'ONLY_L' | 'ONLY_R'
  const [searchTerm, setSearchTerm] = useState('');

  const rowsA = sheetA?.rows || [];
  const rowsB = sheetB?.rows || [];

  const headersA = rowsA[0]?.map((c, i) => c.val || `Col ${String.fromCharCode(65 + i)}`) || ['ID Col', 'Value Col'];

  const reconResult = reconcileSheets(sheetA, sheetB, keyColIndex, valColIndex);

  const filteredRecords = reconResult.all.filter((item) => {
    if (filterType === 'MISMATCH' && item.status !== 'MISMATCH') return false;
    if (filterType === 'MATCH' && item.status !== 'MATCH') return false;
    if (filterType === 'ONLY_L' && item.status !== 'ONLY_LEFT') return false;
    if (filterType === 'ONLY_R' && item.status !== 'ONLY_RIGHT') return false;

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

  const exportReconciliationReport = () => {
    const csvHeader = 'Key / ID,Value (Left File),Value (Right File),Reconciliation Status\n';
    const csvRows = reconResult.all
      .map((r) => `"${r.key}","${r.valA}","${r.valB}","${r.status}"`)
      .join('\n');

    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvHeader + csvRows);
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', `reconciliation_report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Key & Value Column Matcher Config */}
      <div className="bg-[#141414] border border-[#262626] p-6 space-y-4">
        <div className="flex items-center gap-2 text-title-sm text-white">
          <KeyRound className="w-5 h-5 text-[#c3d9f3]" />
          ID-BASED RECONCILIATION CONFIGURATION
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          <div>
            <label className="text-caption text-white mb-2 block">PRIMARY KEY / ID COLUMN:</label>
            <select
              value={keyColIndex}
              onChange={(e) => setKeyColIndex(Number(e.target.value))}
              className="w-full bg-[#000000] border border-[#3a3a3a] text-white p-3 font-mono text-sm focus:border-white focus:outline-none"
            >
              {headersA.map((h, i) => (
                <option key={i} value={i}>
                  Col {String.fromCharCode(65 + i)}: {h}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-caption text-white mb-2 block">VALUE COLUMN TO RECONCILE:</label>
            <select
              value={valColIndex}
              onChange={(e) => setValColIndex(Number(e.target.value))}
              className="w-full bg-[#000000] border border-[#3a3a3a] text-white p-3 font-mono text-sm focus:border-white focus:outline-none"
            >
              {headersA.map((h, i) => (
                <option key={i} value={i}>
                  Col {String.fromCharCode(65 + i)}: {h}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Summary Filter Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <button
          onClick={() => setFilterType('ALL')}
          className={`p-4 border text-left transition-colors ${
            filterType === 'ALL' ? 'border-white bg-[#1f1f1f]' : 'border-[#262626] bg-[#0d0d0d]'
          }`}
        >
          <div className="text-[10px] font-mono text-[#999999] uppercase">TOTAL RECORDS</div>
          <div className="text-2xl font-display text-white">{reconResult.all.length}</div>
        </button>

        <button
          onClick={() => setFilterType('MISMATCH')}
          className={`p-4 border text-left transition-colors ${
            filterType === 'MISMATCH' ? 'border-[#fcd34d] bg-[#2d2208]' : 'border-[#262626] bg-[#0d0d0d]'
          }`}
        >
          <div className="text-[10px] font-mono text-[#fcd34d] uppercase">MISMATCHES</div>
          <div className="text-2xl font-display text-[#fcd34d]">{reconResult.stats.mismatchedCount}</div>
        </button>

        <button
          onClick={() => setFilterType('MATCH')}
          className={`p-4 border text-left transition-colors ${
            filterType === 'MATCH' ? 'border-[#6ee7b7] bg-[#062c19]' : 'border-[#262626] bg-[#0d0d0d]'
          }`}
        >
          <div className="text-[10px] font-mono text-[#6ee7b7] uppercase">EXACT MATCHES</div>
          <div className="text-2xl font-display text-[#6ee7b7]">{reconResult.stats.matchedCount}</div>
        </button>

        <button
          onClick={() => setFilterType('ONLY_L')}
          className={`p-4 border text-left transition-colors ${
            filterType === 'ONLY_L' ? 'border-[#fca5a5] bg-[#3b1219]' : 'border-[#262626] bg-[#0d0d0d]'
          }`}
        >
          <div className="text-[10px] font-mono text-[#fca5a5] uppercase">LEFT ONLY</div>
          <div className="text-2xl font-display text-[#fca5a5]">{reconResult.stats.onlyACount}</div>
        </button>

        <button
          onClick={() => setFilterType('ONLY_R')}
          className={`p-4 border text-left transition-colors ${
            filterType === 'ONLY_R' ? 'border-[#a5b4fc] bg-[#1e1b4b]' : 'border-[#262626] bg-[#0d0d0d]'
          }`}
        >
          <div className="text-[10px] font-mono text-[#a5b4fc] uppercase">RIGHT ONLY</div>
          <div className="text-2xl font-display text-[#a5b4fc]">{reconResult.stats.onlyBCount}</div>
        </button>
      </div>

      {/* Toolbar: Search + Export */}
      <div className="bg-[#141414] border border-[#262626] p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-[#666666]" />
          <input
            type="text"
            placeholder="SEARCH BY KEY OR VALUE..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#000000] border border-[#3a3a3a] pl-10 pr-4 py-2 font-mono text-xs text-white placeholder-[#666666] focus:border-white focus:outline-none"
          />
        </div>

        <button onClick={exportReconciliationReport} className="btn-primary text-xs h-9 py-1 px-4">
          <Download className="w-3.5 h-3.5 inline mr-2" />
          EXPORT RECONCILIATION CSV
        </button>
      </div>

      {/* Reconciliation Data Table - Virtualized */}
      <div className="border border-[#262626] bg-[#0d0d0d]" style={{ height: 620 }}>
        {/* Sticky Header */}
        <div className="sticky top-0 z-20 bg-[#000000] border-b border-[#262626]">
          <table className="w-full border-collapse text-xs font-mono">
            <thead>
              <tr className="text-[#999999]">
                <th className="py-3 px-4 text-left font-normal uppercase sticky left-0 bg-[#000000] z-10 min-w-[200px]">PRIMARY KEY / ID</th>
                <th className="py-3 px-4 text-left font-normal uppercase min-w-[200px]">LEFT FILE VALUE</th>
                <th className="py-3 px-4 text-left font-normal uppercase min-w-[200px]">RIGHT FILE VALUE</th>
                <th className="py-3 px-4 text-left font-normal uppercase min-w-[200px]">RECONCILIATION STATUS</th>
              </tr>
            </thead>
          </table>
        </div>
        <VirtualizedTableBody
          rows={filteredRecords}
          columns={[
            { key: 'key', minWidth: '200px', width: '200px' },
            { key: 'valA', minWidth: '200px', width: '200px' },
            { key: 'valB', minWidth: '200px', width: '200px' },
            { key: 'status', minWidth: '200px', width: '200px' },
          ]}
          rowHeight={40}
          containerHeight={620}
          overscan={5}
          estimatedRowSize={() => 40}
          renderCell={(item, cIdx) => {
            let bg = 'bg-[#000000]';
            let badgeBg = 'bg-[#1f1f1f] text-white';

            if (item.status === 'MISMATCH') {
              bg = 'bg-[#2d2208] text-[#fcd34d]';
              badgeBg = 'bg-[#78350f] text-[#fcd34d]';
            } else if (item.status === 'MATCH') {
              bg = 'bg-[#000000] text-[#cccccc]';
              badgeBg = 'bg-[#047857] text-[#6ee7b7]';
            } else if (item.status === 'ONLY_LEFT') {
              bg = 'bg-[#3b1219] text-[#fca5a5]';
              badgeBg = 'bg-[#b91c1c] text-[#fca5a5]';
            } else if (item.status === 'ONLY_RIGHT') {
              bg = 'bg-[#1e1b4b] text-[#a5b4fc]';
              badgeBg = 'bg-[#4338ca] text-[#a5b4fc]';
            }

            switch (cIdx) {
              case 0:
                return <td className={`py-3 px-4 font-semibold ${bg}`}>{item.key}</td>;
              case 1:
                return <td className={`py-3 px-4 ${bg}`}>{item.valA}</td>;
              case 2:
                return <td className={`py-3 px-4 ${bg}`}>{item.valB}</td>;
              case 3:
                return (
                  <td className={`py-3 px-4 ${bg}`}>
                    <span className={`px-2.5 py-1 text-[10px] font-mono tracking-wider uppercase border border-current ${badgeBg}`}>
                      {item.status}
                    </span>
                  </td>
                );
              default:
                return null;
            }
          }}
        />
      </div>
    </div>
  );
}
