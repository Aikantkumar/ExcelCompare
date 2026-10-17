import React, { useState, useEffect, useCallback, Component, lazy, Suspense } from 'react';
import { 
  FileSpreadsheet, 
  Upload, 
  X,
  RotateCcw,
  AlertTriangle,
  Cpu
} from 'lucide-react';
import { SAMPLE_DATASETS } from './sampleDatasets';
import { useDiffWorker } from './useDiffWorker';
import { isWorkerSupported } from './workerClient.js';
import { useDebouncedCallback } from '../../hooks/useDebouncedCallback';
import ViewerLoadingSkeleton from './ViewerLoadingSkeleton';

const TopBottomDiffViewer = lazy(() => import('./TopBottomDiffViewer'));
const ColumnCompareViewer = lazy(() => import('./ColumnCompareViewer'));
const ReconcileViewer = lazy(() => import('./ReconcileViewer'));
const BatchCompareViewer = lazy(() => import('./BatchCompareViewer'));
const ExportModal = lazy(() => import('./ExportModal'));

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

const initialSample = SAMPLE_DATASETS.register;
const initialSheetNameA = initialSample.fileA.sheetNames[0];
const initialSheetNameB = initialSample.fileB.sheetNames[0];
const initialSheetA = initialSample.fileA.sheets[initialSheetNameA];
const initialSheetB = initialSample.fileB.sheets[initialSheetNameB];

export default function CompareToolContainer({ initialMode = 'stacked' }) {
  const [errorMsg, setErrorMsg] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  
  const [sheetNamesA, setSheetNamesA] = useState(initialSample.fileA.sheetNames);
  const [sheetNamesB, setSheetNamesB] = useState(initialSample.fileB.sheetNames);
  const [sheetDataA, setSheetDataA] = useState(initialSheetA);
  const [sheetDataB, setSheetDataB] = useState(initialSheetB);
  const [fileNameA, setFileNameA] = useState(initialSample.fileA.fileName);
  const [fileNameB, setFileNameB] = useState(initialSample.fileB.fileName);
  
  const [selectedSheetA, setSelectedSheetA] = useState(initialSheetNameA);
  const [selectedSheetB, setSelectedSheetB] = useState(initialSheetNameB);
  const [useWorker, setUseWorker] = useState(true);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isDragActiveA, setIsDragActiveA] = useState(false);
  const [isDragActiveB, setIsDragActiveB] = useState(false);

  const [diffOptions, setDiffOptions] = useState({
    compareFormulas: true,
    smartRowMatch: true,
    diffGranularity: 'smart',
    matchColumnsByHeaders: false,
    ignoreWhitespace: false,
    ignoreCase: false,
    collapseUnchangedBlocks: false,
    hideUnchangedRows: false,
    hideUnchangedColumns: false,
    normalizeDatesUS: false,
    normalizeDatesEU: false,
    preserveFormatting: true,
    sortRows: 'none',
  });

  const handleWorkerError = useCallback((err) => {
    setErrorMsg(err.message || 'Diff computation failed');
  }, []);

  const { diffData, isLoading, error: workerError, computeDiff, abort, clear: clearDiff } = useDiffWorker({
    fallbackToMainThread: true,
    onError: handleWorkerError,
  });
  
  const computeDiffDebounced = useDebouncedCallback(
    useCallback((sheetA, sheetB, options) => {
      if (sheetA && sheetB) {
        computeDiff(sheetA, sheetB, options);
      }
    }, [computeDiff]),
    300
  );

  const loadSample = (sampleKey) => {
    try {
      const sample = SAMPLE_DATASETS[sampleKey];
      setSheetNamesA(sample.fileA.sheetNames);
      setSheetNamesB(sample.fileB.sheetNames);
      setSheetDataA(sample.fileA.sheets[sample.fileA.sheetNames[0]]);
      setSheetDataB(sample.fileB.sheets[sample.fileB.sheetNames[0]]);
      setFileNameA(sample.fileA.fileName);
      setFileNameB(sample.fileB.fileName);
      setSelectedSheetA(sample.fileA.sheetNames[0]);
      setSelectedSheetB(sample.fileB.sheetNames[0]);
      const sA = sample.fileA.sheets[sample.fileA.sheetNames[0]];
      const sB = sample.fileB.sheets[sample.fileB.sheetNames[0]];
      computeDiff(sA, sB, diffOptions);
    } catch (err) {
      setErrorMsg('Failed to load sample dataset');
    }
  };

  const handleClearAll = () => {
    setSheetNamesA([]);
    setSheetNamesB([]);
    setSheetDataA(null);
    setSheetDataB(null);
    setFileNameA('');
    setFileNameB('');
    setSelectedSheetA('');
    setSelectedSheetB('');
    setErrorMsg('');
    clearDiff();
  };

  const handleFileDrop = async (file, side) => {
    if (!file) return;
    setErrorMsg('');
    setIsParsing(true);
    try {
      const { parseExcelFile } = await import('./excelParser');
      const parsed = await parseExcelFile(file);
      if (!parsed.sheetNames || parsed.sheetNames.length === 0) {
        throw new Error('File has no valid worksheets');
      }
      if (side === 'A') {
        setSheetNamesA(parsed.sheetNames);
        setSheetDataA(parsed.sheets[parsed.sheetNames[0]]);
        setFileNameA(parsed.fileName);
        setSelectedSheetA(parsed.sheetNames[0]);
      } else {
        setSheetNamesB(parsed.sheetNames);
        setSheetDataB(parsed.sheets[parsed.sheetNames[0]]);
        setFileNameB(parsed.fileName);
        setSelectedSheetB(parsed.sheetNames[0]);
      }
    } catch (err) {
      const msg = err && err.message ? err.message : `Error parsing ${file.name}.`;
      setErrorMsg(`Error parsing ${file.name}: ${msg}. Please ensure it is a valid .xlsx, .xls, or .csv file.`);
    } finally {
      setIsParsing(false);
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
    e.target.value = null;
  };

  const handleRemoveFile = (side) => {
    if (side === 'A') {
      setSheetNamesA([]);
      setSheetDataA(null);
      setFileNameA('');
      setSelectedSheetA('');
    } else {
      setSheetNamesB([]);
      setSheetDataB(null);
      setFileNameB('');
      setSelectedSheetB('');
    }
    clearDiff();
  };

  const isInitialMount = React.useRef(true);

  useEffect(() => {
    if (sheetDataA && sheetDataB && selectedSheetA && selectedSheetB) {
      if (isInitialMount.current) {
        isInitialMount.current = false;
        computeDiff(sheetDataA, sheetDataB, diffOptions);
      } else {
        computeDiffDebounced(sheetDataA, sheetDataB, diffOptions);
      }
    }
  }, [sheetDataA, sheetDataB, selectedSheetA, selectedSheetB, diffOptions, computeDiff, computeDiffDebounced]);

  const sheetA = sheetDataA;
  const sheetB = sheetDataB;

  const showTopBottomViewer = initialMode === 'stacked' || initialMode === 'files';
  const showColumnViewer = initialMode === 'columns';
  const showReconcileViewer = initialMode === 'reconcile';
  const showBatchViewer = initialMode === 'batch';

  const needsDiffData = showTopBottomViewer;
  const hasDataForColumnReconcile = sheetDataA && sheetDataB;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Top Toolbar with Sample Loaders & Controls */}
      <div className="bg-[#0d0d0d] border border-[#262626] p-3 flex flex-wrap items-center justify-between gap-4">
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

          {(sheetNamesA.length > 0 || sheetNamesB.length > 0) && (
            <button
              onClick={handleClearAll}
              className="px-3 py-1.5 text-[11px] font-mono border border-[#3a3a3a] text-[#999999] hover:text-white hover:border-white transition-all flex items-center gap-1"
              title="Clear current files and show blank dropzones"
            >
              <RotateCcw className="w-3 h-3" />
              CLEAR ALL
            </button>
          )}
          <div className="flex items-center gap-2 ml-2 border-l border-[#3a3a3a] pl-3">
            <span className="text-[10px] font-mono text-[#666666] uppercase hidden lg:inline">WORKER:</span>
            <button
              onClick={() => setUseWorker(!useWorker)}
              disabled={!isWorkerSupported()}
              className={`px-2.5 py-1.5 text-[11px] font-mono border rounded transition-all flex items-center gap-1 ${
                useWorker
                  ? 'border-[#5fa657] text-[#6ee7b7] bg-[#062c19]'
                  : 'border-[#3a3a3a] text-[#999999] hover:border-white hover:text-white'
              }`}
              title={useWorker ? 'Using Web Worker (click to disable)' : 'Using Main Thread (click to enable Web Worker)'}
            >
              <Cpu className="w-3.5 h-3.5" />
              {useWorker ? 'WORKER' : 'MAIN'}
            </button>
          </div>
        </div>
      </div>

      {/* File Upload Header Cards */}
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
              {sheetNamesA.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-[#999999]">
                    {sheetNamesA.length} SHEET(S)
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

            {sheetNamesA.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between bg-[#0d0d0d] p-2.5 border border-[#262626]">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <FileSpreadsheet className="w-5 h-5 text-[#5fa657] shrink-0" />
                    <span className="text-xs font-mono text-white truncate">{fileNameA}</span>
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

                {sheetNamesA.length > 1 && (
                  <div>
                    <select
                      value={selectedSheetA}
                      onChange={(e) => setSelectedSheetA(e.target.value)}
                      className="w-full bg-[#000000] border border-[#3a3a3a] text-white p-1.5 font-mono text-xs focus:outline-none"
                    >
                      {sheetNamesA.map((name) => (
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
              {sheetNamesB.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-[#999999]">
                    {sheetNamesB.length} SHEET(S)
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

            {sheetNamesB.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between bg-[#0d0d0d] p-2.5 border border-[#262626]">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <FileSpreadsheet className="w-5 h-5 text-[#5fa657] shrink-0" />
                    <span className="text-xs font-mono text-white truncate">{fileNameB}</span>
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

                {sheetNamesB.length > 1 && (
                  <div>
                    <select
                      value={selectedSheetB}
                      onChange={(e) => setSelectedSheetB(e.target.value)}
                      className="w-full bg-[#000000] border border-[#3a3a3a] text-white p-1.5 font-mono text-xs focus:outline-none"
                    >
                      {sheetNamesB.map((name) => (
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
      {!isLoading && !diffData && (sheetNamesA.length > 0 || sheetNamesB.length > 0) && (
        <div className="bg-[#141414] border border-[#262626] p-12 text-center space-y-4">
          <FileSpreadsheet className="w-10 h-10 text-[#c3d9f3] mx-auto" />
          <h3 className="text-white font-mono text-sm uppercase tracking-wider">
            {sheetNamesA.length > 0 ? `FILE 1 (${fileNameA}) LOADED` : `FILE 2 (${fileNameB}) LOADED`}
          </h3>
          <p className="font-serif text-[#999999] text-sm max-w-md mx-auto">
            Please upload or drop {sheetNamesA.length > 0 ? 'File 2 (Modified / After)' : 'File 1 (Original / Before)'} in the dropzone above to generate visual cell diffs.
          </p>
        </div>
      )}

      {/* Guidance Banner when both files are empty */}
      {!isLoading && sheetNamesA.length === 0 && sheetNamesB.length === 0 && (
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
        <Suspense fallback={<ViewerLoadingSkeleton />}>
          {needsDiffData && !isLoading && !isParsing && diffData && (
            <TopBottomDiffViewer
              diffData={diffData}
              sheetName={selectedSheetA}
              onExport={() => setIsExportOpen(true)}
              onShare={() => setIsExportOpen(true)}
              options={diffOptions}
              onOptionsChange={setDiffOptions}
              headersA={sheetA?.rows?.[0]?.map((c, cIdx) => String(c?.val || `Column ${cIdx + 1}`)) || []}
              headersB={sheetB?.rows?.[0]?.map((c, cIdx) => String(c?.val || `Column ${cIdx + 1}`)) || []}
              colWidthsA={sheetA?.colWidths || []}
              colWidthsB={sheetB?.colWidths || []}
            />
          )}
          
          {showColumnViewer && hasDataForColumnReconcile && (
            <ColumnCompareViewer sheetA={sheetA} sheetB={sheetB} />
          )}
          
          {showReconcileViewer && hasDataForColumnReconcile && (
            <ReconcileViewer sheetA={sheetA} sheetB={sheetB} />
          )}
          
          {showBatchViewer && (
            <BatchCompareViewer />
          )}
        </Suspense>
      </ErrorBoundary>

      {/* Export / Share Modal */}
      {isExportOpen && (
        <Suspense fallback={<>
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4" data-export-modal>
            <div className="bg-[#141414] border border-[#262626] p-6 max-w-xl w-full">
              <div className="animate-pulse space-y-4">
                <div className="h-6 w-1/3 bg-[#262626] rounded" />
                <div className="h-4 w-full bg-[#262626] rounded" />
                <div className="h-4 w-2/3 bg-[#262626] rounded" />
              </div>
            </div>
          </div>
        </>}>
          <ExportModal
            isOpen={isExportOpen}
            onClose={() => setIsExportOpen(false)}
            diffData={diffData}
            sheetName={selectedSheetA}
            fileAName={fileNameA}
            fileBName={fileNameB}
          />
        </Suspense>
      )}
    </div>
  );
}