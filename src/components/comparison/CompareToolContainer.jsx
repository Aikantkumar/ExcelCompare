import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  Upload, 
  Sparkles, 
  RotateCcw, 
  Columns3, 
  KeyRound, 
  Layers, 
  Sliders, 
  Zap, 
  Lock,
  ArrowRight
} from 'lucide-react';
import { parseExcelFile, SAMPLE_DATASETS } from './excelParser';
import { compareSheets } from './diffEngine';
import DiffViewer from './DiffViewer';
import ColumnCompareViewer from './ColumnCompareViewer';
import ReconcileViewer from './ReconcileViewer';
import BatchCompareViewer from './BatchCompareViewer';
import ExportModal from './ExportModal';

export default function CompareToolContainer({ initialMode = 'files' }) {
  const [activeMode, setActiveMode] = useState(initialMode); // 'files' | 'columns' | 'reconcile' | 'batch'
  const [parsedFileA, setParsedFileA] = useState(null);
  const [parsedFileB, setParsedFileB] = useState(null);
  const [selectedSheetA, setSelectedSheetA] = useState('');
  const [selectedSheetB, setSelectedSheetB] = useState('');
  const [diffData, setDiffData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isExportOpen, setIsExportOpen] = useState(false);

  // Settings
  const [compareFormulas, setCompareFormulas] = useState(true);
  const [smartRowMatch, setSmartRowMatch] = useState(true);

  // Auto load financial sample on initial mount if empty
  useEffect(() => {
    loadSample('financial');
  }, []);

  const loadSample = (sampleKey) => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const sample = SAMPLE_DATASETS[sampleKey];
      setParsedFileA(sample.fileA);
      setParsedFileB(sample.fileB);
      setSelectedSheetA(sample.fileA.sheetNames[0]);
      setSelectedSheetB(sample.fileB.sheetNames[0]);
      setIsLoading(false);
    } catch (err) {
      setErrorMsg('Failed to load sample dataset');
      setIsLoading(false);
    }
  };

  const handleFileDrop = async (file, side) => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const parsed = await parseExcelFile(file);
      if (side === 'A') {
        setParsedFileA(parsed);
        setSelectedSheetA(parsed.sheetNames[0]);
      } else {
        setParsedFileB(parsed);
        setSelectedSheetB(parsed.sheetNames[0]);
      }
      setIsLoading(false);
    } catch (err) {
      setErrorMsg(`Error parsing ${file.name}. Please ensure it is a valid .xlsx, .xls, or .csv file.`);
      setIsLoading(false);
    }
  };

  // Re-run diffing whenever sheets or options change
  useEffect(() => {
    if (parsedFileA && parsedFileB && selectedSheetA && selectedSheetB) {
      const sheetA = parsedFileA.sheets[selectedSheetA];
      const sheetB = parsedFileB.sheets[selectedSheetB];

      if (sheetA && sheetB) {
        const result = compareSheets(sheetA, sheetB, {
          compareFormulas,
          smartRowMatch,
        });
        setDiffData(result);
      }
    }
  }, [parsedFileA, parsedFileB, selectedSheetA, selectedSheetB, compareFormulas, smartRowMatch]);

  const sheetA = parsedFileA?.sheets[selectedSheetA];
  const sheetB = parsedFileB?.sheets[selectedSheetB];

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Mode Navigation Bar matching DESIGN.md pill buttons & typography */}
      <div className="bg-[#0d0d0d] border border-[#262626] p-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveMode('files')}
            className={`px-5 py-2.5 text-xs font-mono tracking-[2px] uppercase transition-all rounded-full border ${
              activeMode === 'files'
                ? 'bg-white text-black border-white font-bold'
                : 'bg-transparent text-[#999999] border-[#3a3a3a] hover:border-white hover:text-white'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 inline mr-2" />
            COMPARE FILES
          </button>

          <button
            onClick={() => setActiveMode('columns')}
            className={`px-5 py-2.5 text-xs font-mono tracking-[2px] uppercase transition-all rounded-full border ${
              activeMode === 'columns'
                ? 'bg-white text-black border-white font-bold'
                : 'bg-transparent text-[#999999] border-[#3a3a3a] hover:border-white hover:text-white'
            }`}
          >
            <Columns3 className="w-4 h-4 inline mr-2" />
            COMPARE COLUMNS
          </button>

          <button
            onClick={() => setActiveMode('reconcile')}
            className={`px-5 py-2.5 text-xs font-mono tracking-[2px] uppercase transition-all rounded-full border ${
              activeMode === 'reconcile'
                ? 'bg-white text-black border-white font-bold'
                : 'bg-transparent text-[#999999] border-[#3a3a3a] hover:border-white hover:text-white'
            }`}
          >
            <KeyRound className="w-4 h-4 inline mr-2" />
            RECONCILE (ID MATCH)
          </button>

          <button
            onClick={() => setActiveMode('batch')}
            className={`px-5 py-2.5 text-xs font-mono tracking-[2px] uppercase transition-all rounded-full border ${
              activeMode === 'batch'
                ? 'bg-white text-black border-white font-bold'
                : 'bg-transparent text-[#999999] border-[#3a3a3a] hover:border-white hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4 inline mr-2" />
            BATCH QUEUE
          </button>
        </div>

        {/* Preset Sample Loaders */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-[#666666] uppercase hidden lg:inline">TRY DEMO SAMPLES:</span>
          <button
            onClick={() => loadSample('financial')}
            className="px-3 py-1.5 text-[11px] font-mono border border-[#3a3a3a] text-[#c3d9f3] hover:border-[#c3d9f3]"
          >
            FINANCIAL Q3/Q4
          </button>
          <button
            onClick={() => loadSample('inventory')}
            className="px-3 py-1.5 text-[11px] font-mono border border-[#3a3a3a] text-[#c3d9f3] hover:border-[#c3d9f3]"
          >
            INVENTORY SKU
          </button>
        </div>
      </div>

      {/* File Upload Header Cards (Visible for Files, Columns, Reconcile) */}
      {activeMode !== 'batch' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* File A Card */}
          <div className="bg-[#141414] border border-[#262626] p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#262626] pb-3">
              <span className="text-caption text-[#c3d9f3]">FILE 1 (ORIGINAL / BEFORE)</span>
              {parsedFileA && (
                <span className="text-xs font-mono text-[#999999]">
                  {parsedFileA.sheetNames.length} SHEET(S)
                </span>
              )}
            </div>

            {parsedFileA ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-[#0d0d0d] p-3 border border-[#262626]">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <FileSpreadsheet className="w-5 h-5 text-[#5fa657] shrink-0" />
                    <span className="text-xs font-mono text-white truncate">{parsedFileA.fileName}</span>
                  </div>
                  <label className="text-[10px] font-mono text-[#c3d9f3] hover:underline cursor-pointer shrink-0 ml-2">
                    CHANGE
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={(e) => e.target.files[0] && handleFileDrop(e.target.files[0], 'A')}
                      className="hidden"
                    />
                  </label>
                </div>

                {parsedFileA.sheetNames.length > 1 && (
                  <div>
                    <label className="text-[10px] font-mono text-[#999999] uppercase block mb-1">SELECT TAB / WORKSHEET:</label>
                    <select
                      value={selectedSheetA}
                      onChange={(e) => setSelectedSheetA(e.target.value)}
                      className="w-full bg-[#000000] border border-[#3a3a3a] text-white p-2 font-mono text-xs focus:outline-none"
                    >
                      {parsedFileA.sheetNames.map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            ) : (
              <label className="border-2 border-dashed border-[#3a3a3a] hover:border-white p-8 block text-center cursor-pointer transition-colors">
                <Upload className="w-8 h-8 text-[#999999] mx-auto mb-2" />
                <span className="text-xs font-mono text-white block uppercase tracking-wider">DROP FILE 1 HERE OR CLICK</span>
                <span className="text-[10px] font-serif text-[#666666] block mt-1">Supports .xlsx, .xls, .csv</span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => e.target.files[0] && handleFileDrop(e.target.files[0], 'A')}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* File B Card */}
          <div className="bg-[#141414] border border-[#262626] p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#262626] pb-3">
              <span className="text-caption text-[#c3d9f3]">FILE 2 (MODIFIED / AFTER)</span>
              {parsedFileB && (
                <span className="text-xs font-mono text-[#999999]">
                  {parsedFileB.sheetNames.length} SHEET(S)
                </span>
              )}
            </div>

            {parsedFileB ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-[#0d0d0d] p-3 border border-[#262626]">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <FileSpreadsheet className="w-5 h-5 text-[#5fa657] shrink-0" />
                    <span className="text-xs font-mono text-white truncate">{parsedFileB.fileName}</span>
                  </div>
                  <label className="text-[10px] font-mono text-[#c3d9f3] hover:underline cursor-pointer shrink-0 ml-2">
                    CHANGE
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={(e) => e.target.files[0] && handleFileDrop(e.target.files[0], 'B')}
                      className="hidden"
                    />
                  </label>
                </div>

                {parsedFileB.sheetNames.length > 1 && (
                  <div>
                    <label className="text-[10px] font-mono text-[#999999] uppercase block mb-1">SELECT TAB / WORKSHEET:</label>
                    <select
                      value={selectedSheetB}
                      onChange={(e) => setSelectedSheetB(e.target.value)}
                      className="w-full bg-[#000000] border border-[#3a3a3a] text-white p-2 font-mono text-xs focus:outline-none"
                    >
                      {parsedFileB.sheetNames.map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            ) : (
              <label className="border-2 border-dashed border-[#3a3a3a] hover:border-white p-8 block text-center cursor-pointer transition-colors">
                <Upload className="w-8 h-8 text-[#999999] mx-auto mb-2" />
                <span className="text-xs font-mono text-white block uppercase tracking-wider">DROP FILE 2 HERE OR CLICK</span>
                <span className="text-[10px] font-serif text-[#666666] block mt-1">Supports .xlsx, .xls, .csv</span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => e.target.files[0] && handleFileDrop(e.target.files[0], 'B')}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>
      )}

      {/* Advanced Settings Drawer (For Files Mode) */}
      {activeMode === 'files' && (
        <div className="bg-[#0d0d0d] border border-[#262626] p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-6 text-xs font-mono">
            <label className="flex items-center gap-2 text-white cursor-pointer select-none">
              <input
                type="checkbox"
                checked={smartRowMatch}
                onChange={(e) => setSmartRowMatch(e.target.checked)}
                className="accent-[#c3d9f3]"
              />
              SMART FUZZY ROW MATCHING (MATCHES REORDERED ROWS)
            </label>

            <label className="flex items-center gap-2 text-white cursor-pointer select-none">
              <input
                type="checkbox"
                checked={compareFormulas}
                onChange={(e) => setCompareFormulas(e.target.checked)}
                className="accent-[#c3d9f3]"
              />
              FORMULA DIFFERENCE DETECTION
            </label>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-[#5fa657]">
            <Lock className="w-3.5 h-3.5 inline" />
            100% BROWSER OFFLINE DIFF — NO DATA SENT TO SERVER
          </div>
        </div>
      )}

      {/* Loading Indicator */}
      {isLoading && (
        <div className="text-center py-12 space-y-3">
          <div className="w-8 h-8 border-2 border-white border-t-transparent animate-spin mx-auto"></div>
          <p className="text-xs font-mono text-white tracking-widest uppercase">PARSING SPREADSHEETS & COMPUTING DIFF...</p>
        </div>
      )}

      {/* Error Banner */}
      {errorMsg && (
        <div className="bg-[#3b1219] border border-[#b91c1c] text-[#fca5a5] p-4 text-xs font-mono">
          {errorMsg}
        </div>
      )}

      {/* Tool View Rendering */}
      {!isLoading && activeMode === 'files' && diffData && (
        <DiffViewer
          diffData={diffData}
          sheetName={selectedSheetA}
          onExport={() => setIsExportOpen(true)}
          onShare={() => setIsExportOpen(true)}
        />
      )}

      {!isLoading && activeMode === 'columns' && sheetA && sheetB && (
        <ColumnCompareViewer sheetA={sheetA} sheetB={sheetB} />
      )}

      {!isLoading && activeMode === 'reconcile' && sheetA && sheetB && (
        <ReconcileViewer sheetA={sheetA} sheetB={sheetB} />
      )}

      {activeMode === 'batch' && (
        <BatchCompareViewer />
      )}

      {/* Export / Share Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        diffData={diffData}
        sheetName={selectedSheetA}
        fileAName={parsedFileA?.fileName}
        fileBName={parsedFileB?.fileName}
      />
    </div>
  );
}
