import React, { useState } from 'react';
import { Layers, Plus, Trash2, Play, CheckCircle2, Download, AlertCircle } from 'lucide-react';
import { parseExcelFile } from './excelParser';
import { compareSheets } from './diffEngine';

export default function BatchCompareViewer() {
  const [pairs, setPairs] = useState([
    { id: 1, fileA: null, fileB: null, nameA: '', nameB: '', status: 'PENDING', result: null }
  ]);
  const [isProcessing, setIsProcessing] = useState(false);

  const addPair = () => {
    setPairs([
      ...pairs,
      { id: Date.now(), fileA: null, fileB: null, nameA: '', nameB: '', status: 'PENDING', result: null }
    ]);
  };

  const removePair = (id) => {
    setPairs(pairs.filter((p) => p.id !== id));
  };

  const handleFileUpload = (id, side, file) => {
    setPairs((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          return {
            ...p,
            [side === 'A' ? 'fileA' : 'fileB']: file,
            [side === 'A' ? 'nameA' : 'nameB']: file.name,
          };
        }
        return p;
      })
    );
  };

  const runBatchCompare = async () => {
    setIsProcessing(true);
    const updatedPairs = [...pairs];

    for (let i = 0; i < updatedPairs.length; i++) {
      const p = updatedPairs[i];
      if (p.fileA && p.fileB) {
        try {
          p.status = 'PROCESSING';
          setPairs([...updatedPairs]);

          const parsedA = await parseExcelFile(p.fileA);
          const parsedB = await parseExcelFile(p.fileB);

          const sheetA = parsedA.sheets[parsedA.sheetNames[0]];
          const sheetB = parsedB.sheets[parsedB.sheetNames[0]];

          const res = compareSheets(sheetA, sheetB);
          p.result = res.stats;
          p.status = 'DONE';
        } catch (err) {
          p.status = 'ERROR';
        }
      }
    }

    setPairs([...updatedPairs]);
    setIsProcessing(false);
  };

  const exportBatchSummary = () => {
    const csvHeader = 'Pair #,Left File,Right File,Total Changes,Added Rows,Deleted Rows,Modified Cells,Formula Changes\n';
    const csvRows = pairs
      .map((p, i) => {
        const s = p.result || {};
        return `"${i + 1}","${p.nameA}","${p.nameB}","${s.totalChanges || 0}","${s.totalAdded || 0}","${s.totalDeleted || 0}","${s.totalModified || 0}","${s.totalFormulaChanges || 0}"`;
      })
      .join('\n');

    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvHeader + csvRows);
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', `batch_compare_summary.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Batch Header */}
      <div className="bg-[#141414] border border-[#262626] p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-title-md text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#c3d9f3]" />
            BATCH FILE COMPARISON QUEUE
          </h3>
          <p className="font-serif text-sm text-[#999999] mt-1">
            Compare multiple pairs of spreadsheets simultaneously in a single automated batch run.
          </p>
        </div>

        <div className="flex gap-3">
          <button onClick={addPair} className="btn-secondary text-xs h-9 px-4">
            <Plus className="w-3.5 h-3.5 inline mr-1" />
            ADD FILE PAIR
          </button>

          <button
            onClick={runBatchCompare}
            disabled={isProcessing}
            className="btn-primary text-xs h-9 px-5"
          >
            <Play className="w-3.5 h-3.5 inline mr-1" />
            {isProcessing ? 'RUNNING BATCH...' : 'RUN ALL COMPARISONS'}
          </button>
        </div>
      </div>

      {/* Pairs Queue List */}
      <div className="space-y-4">
        {pairs.map((p, idx) => (
          <div key={p.id} className="bg-[#0d0d0d] border border-[#262626] p-5 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
            <div className="lg:col-span-1 text-caption text-[#999999]">PAIR #{idx + 1}</div>

            {/* File A Upload */}
            <div className="lg:col-span-4">
              <label className="text-[10px] font-mono text-[#666666] uppercase block mb-1">FILE 1 (LEFT)</label>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => e.target.files[0] && handleFileUpload(p.id, 'A', e.target.files[0])}
                className="w-full bg-[#000000] border border-[#3a3a3a] text-xs font-mono text-[#cccccc] p-2 file:bg-[#1f1f1f] file:border-0 file:text-white file:font-mono file:text-xs file:px-2 file:py-1 file:mr-2 cursor-pointer"
              />
              {p.nameA && <div className="text-xs font-mono text-[#c3d9f3] truncate mt-1">✓ {p.nameA}</div>}
            </div>

            {/* File B Upload */}
            <div className="lg:col-span-4">
              <label className="text-[10px] font-mono text-[#666666] uppercase block mb-1">FILE 2 (RIGHT)</label>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => e.target.files[0] && handleFileUpload(p.id, 'B', e.target.files[0])}
                className="w-full bg-[#000000] border border-[#3a3a3a] text-xs font-mono text-[#cccccc] p-2 file:bg-[#1f1f1f] file:border-0 file:text-white file:font-mono file:text-xs file:px-2 file:py-1 file:mr-2 cursor-pointer"
              />
              {p.nameB && <div className="text-xs font-mono text-[#c3d9f3] truncate mt-1">✓ {p.nameB}</div>}
            </div>

            {/* Results Status */}
            <div className="lg:col-span-2 text-xs font-mono">
              {p.status === 'PENDING' && <span className="text-[#999999]">READY TO RUN</span>}
              {p.status === 'PROCESSING' && <span className="text-[#fcd34d]">PARSING & DIFFING...</span>}
              {p.status === 'DONE' && (
                <div className="text-[#6ee7b7] space-y-0.5">
                  <div className="font-bold">✓ DONE</div>
                  <div className="text-[10px] text-[#999999]">
                    {p.result?.totalChanges || 0} changes found
                  </div>
                </div>
              )}
            </div>

            {/* Remove Action */}
            <div className="lg:col-span-1 text-right">
              <button onClick={() => removePair(p.id)} className="text-[#666666] hover:text-[#fca5a5] p-2">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Batch Export */}
      {pairs.some((p) => p.status === 'DONE') && (
        <div className="flex justify-end">
          <button onClick={exportBatchSummary} className="btn-primary text-xs h-9 px-5">
            <Download className="w-3.5 h-3.5 inline mr-2" />
            EXPORT BATCH AUDIT REPORT (CSV)
          </button>
        </div>
      )}
    </div>
  );
}
