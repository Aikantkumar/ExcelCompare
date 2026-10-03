import React, { useState, useEffect, Component } from 'react';
import { 
  FileSpreadsheet, 
  Upload, 
  Columns3, 
  KeyRound, 
  Layers,
  X,
  RotateCcw,
  AlertTriangle,
  Layers as LayersIcon
} from 'lucide-react';
import { parseExcelFile, SAMPLE_DATASETS } from './excelParser';
import { compareSheets } from './diffEngine';
import DiffViewer from './DiffViewer';
import TopBottomDiffViewer from './TopBottomDiffViewer';
import ColumnCompareViewer from './ColumnCompareViewer';
import ReconcileViewer from './ReconcileViewer';
import BatchCompareViewer from './BatchCompareViewer';
import ExportModal from './ExportModal';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error in DiffViewer:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-[#3b1219] border border-[#b91c1c] text-[#fca5a5] p-6 space-y-3 my-4 font-mono text-xs">
          <div className="flex items-center gap-2 text-white font-bold uppercase text-sm">
            <AlertTriangle className="w-5 h-5 text-[#fca5a5]" />
            ERROR RENDERING SPREADSHEET DIFFERENTIAL VIEW
          </div>
          <p>{this.state.error?.message || 'An unexpected runtime error occurred while diffing or rendering.'}</p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              if (this.props.onReset) this.props.onReset();
            }}
            className="px-4 py-2 bg-[#b91c1c] text-white hover:bg-red-700 font-bold uppercase transition-colors"
          >
            RESET WORKSPACE
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Initial sample data for synchronous SSR / client hydration consistency
const initialSample = SAMPLE_DATASETS.register;
const initialSheetNameA = initialSample.fileA.sheetNames[0];
const initialSheetNameB = initialSample.fileB.sheetNames[0];
const initialSheetA = initialSample.fileA.sheets[initialSheetNameA];
const initialSheetB = initialSample.fileB.sheets[initialSheetNameB];
const initialDiffData = compareSheets(initialSheetA, initialSheetB);

export default function CompareToolContainer({ initialMode = 'files' }) {
  const [activeMode, setActiveMode] = useState(initialMode);
  const [parsedFileA, setParsedFileA] = useState(initialSample.fileA);
  const [parsedFileB, setParsedFileB] = useState(initialSample.fileB);
  const [selectedSheetA, setSelectedSheetA] = useState(initialSheetNameA);
  const [selectedSheetB, setSelectedSheetB] = useState(initialSheetNameB);
  const [diffData, setDiffData] = useState(initialDiffData);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isDragActiveA, setIsDragActiveA] = useState(false);
  const [isDragActiveB, setIsDragActiveB] = useState(false);

  // Full Diffchecker Options State
  const [diffOptions, setDiffOptions] = useState({
    compareFormulas: true,
    smartRowMatch: true,
    diffGranularity: 'smart', // 'smart' | 'word' | 'char'
    matchColumnsByHeaders: false,
    ignoreWhitespace: false,
    ignoreCase: false,
    hideUnchangedRows: false,
    hideUnchangedColumns: false,
    normalizeDatesUS: false,
    normalizeDatesEU: false,
    preserveFormatting: true,
    sortRows: 'none',
  });

  const loadSample = (sampleKey) => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const sample = SAMPLE_DATASETS[sampleKey];
      setParsedFileA(sample.fileA);
      setParsedFileB(sample.fileB);
      setSelectedSheetA(sample.fileA.sheetNames[0]);
      setSelectedSheetB(sample.fileB.sheetNames[0]);
      const sA = sample.fileA.sheets[sample.fileA.sheetNames[0]];
      const sB = sample.fileB.sheets[sample.fileB.sheetNames[0]];
      setDiffData(compareSheets(sA, sB, diffOptions));
      setIsLoading(false);
    } catch (err) {
      setErrorMsg('Failed to load sample dataset');
      setIsLoading(false);
    }
  };

  const handleClearAll = () => {
    setParsedFileA(null);
    setParsedFileB(null);
    setSelectedSheetA('');
    setSelectedSheetB('');
    setDiffData(null);
    setErrorMsg('');
  };

  const handleFileDrop = async (file, side) => {
    if (!file) return;
    setIsLoading(true);
    setErrorMsg('');
    try {
      const parsed = await parseExcelFile(file);
      if (!parsed.sheetNames || parsed.sheetNames.length === 0) {
        throw new Error('File has no valid worksheets');
      }
      if (side === 'A') {
        setParsedFileA(parsed);
        setSelectedSheetA(parsed.sheetNames[0]);
      } else {
        setParsedFileB(parsed);
        setSelectedSheetB(parsed.sheetNames[0]);
      }
      setIsLoading(false);
    } catch (err) {
      const msg = err && err.message ? err.message : `Error parsing ${file.name}.`;
      setErrorMsg(`Error parsing ${file.name}: ${msg}. Please ensure it is a valid .xlsx, .xls, or .csv file.`);
      setIsLoading(false);
    }
  };

  const handleDragOver = (e, side) => {
    e.preventDefault();
    e.stopPropagation();
    if (side === 'A') setIsDragActiveA(true);
    if (side === 'B') setIsDragActiveB(true);
  };

  const handleDragLeave = (e, side) => {
    e.preventDefault();
    e.stopPropagation();
    if (side === 'A') setIsDragActiveA(false);
    if (side === 'B') setIsDragActiveB(false);
  };

  const handleDrop = (e, side) => {
    e.preventDefault();
    e.stopPropagation();
    if (side === 'A') setIsDragActiveA(false);
    if (side === 'B') setIsDragActiveB(false);

    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileDrop(e.dataTransfer.files[0], side);
    }
  };

  const handleFileInputChange = (e, side) => {
    if (e.target.files && e.target.files[0]) {
      handleFileDrop(e.target.files[0], side);
    }
    // Reset input value so selecting the same file triggers change event again
    e.target.value = null;
  };

  const handleRemoveFile = (side) => {
    if (side === 'A') {
      setParsedFileA(null);
      setSelectedSheetA('');
    } else {
      setParsedFileB(null);
      setSelectedSheetB('');
    }
    setDiffData(null);
  };

  // Re-run diffing whenever sheets or options change
  useEffect(() => {
    if (parsedFileA && parsedFileB && selectedSheetA && selectedSheetB) {
      const sheetA = parsedFileA.sheets[selectedSheetA];
      const sheetB = parsedFileB.sheets[selectedSheetB];

      if (sheetA && sheetB) {
        try {
          const result = compareSheets(sheetA, sheetB, diffOptions);
          setDiffData(result);
        } catch (err) {
          setErrorMsg('Error computing differences between selected sheets.');
          setDiffData(null);
        }
      } else {
        setDiffData(null);
      }
    } else {
      setDiffData(null);
    }
  }, [parsedFileA, parsedFileB, selectedSheetA, selectedSheetB, diffOptions]);

  const sheetA = parsedFileA?.sheets[selectedSheetA];
  const sheetB = parsedFileB?.sheets[selectedSheetB];

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
            onClick={() => setActiveMode('stacked')}
            className={`px-5 py-2.5 text-xs font-mono tracking-[2px] uppercase transition-all rounded-full border ${
              activeMode === 'stacked'
                ? 'bg-white text-black border-white font-bold'
                : 'bg-transparent text-[#999999] border-[#3a3a3a] hover:border-white hover:text-white'
            }`}
          >
            <LayersIcon className="w-4 h-4 inline mr-2" />
            TOP/BOTTOM VIEW
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

        {/* Preset Sample Loaders & Clear Button */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-[#666666] uppercase hidden lg:inline">TRY DEMO SAMPLES:</span>
          <button
            onClick={() => loadSample('register')}
            className="px-3 py-1.5 text-[11px] font-mono border border-[#5fa657] text-[#6ee7b7] bg-[#062c19] font-bold hover:brightness-125"
          >
            REGISTER V1/V2
          </button>
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

          {(parsedFileA || parsedFileB) && (
            <button
              onClick={handleClearAll}
              className="px-3 py-1.5 text-[11px] font-mono border border-[#3a3a3a] text-[#999999] hover:text-white hover:border-white transition-all flex items-center gap-1"
              title="Clear current files and show blank dropzones"
            >
              <RotateCcw className="w-3 h-3" />
              CLEAR ALL
            </button>
          )}
        </div>
      </div>

      {/* File Upload Header Cards (Visible for Files, Columns, Reconcile) */}
      {activeMode !== 'batch' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* File A Card */}
          <div 
            className={`bg-[#141414] border p-4 space-y-3 transition-colors ${
              isDragActiveA ? 'border-white bg-[#1f1f1f]' : 'border-[#262626]'
            }`}
            onDragOver={(e) => handleDragOver(e, 'A')}
            onDragLeave={(e) => handleDragLeave(e, 'A')}
            onDrop={(e) => handleDrop(e, 'A')}
          >
            <div className="flex items-center justify-between border-b border-[#262626] pb-2">
              <span className="text-caption text-[#c3d9f3]">FILE 1 (ORIGINAL / BEFORE)</span>
              {parsedFileA && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-[#999999]">
                    {parsedFileA.sheetNames.length} SHEET(S)
                  </span>
                  <button 
                    onClick={() => handleRemoveFile('A')}
                    className="text-[#999999] hover:text-white p-1"
                    title="Remove File 1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {parsedFileA ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between bg-[#0d0d0d] p-2.5 border border-[#262626]">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <FileSpreadsheet className="w-5 h-5 text-[#5fa657] shrink-0" />
                    <span className="text-xs font-mono text-white truncate">{parsedFileA.fileName}</span>
                  </div>
                  <label className="text-[10px] font-mono text-[#c3d9f3] hover:underline cursor-pointer shrink-0 ml-2">
                    CHANGE
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={(e) => handleFileInputChange(e, 'A')}
                      className="hidden"
                    />
                  </label>
                </div>

                {parsedFileA.sheetNames.length > 1 && (
                  <div>
                    <select
                      value={selectedSheetA}
                      onChange={(e) => setSelectedSheetA(e.target.value)}
                      className="w-full bg-[#000000] border border-[#3a3a3a] text-white p-1.5 font-mono text-xs focus:outline-none"
                    >
                      {parsedFileA.sheetNames.map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            ) : (
              <label className={`border-2 border-dashed p-6 block text-center cursor-pointer transition-colors ${
                isDragActiveA ? 'border-white bg-[#1f1f1f]' : 'border-[#3a3a3a] hover:border-white'
              }`}>
                <Upload className="w-6 h-6 text-[#999999] mx-auto mb-2" />
                <span className="text-xs font-mono text-white block uppercase tracking-wider">DROP FILE 1 HERE OR CLICK TO UPLOAD</span>
                <span className="text-[10px] font-mono text-[#666666] block mt-1">.xlsx, .xls, .csv</span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => handleFileInputChange(e, 'A')}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* File B Card */}
          <div 
            className={`bg-[#141414] border p-4 space-y-3 transition-colors ${
              isDragActiveB ? 'border-white bg-[#1f1f1f]' : 'border-[#262626]'
            }`}
            onDragOver={(e) => handleDragOver(e, 'B')}
            onDragLeave={(e) => handleDragLeave(e, 'B')}
            onDrop={(e) => handleDrop(e, 'B')}
          >
            <div className="flex items-center justify-between border-b border-[#262626] pb-2">
              <span className="text-caption text-[#c3d9f3]">FILE 2 (MODIFIED / AFTER)</span>
              {parsedFileB && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-[#999999]">
                    {parsedFileB.sheetNames.length} SHEET(S)
                  </span>
                  <button 
                    onClick={() => handleRemoveFile('B')}
                    className="text-[#999999] hover:text-white p-1"
                    title="Remove File 2"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {parsedFileB ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between bg-[#0d0d0d] p-2.5 border border-[#262626]">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <FileSpreadsheet className="w-5 h-5 text-[#5fa657] shrink-0" />
                    <span className="text-xs font-mono text-white truncate">{parsedFileB.fileName}</span>
                  </div>
                  <label className="text-[10px] font-mono text-[#c3d9f3] hover:underline cursor-pointer shrink-0 ml-2">
                    CHANGE
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={(e) => handleFileInputChange(e, 'B')}
                      className="hidden"
                    />
                  </label>
                </div>

                {parsedFileB.sheetNames.length > 1 && (
                  <div>
                    <select
                      value={selectedSheetB}
                      onChange={(e) => setSelectedSheetB(e.target.value)}
                      className="w-full bg-[#000000] border border-[#3a3a3a] text-white p-1.5 font-mono text-xs focus:outline-none"
                    >
                      {parsedFileB.sheetNames.map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            ) : (
              <label className={`border-2 border-dashed p-6 block text-center cursor-pointer transition-colors ${
                isDragActiveB ? 'border-white bg-[#1f1f1f]' : 'border-[#3a3a3a] hover:border-white'
              }`}>
                <Upload className="w-6 h-6 text-[#999999] mx-auto mb-2" />
                <span className="text-xs font-mono text-white block uppercase tracking-wider">DROP FILE 2 HERE OR CLICK TO UPLOAD</span>
                <span className="text-[10px] font-mono text-[#666666] block mt-1">.xlsx, .xls, .csv</span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => handleFileInputChange(e, 'B')}
                  className="hidden"
                />
              </label>
            )}
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
        <div className="bg-[#3b1219] border border-[#b91c1c] text-[#fca5a5] p-4 text-xs font-mono flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg('')} className="text-white hover:text-[#fca5a5]">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Guidance Banner when only 1 file is loaded */}
      {!isLoading && (activeMode === 'files' || activeMode === 'stacked') && !diffData && (parsedFileA || parsedFileB) && (
        <div className="bg-[#141414] border border-[#262626] p-12 text-center space-y-4">
          <FileSpreadsheet className="w-10 h-10 text-[#c3d9f3] mx-auto" />
          <h3 className="text-white font-mono text-sm uppercase tracking-wider">
            {parsedFileA ? `FILE 1 (${parsedFileA.fileName}) LOADED` : `FILE 2 (${parsedFileB.fileName}) LOADED`}
          </h3>
          <p className="font-serif text-[#999999] text-sm max-w-md mx-auto">
            Please upload or drop {parsedFileA ? 'File 2 (Modified / After)' : 'File 1 (Original / Before)'} in the dropzone above to generate visual cell diffs.
          </p>
        </div>
      )}

      {/* Guidance Banner when both files are empty */}
      {!isLoading && !parsedFileA && !parsedFileB && activeMode !== 'batch' && (
        <div className="bg-[#0d0d0d] border border-[#262626] p-12 text-center space-y-4">
          <Upload className="w-10 h-10 text-[#666666] mx-auto" />
          <h3 className="text-white font-mono text-sm uppercase tracking-wider">DROP TWO EXCEL FILES ABOVE TO START</h3>
          <p className="font-serif text-sm text-[#999999] max-w-md mx-auto">
            Or select one of the demo samples at the top right to instantly test formula differences, row reordering, and set comparisons.
          </p>
        </div>
      )}

      {/* Tool View Rendering wrapped in ErrorBoundary */}
      <ErrorBoundary onReset={handleClearAll}>
        {!isLoading && activeMode === 'files' && diffData && (
          <DiffViewer
            diffData={diffData}
            sheetName={selectedSheetA}
            onExport={() => setIsExportOpen(true)}
            onShare={() => setIsExportOpen(true)}
            options={diffOptions}
            onOptionsChange={setDiffOptions}
            headersA={sheetA?.rows?.[0]?.map((c, cIdx) => String(c?.val || `Column ${cIdx + 1}`)) || []}
            headersB={sheetB?.rows?.[0]?.map(c => String(c?.val || `Column ${cIdx + 1}`)) || []}
          />
        )}

        {!isLoading && activeMode === 'stacked' && diffData && (
          <TopBottomDiffViewer
            diffData={diffData}
            sheetName={selectedSheetA}
            onExport={() => setIsExportOpen(true)}
            onShare={() => setIsExportOpen(true)}
            options={diffOptions}
            onOptionsChange={setDiffOptions}
            headersA={sheetA?.rows?.[0]?.map((c, cIdx) => String(c?.val || `Column ${cIdx + 1}`)) || []}
            headersB={sheetB?.rows?.[0]?.map((c, cIdx) => String(c?.val || `Column ${cIdx + 1}`)) || []}
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
      </ErrorBoundary>

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
