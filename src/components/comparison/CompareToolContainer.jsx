import { 
  useState, 
  useEffect, 
  useCallback, 
  useRef,
  Component, 
  lazy, 
  Suspense 
} from 'react';
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
import { t } from '../../utils/translations';

const TopBottomDiffViewer = lazy(() => import('./TopBottomDiffViewer'));
const ColumnCompareViewer = lazy(() => import('./ColumnCompareViewer'));
const ReconcileViewer = lazy(() => import('./ReconcileViewer'));
const BatchCompareViewer = lazy(() => import('./BatchCompareViewer'));
const ExportModal = lazy(() => import('./ExportModal'));

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
    this.locale = props.locale || 'en';
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
        <div className="bg-diff-deleted-bg border border-diff-deleted-border text-diff-deleted-text p-6 space-y-3 my-4 font-mono text-xs">
          <div className="flex items-center gap-2 text-ink font-bold uppercase text-sm">
            <AlertTriangle className="w-5 h-5 text-diff-deleted-text" />
            {t(this.locale, 'comparison.errorTitle', 'ERROR RENDERING SPREADSHEET DIFFERENTIAL VIEW')}
          </div>
          <p>{this.state.error?.message || t(this.locale, 'comparison.errorMsg', 'An unexpected runtime error occurred while diffing or rendering.')}</p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              if (this.props.onReset) this.props.onReset();
            }}
            className="px-4 py-2 bg-[#b91c1c] text-ink hover:bg-red-700 font-bold uppercase transition-colors"
          >
            {t(this.locale, 'comparison.resetWorkspace', 'RESET WORKSPACE')}
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

export default function CompareToolContainer({ initialMode = 'stacked', locale = 'en' }) {
  const [errorMsg, setErrorMsg] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  
  const [sheetNamesA, setSheetNamesA] = useState(initialSample.fileA.sheetNames);
  const [sheetNamesB, setSheetNamesB] = useState(initialSample.fileB.sheetNames);
  const [sheetsA, setSheetsA] = useState(initialSample.fileA.sheets);
  const [sheetsB, setSheetsB] = useState(initialSample.fileB.sheets);
  const [fileNameA, setFileNameA] = useState(initialSample.fileA.fileName);
  const [fileNameB, setFileNameB] = useState(initialSample.fileB.fileName);
  
  const [selectedSheetA, setSelectedSheetA] = useState(initialSheetNameA);
  const [selectedSheetB, setSelectedSheetB] = useState(initialSheetNameB);
  const sheetDataA = sheetsA?.[selectedSheetA] ?? null;
  const sheetDataB = sheetsB?.[selectedSheetB] ?? null;
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
    const code = err.message || 'PARSE_FAILED';
    setErrorMsg(t(locale, `comparison.errors.${code}`, code));
  }, [locale]);

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
      setSheetsA(sample.fileA.sheets);
      setSheetsB(sample.fileB.sheets);
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
    setSheetsA({});
    setSheetsB({});
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
        setSheetsA(parsed.sheets);
        setFileNameA(parsed.fileName);
        setSelectedSheetA(parsed.sheetNames[0]);
      } else {
        setSheetNamesB(parsed.sheetNames);
        setSheetsB(parsed.sheets);
        setFileNameB(parsed.fileName);
        setSelectedSheetB(parsed.sheetNames[0]);
      }
    } catch (err) {
      const code = err && err.message ? err.message : 'PARSE_FAILED';
      const translated = t(locale, `comparison.errors.${code}`, code);
      setErrorMsg(`${t(locale, 'comparison.errorParsingFile', 'Error parsing {file}').replace('{file}', file.name)}: ${translated}. Please ensure it is a valid .xlsx, .xls, or .csv file.`);
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
      setSheetsA({});
      setFileNameA('');
      setSelectedSheetA('');
    } else {
      setSheetNamesB([]);
      setSheetsB({});
      setFileNameB('');
      setSelectedSheetB('');
    }
    clearDiff();
  };

  const isInitialMount = useRef(true);

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
    <div className="space-y-4 max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
      {/* Top Toolbar with Sample Loaders & Controls */}
      <div className="bg-surface-soft border border-hairline p-3 flex flex-col sm:flex-row gap-3 items-start sm:items-center w-full">
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <span className="text-[10px] font-mono text-muted-soft uppercase hidden lg:inline">{t(locale, 'comparison.demoSamples', 'TRY DEMO SAMPLES:')}</span>
          <button
            onClick={() => loadSample('register')}
            className="px-3 py-1.5 text-[11px] font-mono border border-success text-diff-added-text bg-diff-added-bg font-bold hover:brightness-125"
          >
            {t(locale, 'comparison.sampleRegister', 'REGISTER V1/V2')}
          </button>
          <button
            onClick={() => loadSample('financial')}
            className="px-3 py-1.5 text-[11px] font-mono border border-hairline-strong text-link hover:border-link"
          >
            {t(locale, 'comparison.sampleFinancial', 'FINANCIAL Q3/Q4')}
          </button>
          <button
            onClick={() => loadSample('inventory')}
            className="px-3 py-1.5 text-[11px] font-mono border border-hairline-strong text-link hover:border-link"
          >
            {t(locale, 'comparison.sampleInventory', 'INVENTORY SKU')}
          </button>

          {(sheetNamesA.length > 0 || sheetNamesB.length > 0) && (
            <button
              onClick={handleClearAll}
              className="px-3 py-1.5 text-[11px] font-mono border border-hairline-strong text-muted hover:text-ink hover:border-ink transition-all flex items-center gap-1"
              title={t(locale, 'comparison.clearAll', 'Clear current files and show blank dropzones')}
            >
              <RotateCcw className="w-3 h-3" />
              {t(locale, 'comparison.clearAll', 'CLEAR ALL')}
            </button>
          )}
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto border-l border-hairline-strong pl-3 sm:pl-0 sm:border-l-0 ml-0 sm:ml-2">
            <span className="text-[10px] font-mono text-muted-soft uppercase hidden lg:inline">{t(locale, 'comparison.worker', 'WORKER:')}</span>
            <button
              onClick={() => setUseWorker(!useWorker)}
              disabled={!isWorkerSupported()}
              className={`px-2.5 py-1.5 text-[11px] font-mono border rounded transition-all flex items-center gap-1 ${
                useWorker
                  ? 'border-success text-diff-added-text bg-diff-added-bg'
                  : 'border-hairline-strong text-muted hover:border-ink hover:text-ink'
              }`}
              title={useWorker ? t(locale, 'comparison.workerTooltipOn', 'Using Web Worker (click to disable)') : t(locale, 'comparison.workerTooltipOff', 'Using Main Thread (click to enable Web Worker)')}
            >
              <Cpu className="w-3.5 h-3.5" />
              {useWorker ? t(locale, 'comparison.workerOn', 'WORKER') : t(locale, 'comparison.workerOff', 'MAIN')}
            </button>
          </div>
        </div>

        {/* File Upload Header Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* File A Card */}
        <div 
            className={`bg-surface-card border p-3 sm:p-4 space-y-3 transition-colors ${
              isDragActiveA ? 'border-ink bg-surface-elevated' : 'border-hairline'
            }`}
            onDragOver={(e) => handleDragOver(e, 'A')}
            onDragLeave={(e) => handleDragLeave(e, 'A')}
            onDrop={(e) => handleDrop(e, 'A')}
          >
            <div className="flex items-center justify-between border-b border-hairline pb-2">
              <span className="text-caption text-link">{t(locale, 'comparison.file1', 'FILE 1 (ORIGINAL / BEFORE)')}</span>
              {sheetNamesA.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-muted">
                    {sheetNamesA.length} {t(locale, 'comparison.sheets', 'SHEET(S)')}
                  </span>
                  <button 
                    onClick={() => handleRemoveFile('A')}
                    className="text-muted hover:text-ink p-1"
                    title={t(locale, 'comparison.removeFile1', 'Remove File 1')}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {sheetNamesA.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between bg-surface-soft p-2.5 border border-hairline">
                  <div className="flex items-center gap-3 overflow-hidden min-w-0">
                    <FileSpreadsheet className="w-5 h-5 text-success shrink-0" />
                    <span className="min-w-0 text-xs font-mono text-ink truncate">{fileNameA}</span>
                  </div>
                  <label className="text-[10px] font-mono text-link hover:underline cursor-pointer shrink-0 ml-2">
                    {t(locale, 'comparison.change', 'CHANGE')}
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
                      className="w-full bg-canvas border border-hairline-strong text-ink p-1.5 font-mono text-xs focus:outline-none"
                    >
                      {sheetNamesA.map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            ) : (
              <label className={`border-2 border-dashed p-4 sm:p-6 block text-center cursor-pointer transition-colors ${
                isDragActiveA ? 'border-ink bg-surface-elevated' : 'border-hairline-strong hover:border-ink'
              }`}>
                <Upload className="w-6 h-6 text-muted mx-auto mb-2" />
                <span className="text-xs font-mono text-ink block uppercase tracking-wider">{t(locale, 'comparison.dropFile1', 'DROP FILE 1 HERE OR CLICK TO UPLOAD')}</span>
                <span className="text-[10px] font-mono text-muted-soft block mt-1">{t(locale, 'comparison.fileFormats', '.xlsx, .xls, .csv')}</span>
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
            className={`bg-surface-card border p-4 space-y-3 transition-colors ${
              isDragActiveB ? 'border-ink bg-surface-elevated' : 'border-hairline'
            }`}
            onDragOver={(e) => handleDragOver(e, 'B')}
            onDragLeave={(e) => handleDragLeave(e, 'B')}
            onDrop={(e) => handleDrop(e, 'B')}
          >
            <div className="flex items-center justify-between border-b border-hairline pb-2">
              <span className="text-caption text-link">{t(locale, 'comparison.file2', 'FILE 2 (MODIFIED / AFTER)')}</span>
              {sheetNamesB.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-muted">
                    {sheetNamesB.length} {t(locale, 'comparison.sheets', 'SHEET(S)')}
                  </span>
                  <button 
                    onClick={() => handleRemoveFile('B')}
                    className="text-muted hover:text-ink p-1"
                    title={t(locale, 'comparison.removeFile2', 'Remove File 2')}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {sheetNamesB.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between bg-surface-soft p-2.5 border border-hairline">
                  <div className="flex items-center gap-3 overflow-hidden min-w-0">
                    <FileSpreadsheet className="w-5 h-5 text-success shrink-0" />
                    <span className="min-w-0 text-xs font-mono text-ink truncate">{fileNameB}</span>
                  </div>
                  <label className="text-[10px] font-mono text-link hover:underline cursor-pointer shrink-0 ml-2">
                    {t(locale, 'comparison.change', 'CHANGE')}
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
                      className="w-full bg-canvas border border-hairline-strong text-ink p-1.5 font-mono text-xs focus:outline-none"
                    >
                      {sheetNamesB.map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            ) : (
              <label className={`border-2 border-dashed p-4 sm:p-6 block text-center cursor-pointer transition-colors ${
                isDragActiveB ? 'border-ink bg-surface-elevated' : 'border-hairline-strong hover:border-ink'
              }`}>
                <Upload className="w-6 h-6 text-muted mx-auto mb-2" />
                <span className="text-xs font-mono text-ink block uppercase tracking-wider">{t(locale, 'comparison.dropFile2', 'DROP FILE 2 HERE OR CLICK TO UPLOAD')}</span>
                <span className="text-[10px] font-mono text-muted-soft block mt-1">{t(locale, 'comparison.fileFormats', '.xlsx, .xls, .csv')}</span>
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
          <div className="w-8 h-8 border-2 border-ink border-t-transparent animate-spin mx-auto"></div>
          <p className="text-xs font-mono text-ink tracking-widest uppercase">{t(locale, 'comparison.parsing', 'PARSING SPREADSHEETS & COMPUTING DIFF...')}</p>
        </div>
      )}

      {/* Error Banner */}
      {errorMsg && (
        <div className="bg-diff-deleted-bg border border-diff-deleted-border text-diff-deleted-text p-4 text-xs font-mono flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg('')} className="text-ink hover:text-diff-deleted-text">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Guidance Banner when only 1 file is loaded */}
      {!isLoading && !diffData && (sheetNamesA.length > 0 || sheetNamesB.length > 0) && (
        <div className="bg-surface-card border border-hairline p-12 text-center space-y-4">
          <FileSpreadsheet className="w-10 h-10 text-link mx-auto" />
          <h3 className="text-ink font-mono text-sm uppercase tracking-wider">
            {sheetNamesA.length > 0 ? t(locale, 'comparison.file1Loaded', 'FILE 1 ({name}) LOADED').replace('{name}', fileNameA) : t(locale, 'comparison.file2Loaded', 'FILE 2 ({name}) LOADED').replace('{name}', fileNameB)}
          </h3>
          <p className="font-serif text-muted text-sm max-w-md mx-auto">
            {sheetNamesA.length > 0 ? t(locale, 'comparison.needFile2', 'Please upload or drop {file2} in the dropzone above to generate visual cell diffs.').replace('{file2}', t(locale, 'comparison.file2', 'FILE 2 (MODIFIED / AFTER)')) : t(locale, 'comparison.needFile1', 'Please upload or drop {file1} in the dropzone above to generate visual cell diffs.').replace('{file1}', t(locale, 'comparison.file1', 'FILE 1 (ORIGINAL / BEFORE)'))}
          </p>
        </div>
      )}

      {/* Guidance Banner when both files are empty */}
      {!isLoading && sheetNamesA.length === 0 && sheetNamesB.length === 0 && (
        <div className="bg-surface-soft border border-hairline p-12 text-center space-y-4">
          <Upload className="w-10 h-10 text-muted-soft mx-auto" />
          <h3 className="text-ink font-mono text-sm uppercase tracking-wider">{t(locale, 'comparison.dropTwo', 'DROP TWO EXCEL FILES ABOVE TO START')}</h3>
          <p className="font-serif text-sm text-muted max-w-md mx-auto">
            {t(locale, 'comparison.dropTwoDesc', 'Or select one of the demo samples at the top right to instantly test formula differences, row reordering, and set comparisons.')}
          </p>
        </div>
      )}

      {/* Tool View Rendering wrapped in ErrorBoundary */}
      <ErrorBoundary onReset={handleClearAll} locale={locale}>
        <Suspense fallback={<ViewerLoadingSkeleton />}>
          {needsDiffData && !isLoading && !isParsing && diffData && (
            <TopBottomDiffViewer
              diffData={diffData}
              sheetName={selectedSheetA}
              fileAName={fileNameA}
              fileBName={fileNameB}
              onExport={() => setIsExportOpen(true)}
              options={diffOptions}
              onOptionsChange={setDiffOptions}
              locale={locale}
              headersA={sheetA?.rows?.[0]?.map((c, cIdx) => String(c?.val || `Column ${cIdx + 1}`)) || []}
              headersB={sheetB?.rows?.[0]?.map((c, cIdx) => String(c?.val || `Column ${cIdx + 1}`)) || []}
              colWidthsA={sheetA?.colWidths || []}
              colWidthsB={sheetB?.colWidths || []}
            />
          )}
          
          {showColumnViewer && hasDataForColumnReconcile && (
            <ColumnCompareViewer sheetA={sheetA} sheetB={sheetB} locale={locale} />
          )}
          
          {showReconcileViewer && hasDataForColumnReconcile && (
            <ReconcileViewer sheetA={sheetA} sheetB={sheetB} locale={locale} />
          )}
          
          {showBatchViewer && (
            <BatchCompareViewer locale={locale} />
          )}
        </Suspense>
      </ErrorBoundary>

      {/* Export / Share Modal */}
      {isExportOpen && (
        <Suspense fallback={<>
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4" data-export-modal>
            <div className="bg-surface-card border border-hairline p-6 max-w-xl w-full">
              <div className="animate-pulse space-y-4">
                <div className="h-6 w-1/3 bg-hairline rounded" />
                <div className="h-4 w-full bg-hairline rounded" />
                <div className="h-4 w-2/3 bg-hairline rounded" />
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
            locale={locale}
          />
        </Suspense>
      )}
    </div>
  );
}
