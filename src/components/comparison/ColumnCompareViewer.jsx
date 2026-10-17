import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  Columns3, 
  Search, 
  Maximize, 
  Minimize, 
  Filter, 
  FileSpreadsheet, 
  Copy, 
  BarChart2, 
  Layers, 
  Share2, 
  Settings, 
  Sliders, 
  ChevronLeft, 
  ChevronRight, 
  ChevronUp, 
  ChevronDown, 
  Check, 
  Eye, 
  Minimize2, 
  Maximize2, 
  Download, 
  ArrowRight, 
  ArrowUpDown, 
  CheckCircle2, 
  AlertTriangle 
} from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { getColumnLetter } from './diffEngine';
import { useFullView } from './useFullView';
import { 
  CHANGE_CATEGORIES, 
  AUDIT_FLAGS, 
  getCategoryColor, 
  getCategoryPattern, 
  getStructuralColor, 
  getStructuralPattern, 
  groupChanges 
} from './changeCategories';
import { downloadXlsx, copyToClipboard, toCsv, downloadCsv } from './resultsExport';
import CategoryFilter from './CategoryFilter';
import ResultsGrid from './ResultsGrid';
import ChangeHistogram from './ChangeHistogram';
import StatusBar from './StatusBar';
import SheetTabs from './SheetTabs';

const ROW_HEIGHT = 38;
const HEADER_HEIGHT = 42;

export default function ColumnCompareViewer({ 
  sheetA, 
  sheetB,
  sheetNamesA = [],
  sheetNamesB = [],
  selectedSheetA,
  selectedSheetB,
  onSheetAChange,
  onSheetBChange,
  fileNameA = 'File A',
  fileNameB = 'File B',
  onExport,
  onShare,
}) {
  const [colAIndex, setColAIndex] = useState(0);
  const [colBIndex, setColBIndex] = useState(0);
  const [viewMode, setViewMode] = useState('twoPane'); // 'twoPane' | 'breakdown'
  const [alignmentMode, setAlignmentMode] = useState('set'); // 'set' (diff alignment) | 'positional' (row-by-row)
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'diffs' | 'matches' | 'onlyLeft' | 'onlyRight'
  const [searchFilter, setSearchFilter] = useState('');
  const [showLeftSidebar, setShowLeftSidebar] = useState(true);
  const [showRightSidebar, setShowRightSidebar] = useState(true);
  const [syncScroll, setSyncScroll] = useState(true);
  const [fitColumns, setFitColumns] = useState(false);
  const [activeItemIndex, setActiveItemIndex] = useState(0);
  const [selectedDetailItem, setSelectedDetailItem] = useState(null);
  const [copiedExport, setCopiedExport] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [ignoreCase, setIgnoreCase] = useState(false);
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(true);
  const [linkSheets, setLinkSheets] = useState(false);

  // Category filter state
  const [enabledCategories, setEnabledCategories] = useState(() => new Set(CHANGE_CATEGORIES.map(c => c.id)));
  const [enabledAuditFlags, setEnabledAuditFlags] = useState(() => new Set(AUDIT_FLAGS.map(f => f.id)));
  const [hideSystemGenerated, setHideSystemGenerated] = useState(false);
  const [showOnlyFlagged, setShowOnlyFlagged] = useState(false);

  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1024);

  const { isFullView, toggleFullView, exitFullView } = useFullView({ isDesktop });

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const activeSheetNameA = selectedSheetA || sheetA?.name || 'Sheet1';
  const activeSheetNameB = selectedSheetB || sheetB?.name || 'Sheet1';

  const allSheetsA = useMemo(() => {
    if (sheetNamesA && sheetNamesA.length > 0) return sheetNamesA;
    if (sheetA?.name) return [sheetA.name];
    return ['Sheet1'];
  }, [sheetNamesA, sheetA]);

  const allSheetsB = useMemo(() => {
    if (sheetNamesB && sheetNamesB.length > 0) return sheetNamesB;
    if (sheetB?.name) return [sheetB.name];
    return ['Sheet1'];
  }, [sheetNamesB, sheetB]);

  const rowsA = useMemo(() => sheetA?.rows || [], [sheetA]);
  const rowsB = useMemo(() => sheetB?.rows || [], [sheetB]);

  const headersA = useMemo(() => {
    if (!rowsA[0]) return ['Col A'];
    return rowsA[0].map((c, i) => c?.val || `Col ${getColumnLetter(i)}`);
  }, [rowsA]);

  const headersB = useMemo(() => {
    if (!rowsB[0]) return ['Col B'];
    return rowsB[0].map((c, i) => c?.val || `Col ${getColumnLetter(i)}`);
  }, [rowsB]);

  // Adjust column indices if out of bounds
  useEffect(() => {
    if (colAIndex >= headersA.length && headersA.length > 0) {
      setColAIndex(0);
    }
  }, [headersA.length, colAIndex]);

  useEffect(() => {
    if (colBIndex >= headersB.length && headersB.length > 0) {
      setColBIndex(0);
    }
  }, [headersB.length, colBIndex]);

  // Extract raw column items with row indices
  const itemsA = useMemo(() => {
    return rowsA.slice(1).map((row, idx) => {
      const cell = row[colAIndex];
      const val = cell?.val != null ? String(cell.val) : '';
      return {
        val,
        formula: cell?.formula || null,
        origRow: idx + 1,
        cellRef: `${getColumnLetter(colAIndex)}${idx + 2}`,
      };
    });
  }, [rowsA, colAIndex]);

  const itemsB = useMemo(() => {
    return rowsB.slice(1).map((row, idx) => {
      const cell = row[colBIndex];
      const val = cell?.val != null ? String(cell.val) : '';
      return {
        val,
        formula: cell?.formula || null,
        origRow: idx + 1,
        cellRef: `${getColumnLetter(colBIndex)}${idx + 2}`,
      };
    });
  }, [rowsB, colBIndex]);

  // Normalization helper
  const normalize = useCallback((v) => {
    let s = String(v ?? '');
    if (ignoreWhitespace) s = s.trim();
    if (ignoreCase) s = s.toLowerCase();
    return s;
  }, [ignoreWhitespace, ignoreCase]);

  // Check for Excel error formulas/values
  const isErrorValue = useCallback((v) => {
    if (!v) return false;
    const str = String(v).trim().toUpperCase();
    return str.startsWith('#') && (
      str === '#N/A' || 
      str === '#VALUE!' || 
      str === '#REF!' || 
      str === '#DIV/0!' || 
      str === '#NAME?' || 
      str === '#NUM!' || 
      str === '#NULL!'
    );
  }, []);

  // Compute set comparison and aligned items
  const { 
    alignedItems, 
    stats, 
    intersectionList, 
    onlyInAList, 
    onlyInBList 
  } = useMemo(() => {
    // Build frequency maps
    const mapA = new Map();
    itemsA.forEach((item, idx) => {
      const norm = normalize(item.val);
      if (!norm) return;
      if (!mapA.has(norm)) mapA.set(norm, []);
      mapA.get(norm).push({ ...item, aIdx: idx });
    });

    const mapB = new Map();
    itemsB.forEach((item, idx) => {
      const norm = normalize(item.val);
      if (!norm) return;
      if (!mapB.has(norm)) mapB.set(norm, []);
      mapB.get(norm).push({ ...item, bIdx: idx });
    });

    const setA = new Set(mapA.keys());
    const setB = new Set(mapB.keys());

    const intersection = [];
    const onlyA = [];
    const onlyB = [];

    setA.forEach((val) => {
      if (setB.has(val)) {
        intersection.push(val);
      } else {
        onlyA.push(val);
      }
    });

    setB.forEach((val) => {
      if (!setA.has(val)) {
        onlyB.push(val);
      }
    });

    const rows = [];
    let itemIdCounter = 0;

    if (alignmentMode === 'set') {
      // Differential Set Alignment:
      // Walk itemsA; pair matches with itemsB; remaining itemsB append at bottom
      const usedB = new Set();

      itemsA.forEach((itA, idxA) => {
        itemIdCounter++;
        const normA = normalize(itA.val);
        const candidatesB = mapB.get(normA) || [];
        const matchB = candidatesB.find(c => !usedB.has(c.bIdx));

        const flags = [];
        if (isErrorValue(itA.val) || (matchB && isErrorValue(matchB.val))) {
          flags.push('NEW_ERROR');
        }
        if (mapA.get(normA)?.length > 1) {
          flags.push('HARDCODED');
        }

        if (matchB) {
          usedB.add(matchB.bIdx);
          const hasFormula = Boolean(itA.formula || matchB.formula);
          rows.push({
            id: itemIdCounter,
            status: 'MATCH',
            category: hasFormula ? 'CALCULATED_VALUE' : 'ENTERED_VALUE',
            subtype: 'MATCH',
            flags,
            valA: itA.val,
            valB: matchB.val,
            formulaA: itA.formula,
            formulaB: matchB.formula,
            origRowA: itA.origRow,
            origRowB: matchB.origRow,
            cellRefA: itA.cellRef,
            cellRefB: matchB.cellRef,
            cellRef: itA.cellRef,
            sheet: activeSheetNameA,
            rowIdx: idxA,
            description: 'Item exists in both columns (Intersection)',
          });
        } else {
          const hasFormula = Boolean(itA.formula);
          rows.push({
            id: itemIdCounter,
            status: 'ONLY_LEFT',
            category: hasFormula ? 'FORMULA' : 'STRUCTURAL',
            subtype: 'ROW_DELETED',
            flags,
            valA: itA.val,
            valB: '—',
            formulaA: itA.formula,
            formulaB: null,
            origRowA: itA.origRow,
            origRowB: null,
            cellRefA: itA.cellRef,
            cellRefB: '—',
            cellRef: itA.cellRef,
            sheet: activeSheetNameA,
            rowIdx: idxA,
            description: `Only in Left column (${headersA[colAIndex] || 'Col A'}) — missing from File 2`,
          });
        }
      });

      // Append remaining items from B not paired
      itemsB.forEach((itB, idxB) => {
        if (!usedB.has(idxB)) {
          itemIdCounter++;
          const normB = normalize(itB.val);
          const flags = [];
          if (isErrorValue(itB.val)) flags.push('NEW_ERROR');
          if (mapB.get(normB)?.length > 1) flags.push('HARDCODED');
          const hasFormula = Boolean(itB.formula);

          rows.push({
            id: itemIdCounter,
            status: 'ONLY_RIGHT',
            category: hasFormula ? 'FORMULA' : 'STRUCTURAL',
            subtype: 'ROW_ADDED',
            flags,
            valA: '—',
            valB: itB.val,
            formulaA: null,
            formulaB: itB.formula,
            origRowA: null,
            origRowB: itB.origRow,
            cellRefA: '—',
            cellRefB: itB.cellRef,
            cellRef: itB.cellRef,
            sheet: activeSheetNameB,
            rowIdx: itemsA.length + idxB,
            description: `Only in Right column (${headersB[colBIndex] || 'Col B'}) — missing from File 1`,
          });
        }
      });
    } else {
      // Positional (Row-by-Row) Alignment
      const maxRows = Math.max(itemsA.length, itemsB.length);
      for (let i = 0; i < maxRows; i++) {
        itemIdCounter++;
        const itA = itemsA[i];
        const itB = itemsB[i];

        const valA = itA ? itA.val : '—';
        const valB = itB ? itB.val : '—';
        const normA = itA ? normalize(itA.val) : '';
        const normB = itB ? normalize(itB.val) : '';

        const flags = [];
        if (isErrorValue(valA) || isErrorValue(valB)) flags.push('NEW_ERROR');
        if ((itA && mapA.get(normA)?.length > 1) || (itB && mapB.get(normB)?.length > 1)) {
          flags.push('HARDCODED');
        }

        if (itA && itB) {
          if (normA === normB) {
            rows.push({
              id: itemIdCounter,
              status: 'MATCH',
              category: (itA.formula || itB.formula) ? 'CALCULATED_VALUE' : 'ENTERED_VALUE',
              subtype: 'MATCH',
              flags,
              valA,
              valB,
              formulaA: itA.formula,
              formulaB: itB.formula,
              origRowA: itA.origRow,
              origRowB: itB.origRow,
              cellRefA: itA.cellRef,
              cellRefB: itB.cellRef,
              cellRef: itA.cellRef,
              sheet: activeSheetNameA,
              rowIdx: i,
              description: 'Row values match',
            });
          } else {
            rows.push({
              id: itemIdCounter,
              status: 'MODIFIED',
              category: (itA.formula || itB.formula) ? 'FORMULA' : 'ENTERED_VALUE',
              subtype: 'VALUE_CHANGED',
              flags,
              valA,
              valB,
              formulaA: itA.formula,
              formulaB: itB.formula,
              origRowA: itA.origRow,
              origRowB: itB.origRow,
              cellRefA: itA.cellRef,
              cellRefB: itB.cellRef,
              cellRef: `${itA.cellRef} ↔ ${itB.cellRef}`,
              sheet: activeSheetNameA,
              rowIdx: i,
              description: 'Row values differ between File 1 and File 2',
            });
          }
        } else if (itA) {
          rows.push({
            id: itemIdCounter,
            status: 'ONLY_LEFT',
            category: itA.formula ? 'FORMULA' : 'STRUCTURAL',
            subtype: 'ROW_DELETED',
            flags,
            valA,
            valB: '—',
            formulaA: itA.formula,
            formulaB: null,
            origRowA: itA.origRow,
            origRowB: null,
            cellRefA: itA.cellRef,
            cellRefB: '—',
            cellRef: itA.cellRef,
            sheet: activeSheetNameA,
            rowIdx: i,
            description: 'Row exists only in File 1',
          });
        } else {
          rows.push({
            id: itemIdCounter,
            status: 'ONLY_RIGHT',
            category: itB.formula ? 'FORMULA' : 'STRUCTURAL',
            subtype: 'ROW_ADDED',
            flags,
            valA: '—',
            valB,
            formulaA: null,
            formulaB: itB.formula,
            origRowA: null,
            origRowB: itB.origRow,
            cellRefA: '—',
            cellRefB: itB.cellRef,
            cellRef: itB.cellRef,
            sheet: activeSheetNameB,
            rowIdx: i,
            description: 'Row exists only in File 2',
          });
        }
      }
    }

    const statsObj = {
      totalA: itemsA.length,
      totalB: itemsB.length,
      uniqueA: setA.size,
      uniqueB: setB.size,
      intersectionCount: intersection.length,
      onlyInACount: onlyA.length,
      onlyInBCount: onlyB.length,
      totalAligned: rows.length,
    };

    return {
      alignedItems: rows,
      stats: statsObj,
      intersectionList: intersection,
      onlyInAList: onlyA,
      onlyInBList: onlyB,
    };
  }, [itemsA, itemsB, alignmentMode, normalize, isErrorValue, activeSheetNameA, activeSheetNameB, headersA, headersB, colAIndex, colBIndex]);

  // Category & Audit counts
  const categoryCounts = useMemo(() => {
    const counts = {};
    CHANGE_CATEGORIES.forEach(c => { counts[c.id] = 0; });
    alignedItems.forEach(item => {
      const cat = item.category || 'ENTERED_VALUE';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [alignedItems]);

  const auditCounts = useMemo(() => {
    const counts = {};
    AUDIT_FLAGS.forEach(f => { counts[f.id] = 0; });
    alignedItems.forEach(item => {
      if (item.flags) {
        item.flags.forEach(flag => {
          counts[flag] = (counts[flag] || 0) + 1;
        });
      }
    });
    return counts;
  }, [alignedItems]);

  // Filtered items based on filter tab, search query, categories & audit flags
  const filteredItems = useMemo(() => {
    return alignedItems.filter(item => {
      // 1. Tab filter
      if (filterTab === 'diffs' && item.status === 'MATCH') return false;
      if (filterTab === 'matches' && item.status !== 'MATCH') return false;
      if (filterTab === 'onlyLeft' && item.status !== 'ONLY_LEFT') return false;
      if (filterTab === 'onlyRight' && item.status !== 'ONLY_RIGHT') return false;

      // 2. Category filter
      const cat = item.category || 'ENTERED_VALUE';
      if (!enabledCategories.has(cat)) return false;
      if (hideSystemGenerated && (cat === 'SYSGEN_FORMULA' || cat === 'SYSGEN_NAMES')) return false;

      // 3. Audit filter
      if (showOnlyFlagged && (!item.flags || item.flags.length === 0)) return false;
      if (item.flags && item.flags.length > 0) {
        const hasEnabledFlag = item.flags.some(f => enabledAuditFlags.has(f));
        if (!hasEnabledFlag && showOnlyFlagged) return false;
      }

      // 4. Search query
      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase();
        const inA = String(item.valA || '').toLowerCase().includes(q);
        const inB = String(item.valB || '').toLowerCase().includes(q);
        const inRef = String(item.cellRef || '').toLowerCase().includes(q);
        const inDesc = String(item.description || '').toLowerCase().includes(q);
        if (!inA && !inB && !inRef && !inDesc) return false;
      }

      return true;
    });
  }, [alignedItems, filterTab, enabledCategories, hideSystemGenerated, showOnlyFlagged, enabledAuditFlags, searchFilter]);

  // Items formatted for Details Grid (ResultsGrid)
  const detailsGridItems = useMemo(() => {
    return filteredItems.map(item => ({
      id: item.id,
      sheet: item.sheet,
      cell: item.cellRef || '—',
      valA: item.valA || '—',
      valB: item.valB || '—',
      category: item.category,
      subtype: item.subtype,
      description: item.description,
      rowIdx: item.rowIdx,
      flags: item.flags,
    }));
  }, [filteredItems]);

  // Histogram items (differences or all filtered)
  const histogramItems = useMemo(() => {
    return filteredItems.map(item => ({
      rowIdx: item.rowIdx,
      category: item.category || 'ENTERED_VALUE',
    }));
  }, [filteredItems]);

  // Virtualizer for Two-Pane Grid
  const scrollContainerRef = useRef(null);
  const rowVirtualizer = useVirtualizer({
    count: filteredItems.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalHeight = rowVirtualizer.getTotalSize();

  // Jump to item function
  const jumpToIndex = useCallback((index) => {
    if (!filteredItems.length) return;
    const targetIdx = Math.max(0, Math.min(index, filteredItems.length - 1));
    setActiveItemIndex(targetIdx);
    rowVirtualizer.scrollToIndex(targetIdx, { align: 'center', behavior: 'auto' });
  }, [filteredItems, rowVirtualizer]);

  const jumpToRowIdx = useCallback((rowIdx) => {
    const targetIndex = filteredItems.findIndex(i => i.rowIdx === rowIdx);
    if (targetIndex >= 0) {
      jumpToIndex(targetIndex);
    }
  }, [filteredItems, jumpToIndex]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        jumpToIndex(activeItemIndex + 1);
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        jumpToIndex(activeItemIndex - 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeItemIndex, jumpToIndex]);

  // Export functions
  const handleExportXlsx = async () => {
    setShowExportMenu(false);
    const summaryRows = [
      { Metric: 'File 1 Name', Value: fileNameA },
      { Metric: 'File 1 Sheet', Value: activeSheetNameA },
      { Metric: 'File 1 Column', Value: headersA[colAIndex] || `Col ${getColumnLetter(colAIndex)}` },
      { Metric: 'File 1 Total Items', Value: itemsA.length },
      { Metric: 'File 1 Unique Items', Value: stats.uniqueA },
      { Metric: 'File 2 Name', Value: fileNameB },
      { Metric: 'File 2 Sheet', Value: activeSheetNameB },
      { Metric: 'File 2 Column', Value: headersB[colBIndex] || `Col ${getColumnLetter(colBIndex)}` },
      { Metric: 'File 2 Total Items', Value: itemsB.length },
      { Metric: 'File 2 Unique Items', Value: stats.uniqueB },
      { Metric: 'Intersection (Matching)', Value: stats.intersectionCount },
      { Metric: 'Only in File 1', Value: stats.onlyInACount },
      { Metric: 'Only in File 2', Value: stats.onlyInBCount },
      { Metric: 'Alignment Mode', Value: alignmentMode },
    ];

    const comparisonRows = alignedItems.map((item, idx) => ({
      Index: idx + 1,
      'Row (File 1)': item.origRowA != null ? item.origRowA : '—',
      'Value (File 1)': item.valA || '',
      'Row (File 2)': item.origRowB != null ? item.origRowB : '—',
      'Value (File 2)': item.valB || '',
      Status: item.status,
      Category: item.category,
      Flags: item.flags?.join(', ') || '',
      Description: item.description,
    }));

    const intersectionRows = intersectionList.map((val, idx) => ({
      Index: idx + 1,
      'Matching Value': val,
    }));

    const onlyInARows = onlyInAList.map((val, idx) => ({
      Index: idx + 1,
      [`Only in ${fileNameA}`]: val,
    }));

    const onlyInBRows = onlyInBList.map((val, idx) => ({
      Index: idx + 1,
      [`Only in ${fileNameB}`]: val,
    }));

    const sheets = {
      'Summary': summaryRows,
      'Comparison': comparisonRows,
      'Intersection': intersectionRows,
      'Only Left': onlyInARows,
      'Only Right': onlyInBRows,
    };

    downloadXlsx({ summaryRows, sheets });
  };

  const handleCopyCsv = async () => {
    setShowExportMenu(false);
    const headers = ['Index', 'File 1 Row', 'File 1 Value', 'File 2 Row', 'File 2 Value', 'Status', 'Category', 'Description'];
    const rows = filteredItems.map((item, idx) => ({
      Index: idx + 1,
      'File 1 Row': item.origRowA != null ? item.origRowA : '—',
      'File 1 Value': item.valA || '',
      'File 2 Row': item.origRowB != null ? item.origRowB : '—',
      'File 2 Value': item.valB || '',
      Status: item.status,
      Category: item.category,
      Description: item.description,
    }));
    const csv = toCsv(rows, headers);
    await copyToClipboard(csv);
    setCopiedExport(true);
    setTimeout(() => setCopiedExport(false), 2000);
  };

  const handleDownloadCsv = () => {
    setShowExportMenu(false);
    const headers = ['Index', 'File 1 Row', 'File 1 Value', 'File 2 Row', 'File 2 Value', 'Status', 'Category', 'Description'];
    const rows = filteredItems.map((item, idx) => ({
      Index: idx + 1,
      'File 1 Row': item.origRowA != null ? item.origRowA : '—',
      'File 1 Value': item.valA || '',
      'File 2 Row': item.origRowB != null ? item.origRowB : '—',
      'File 2 Value': item.valB || '',
      Status: item.status,
      Category: item.category,
      Description: item.description,
    }));
    const csv = toCsv(rows, headers);
    downloadCsv(csv, `column-compare-${Date.now()}.csv`);
  };

  const handleShare = () => {
    if (onShare) onShare();
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const activeItem = filteredItems[activeItemIndex];

  return (
    <div className={isFullView ? 'fixed inset-0 z-[60] bg-[#000000] flex flex-col gap-4 p-4 overflow-y-auto lg:overflow-hidden' : 'space-y-4'}>
      {/* Top Main Toolbar */}
      <div className="shrink-0 bg-[#141414] border border-[#262626] p-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {/* Toggle Left Sidebar */}
          <button
            onClick={() => setShowLeftSidebar(!showLeftSidebar)}
            className={`p-1.5 text-xs font-mono border rounded transition-all ${
              showLeftSidebar
                ? 'border-[#5fa657] text-[#5fa657] bg-[#062c19]'
                : 'border-[#3a3a3a] text-[#999999] hover:border-white hover:text-white'
            }`}
            title="Toggle Left Filters Sidebar"
          >
            <Sliders className="w-4 h-4 inline" />
            <span className="ml-1 text-[11px] font-bold hidden sm:inline">
              {showLeftSidebar ? 'HIDE TOOLS' : 'SHOW TOOLS'}
            </span>
          </button>

          <div className="h-4 w-px bg-[#262626] mx-1" />

          {/* Layout Mode */}
          <span className="text-[10px] font-mono text-[#999999] uppercase tracking-wider hidden md:inline">LAYOUT:</span>
          <button
            onClick={() => setViewMode('twoPane')}
            className={`px-3 py-1.5 text-xs font-mono tracking-wider uppercase border rounded-full transition-all ${
              viewMode === 'twoPane'
                ? 'border-white text-white bg-[#1f1f1f] font-bold'
                : 'border-[#3a3a3a] text-[#999999] hover:border-white hover:text-white'
            }`}
          >
            <Columns3 className="w-3.5 h-3.5 inline mr-1" />
            Two-Pane
          </button>
          <button
            onClick={() => setViewMode('breakdown')}
            className={`px-3 py-1.5 text-xs font-mono tracking-wider uppercase border rounded-full transition-all ${
              viewMode === 'breakdown'
                ? 'border-white text-white bg-[#1f1f1f] font-bold'
                : 'border-[#3a3a3a] text-[#999999] hover:border-white hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5 inline mr-1" />
            Breakdown
          </button>

          <div className="h-4 w-px bg-[#262626] mx-1" />

          {/* Filter Tabs */}
          <span className="text-[10px] font-mono text-[#999999] uppercase tracking-wider hidden xl:inline">SHOW:</span>
          <div className="hidden sm:flex items-center gap-1 bg-[#000000] p-1 border border-[#262626] rounded">
            <button
              onClick={() => setFilterTab('all')}
              className={`px-2 py-0.5 text-[11px] font-mono uppercase tracking-wider rounded transition-all ${
                filterTab === 'all' ? 'bg-white text-black font-bold' : 'text-[#999999] hover:text-white'
              }`}
            >
              All ({alignedItems.length})
            </button>
            <button
              onClick={() => setFilterTab('diffs')}
              className={`px-2 py-0.5 text-[11px] font-mono uppercase tracking-wider rounded transition-all ${
                filterTab === 'diffs' ? 'bg-[#3b1219] text-[#fca5a5] font-bold border border-[#b91c1c]' : 'text-[#999999] hover:text-[#fca5a5]'
              }`}
            >
              Diffs ({stats.onlyInACount + stats.onlyInBCount})
            </button>
            <button
              onClick={() => setFilterTab('matches')}
              className={`px-2 py-0.5 text-[11px] font-mono uppercase tracking-wider rounded transition-all ${
                filterTab === 'matches' ? 'bg-[#062c19] text-[#6ee7b7] font-bold border border-[#047857]' : 'text-[#999999] hover:text-[#6ee7b7]'
              }`}
            >
              Matches ({stats.intersectionCount})
            </button>
            <button
              onClick={() => setFilterTab('onlyLeft')}
              className={`px-2 py-0.5 text-[11px] font-mono uppercase tracking-wider rounded transition-all ${
                filterTab === 'onlyLeft' ? 'bg-[#3b1219] text-[#fca5a5] font-bold' : 'text-[#999999] hover:text-[#fca5a5]'
              }`}
            >
              Only Left ({stats.onlyInACount})
            </button>
            <button
              onClick={() => setFilterTab('onlyRight')}
              className={`px-2 py-0.5 text-[11px] font-mono uppercase tracking-wider rounded transition-all ${
                filterTab === 'onlyRight' ? 'bg-[#2d2208] text-[#fcd34d] font-bold' : 'text-[#999999] hover:text-[#fcd34d]'
              }`}
            >
              Only Right ({stats.onlyInBCount})
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#666666]" />
            <input
              type="text"
              placeholder="Search values..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="bg-[#000000] border border-[#3a3a3a] pl-8 pr-3 py-1 text-xs font-mono text-white placeholder-[#666666] focus:outline-none focus:border-white w-40 sm:w-56"
            />
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Fit Columns Toggle */}
          <button
            onClick={() => setFitColumns(!fitColumns)}
            className={`px-2.5 py-1.5 text-xs font-mono border rounded transition-all flex items-center gap-1 ${
              fitColumns
                ? 'border-[#c3d9f3] text-[#c3d9f3] bg-[#1e1b4b]'
                : 'border-[#3a3a3a] text-[#999999] hover:border-white hover:text-white'
            }`}
            title={fitColumns ? 'Disable Fit Width (use fixed scrollable width)' : 'Fit Columns to Container Width'}
          >
            <Columns3 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-[11px] font-bold">
              {fitColumns ? 'EXPANDED' : 'FIT WIDTH'}
            </span>
          </button>

          {/* Full View Toggle */}
          <button
            onClick={toggleFullView}
            className={`p-1.5 text-xs font-mono border rounded transition-all ${
              isFullView
                ? 'border-[#5fa657] text-[#5fa657] bg-[#062c19]'
                : 'border-[#3a3a3a] text-[#999999] hover:border-white hover:text-white'
            }`}
            title={isFullView ? 'Exit Full View' : 'Enter Full View'}
            aria-pressed={isFullView}
          >
            {isFullView ? <Minimize className="w-4 h-4 inline" /> : <Maximize className="w-4 h-4 inline" />}
            <span className="ml-1 text-[11px] font-bold hidden sm:inline">
              {isFullView ? 'EXIT FULL' : 'FULL VIEW'}
            </span>
          </button>

          {/* Export Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="btn-primary py-1.5 px-3 text-xs h-8 tracking-[1px] flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5 inline" />
              <span>EXPORT</span>
              <ChevronDown className="w-3.5 h-3.5 inline ml-0.5" />
            </button>
            {showExportMenu && (
              <div className="absolute right-0 top-full mt-1 bg-[#141414] border border-[#262626] p-2 rounded shadow-2xl z-50 min-w-[180px] space-y-1">
                <button
                  onClick={handleExportXlsx}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-mono text-[#cccccc] hover:text-white hover:bg-[#262626] rounded text-left transition-colors"
                >
                  <FileSpreadsheet className="w-4 h-4 text-[#5fa657]" />
                  Export XLSX
                </button>
                <button
                  onClick={handleCopyCsv}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-mono text-[#cccccc] hover:text-white hover:bg-[#262626] rounded text-left transition-colors"
                >
                  <Copy className="w-4 h-4 text-[#c3d9f3]" />
                  {copiedExport ? 'Copied to Clipboard!' : 'Copy CSV'}
                </button>
                <button
                  onClick={handleDownloadCsv}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-mono text-[#cccccc] hover:text-white hover:bg-[#262626] rounded text-left transition-colors"
                >
                  <Download className="w-4 h-4 text-[#fcd34d]" />
                  Download CSV
                </button>
                {onExport && (
                  <button
                    onClick={() => { setShowExportMenu(false); onExport(); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-mono text-[#cccccc] hover:text-white hover:bg-[#262626] rounded text-left border-t border-[#262626] pt-2 transition-colors"
                  >
                    <Filter className="w-4 h-4" />
                    Advanced Export…
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Share Button */}
          <button
            onClick={handleShare}
            className="btn-secondary py-1.5 px-3 text-xs h-8 tracking-[1px]"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 inline mr-1 text-[#5fa657]" /> : <Share2 className="w-3.5 h-3.5 inline mr-1" />}
            {copiedLink ? 'Copied' : 'Share'}
          </button>

          <div className="h-4 w-px bg-[#262626] mx-1" />

          {/* Toggle Right Details Sidebar */}
          <button
            onClick={() => setShowRightSidebar(!showRightSidebar)}
            className={`p-1.5 text-xs font-mono border rounded transition-all ${
              showRightSidebar
                ? 'border-[#c3d9f3] text-[#c3d9f3] bg-[#1e1b4b]'
                : 'border-[#3a3a3a] text-[#999999] hover:border-white hover:text-white'
            }`}
            title="Toggle Right Details Sidebar"
          >
            <span className="mr-1 text-[11px] font-bold hidden sm:inline">
              {showRightSidebar ? 'HIDE AUDIT' : 'SHOW AUDIT'}
            </span>
            <Layers className="w-4 h-4 inline" />
          </button>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className={`grid grid-cols-1 lg:grid-cols-12 gap-4 ${isFullView ? 'flex-1 min-h-0 items-stretch h-full' : 'items-start'}`}>
        
        {/* Left Sidebar: Tools, Column Pickers & Category Filter */}
        {showLeftSidebar && (
          <div className={`lg:col-span-3 bg-[#141414] border border-[#262626] p-4 space-y-6 select-none transition-all ${isFullView ? 'h-full min-h-0 overflow-y-auto' : ''}`}>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#262626] pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#c3d9f3]" />
                <span className="text-xs font-mono text-white font-bold uppercase tracking-wider">Column Setup</span>
              </div>
              <button onClick={() => setShowLeftSidebar(false)} className="text-[#666666] hover:text-white transition-colors" title="Collapse Sidebar">
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>

            {/* Column Pickers */}
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-mono text-[#c3d9f3] uppercase font-bold block mb-1">
                  FILE 1 (LEFT) COLUMN:
                </label>
                <select
                  value={colAIndex}
                  onChange={(e) => setColAIndex(Number(e.target.value))}
                  className="w-full bg-[#000000] border border-[#3a3a3a] text-white p-2 font-mono text-xs focus:border-white focus:outline-none"
                >
                  {headersA.map((h, i) => (
                    <option key={i} value={i}>
                      Col {getColumnLetter(i)}: {h}
                    </option>
                  ))}
                </select>
                <div className="text-[10px] font-mono text-[#999999] mt-1 flex justify-between">
                  <span>Items: {itemsA.length}</span>
                  <span>Unique: {stats.uniqueA}</span>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-mono text-[#fca5a5] uppercase font-bold block mb-1">
                  FILE 2 (RIGHT) COLUMN:
                </label>
                <select
                  value={colBIndex}
                  onChange={(e) => setColBIndex(Number(e.target.value))}
                  className="w-full bg-[#000000] border border-[#3a3a3a] text-white p-2 font-mono text-xs focus:border-white focus:outline-none"
                >
                  {headersB.map((h, i) => (
                    <option key={i} value={i}>
                      Col {getColumnLetter(i)}: {h}
                    </option>
                  ))}
                </select>
                <div className="text-[10px] font-mono text-[#999999] mt-1 flex justify-between">
                  <span>Items: {itemsB.length}</span>
                  <span>Unique: {stats.uniqueB}</span>
                </div>
              </div>
            </div>

            {/* Alignment Mode & Comparison Options */}
            <div className="space-y-3 border-t border-[#262626] pt-4">
              <div className="text-[11px] font-mono text-[#999999] uppercase tracking-wider font-semibold">
                Alignment & Matching
              </div>
              <div className="grid grid-cols-2 gap-1 bg-[#000000] p-1 border border-[#262626]">
                <button
                  onClick={() => setAlignmentMode('set')}
                  className={`py-1.5 text-xs font-mono text-center transition-all ${
                    alignmentMode === 'set' ? 'bg-white text-black font-bold' : 'text-[#999999] hover:text-white'
                  }`}
                  title="Differential alignment: items matched by value across lists"
                >
                  Set Diff
                </button>
                <button
                  onClick={() => setAlignmentMode('positional')}
                  className={`py-1.5 text-xs font-mono text-center transition-all ${
                    alignmentMode === 'positional' ? 'bg-white text-black font-bold' : 'text-[#999999] hover:text-white'
                  }`}
                  title="Positional alignment: row 1 compared with row 1 directly"
                >
                  Row-by-Row
                </button>
              </div>

              <label className="flex items-center justify-between text-xs font-mono text-[#cccccc] cursor-pointer hover:text-white transition-colors">
                <span>Ignore white space</span>
                <input
                  type="checkbox"
                  checked={ignoreWhitespace}
                  onChange={(e) => setIgnoreWhitespace(e.target.checked)}
                  className="w-4 h-4 accent-[#5fa657]"
                />
              </label>

              <label className="flex items-center justify-between text-xs font-mono text-[#cccccc] cursor-pointer hover:text-white transition-colors">
                <span>Ignore case</span>
                <input
                  type="checkbox"
                  checked={ignoreCase}
                  onChange={(e) => setIgnoreCase(e.target.checked)}
                  className="w-4 h-4 accent-[#5fa657]"
                />
              </label>
            </div>

            {/* Set Metric Badges */}
            <div className="space-y-2 border-t border-[#262626] pt-4">
              <div className="text-[11px] font-mono text-[#999999] uppercase tracking-wider font-semibold">
                Set Breakdown
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-[#062c19] border border-[#047857] p-2 text-center">
                  <div className="text-lg font-display text-[#6ee7b7]">{stats.intersectionCount}</div>
                  <div className="text-[9px] font-mono text-[#6ee7b7] uppercase truncate">BOTH</div>
                </div>
                <div className="bg-[#3b1219] border border-[#b91c1c] p-2 text-center">
                  <div className="text-lg font-display text-[#fca5a5]">{stats.onlyInACount}</div>
                  <div className="text-[9px] font-mono text-[#fca5a5] uppercase truncate">ONLY LEFT</div>
                </div>
                <div className="bg-[#2d2208] border border-[#78350f] p-2 text-center">
                  <div className="text-lg font-display text-[#fcd34d]">{stats.onlyInBCount}</div>
                  <div className="text-[9px] font-mono text-[#fcd34d] uppercase truncate">ONLY RIGHT</div>
                </div>
              </div>
            </div>

            {/* Category Filter Integration */}
            <div className="border-t border-[#262626] pt-4">
              <CategoryFilter
                categories={CHANGE_CATEGORIES}
                counts={categoryCounts}
                enabled={enabledCategories}
                onChange={setEnabledCategories}
                auditFlags={AUDIT_FLAGS}
                auditCounts={auditCounts}
                auditEnabled={enabledAuditFlags}
                onAuditChange={setEnabledAuditFlags}
                showOnlyFlagged={showOnlyFlagged}
                onShowOnlyFlaggedChange={(e) => setShowOnlyFlagged(e.target.checked)}
                onHideSystemGenerated={() => setHideSystemGenerated(!hideSystemGenerated)}
                hideSystemGenerated={hideSystemGenerated}
              />
            </div>
          </div>
        )}

        {/* Center Workspace: Sheet Tabs + Two-Pane Grid / Breakdown */}
        <div className={`${
          showLeftSidebar && showRightSidebar ? 'lg:col-span-6' :
          showLeftSidebar || showRightSidebar ? 'lg:col-span-9' : 'lg:col-span-12'
        } bg-[#0d0d0d] border border-[#262626] space-y-0 transition-all min-w-0 ${isFullView ? 'min-h-0 flex flex-col' : ''}`}>

          {/* Sheet Tabs Integration */}
          <SheetTabs
            sheets={allSheetsA}
            activeSheet={activeSheetNameA}
            onSheetChange={(s) => {
              if (onSheetAChange) onSheetAChange(s);
            }}
            changeCounts={categoryCounts}
            linkSheets={linkSheets}
            otherSheets={allSheetsB}
            otherActiveSheet={activeSheetNameB}
            onLinkSheetsChange={setLinkSheets}
            side="A"
          />

          {/* Subheader info bar */}
          <div className="shrink-0 bg-[#141414] px-4 py-2 border-b border-[#262626] flex items-center justify-between text-xs font-mono uppercase text-white select-none">
            <div className="flex items-center gap-4 truncate">
              <span className="font-bold text-[#c3d9f3]">
                {headersA[colAIndex] || 'COL A'} ↔ {headersB[colBIndex] || 'COL B'}
              </span>
              <span className="text-[10px] text-[#666666] hidden sm:inline">
                {filteredItems.length} OF {alignedItems.length} ROWS DISPLAYED
              </span>
              <span className="px-2 py-0.5 text-[9px] font-mono bg-[#1f1f1f] border border-[#3a3a3a] text-[#cccccc] rounded">
                MODE: {alignmentMode.toUpperCase()}
              </span>
            </div>
            {activeItem && (
              <div className="text-[11px] text-[#fcd34d] font-mono animate-pulse hidden md:block">
                ACTIVE: {activeItem.cellRef || `#${activeItem.id}`} ({activeItem.status})
              </div>
            )}
          </div>

          {/* View Container */}
          {viewMode === 'twoPane' ? (
            <div className={`p-3 space-y-0 ${isFullView ? 'flex-1 min-h-0 flex flex-col' : ''}`}>
              {/* Sticky Pane Dual Headers */}
              <div className={`grid grid-cols-2 border border-[#262626] bg-[#000000] text-xs font-mono uppercase tracking-wider select-none shrink-0 ${
                fitColumns ? 'w-full' : 'min-w-[700px]'
              }`}>
                {/* Left Pane Header */}
                <div className="p-2.5 border-r border-[#262626] flex items-center justify-between text-[#c3d9f3] bg-[#000000]">
                  <div className="flex items-center gap-2 truncate">
                    <span className="w-2 h-2 rounded-full bg-[#3b82f6]" />
                    <span className="font-bold truncate">FILE 1: {fileNameA}</span>
                    <span className="text-[10px] text-[#999999] truncate">[{headersA[colAIndex] || 'Col A'}]</span>
                  </div>
                  <span className="text-[10px] text-[#999999] tabular-nums shrink-0">{itemsA.length} ITEMS</span>
                </div>

                {/* Right Pane Header */}
                <div className="p-2.5 flex items-center justify-between text-[#fca5a5] bg-[#000000]">
                  <div className="flex items-center gap-2 truncate">
                    <span className="w-2 h-2 rounded-full bg-[#f43f5e]" />
                    <span className="font-bold truncate">FILE 2: {fileNameB}</span>
                    <span className="text-[10px] text-[#999999] truncate">[{headersB[colBIndex] || 'Col B'}]</span>
                  </div>
                  <span className="text-[10px] text-[#999999] tabular-nums shrink-0">{itemsB.length} ITEMS</span>
                </div>
              </div>

              {/* Column labels sub-header */}
              <div className={`grid grid-cols-2 border-x border-b border-[#262626] bg-[#141414] text-[10px] font-mono text-[#999999] uppercase tracking-wider select-none shrink-0 ${
                fitColumns ? 'w-full' : 'min-w-[700px]'
              }`}>
                <div className="grid grid-cols-12 px-2 py-1 border-r border-[#262626]">
                  <span className="col-span-2 text-[#666666]"># ROW</span>
                  <span className="col-span-7">VALUE</span>
                  <span className="col-span-3 text-right">STATUS</span>
                </div>
                <div className="grid grid-cols-12 px-2 py-1">
                  <span className="col-span-2 text-[#666666]"># ROW</span>
                  <span className="col-span-7">VALUE</span>
                  <span className="col-span-3 text-right">STATUS</span>
                </div>
              </div>

              {/* Two-Pane Virtualized Rows Container */}
              <div 
                ref={scrollContainerRef}
                className={`overflow-auto border-x border-b border-[#262626] bg-[#0d0d0d] relative ${
                  isFullView ? 'flex-1 min-h-[350px]' : 'h-[520px]'
                }`}
                style={{ contain: 'strict' }}
              >
                <div 
                  style={{ 
                    height: `${totalHeight}px`, 
                    width: '100%', 
                    position: 'relative',
                    minWidth: fitColumns ? '100%' : '700px'
                  }}
                >
                  {virtualRows.map((virtualRow) => {
                    const item = filteredItems[virtualRow.index];
                    const isRowFocused = activeItemIndex === virtualRow.index;
                    const catColor = item.category ? getCategoryColor(item.category) : '#999999';
                    const isEven = virtualRow.index % 2 === 0;

                    return (
                      <div
                        key={item.id}
                        data-index={virtualRow.index}
                        onClick={() => {
                          setActiveItemIndex(virtualRow.index);
                          setSelectedDetailItem(item);
                        }}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: `${virtualRow.size}px`,
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                        className={`grid grid-cols-2 cursor-pointer transition-colors border-b border-[#262626] ${
                          isRowFocused ? 'ring-2 ring-[#fcd34d] bg-[#1f1f1f] z-10' : (isEven ? 'bg-[#0d0d0d]' : 'bg-[#141414]')
                        } hover:bg-[#1a1a1a]`}
                      >
                        {/* Left Half Cell (File 1) */}
                        <div 
                          className="grid grid-cols-12 items-center px-2 py-1.5 border-r border-[#262626] overflow-hidden"
                          style={{ borderLeft: `3px solid ${catColor}` }}
                        >
                          <span className="col-span-2 text-[10px] font-mono text-[#666666] tabular-nums truncate">
                            {item.origRowA != null ? item.origRowA : '—'}
                          </span>
                          <span className={`col-span-7 font-mono text-xs truncate pr-2 ${
                            item.status === 'ONLY_LEFT' ? 'text-[#fca5a5] font-semibold' : 
                            item.status === 'MATCH' ? 'text-[#e6e6e6]' : 'text-[#cccccc]'
                          }`} title={item.valA}>
                            {item.valA || <span className="text-[#555555] italic">—</span>}
                          </span>
                          <div className="col-span-3 flex justify-end">
                            {item.status === 'MATCH' && (
                              <span className="px-1.5 py-0.5 text-[9px] font-mono bg-[#062c19] text-[#6ee7b7] border border-[#047857] rounded uppercase">
                                MATCH
                              </span>
                            )}
                            {item.status === 'ONLY_LEFT' && (
                              <span className="px-1.5 py-0.5 text-[9px] font-mono bg-[#3b1219] text-[#fca5a5] border border-[#b91c1c] rounded uppercase">
                                ONLY LEFT
                              </span>
                            )}
                            {item.status === 'ONLY_RIGHT' && (
                              <span className="text-[9px] font-mono text-[#555555] italic">
                                [NOT IN F1]
                              </span>
                            )}
                            {item.status === 'MODIFIED' && (
                              <span className="px-1.5 py-0.5 text-[9px] font-mono bg-[#2d2208] text-[#fcd34d] border border-[#78350f] rounded uppercase">
                                DIFF
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Right Half Cell (File 2) */}
                        <div className="grid grid-cols-12 items-center px-2 py-1.5 overflow-hidden">
                          <span className="col-span-2 text-[10px] font-mono text-[#666666] tabular-nums truncate">
                            {item.origRowB != null ? item.origRowB : '—'}
                          </span>
                          <span className={`col-span-7 font-mono text-xs truncate pr-2 ${
                            item.status === 'ONLY_RIGHT' ? 'text-[#fcd34d] font-semibold' : 
                            item.status === 'MATCH' ? 'text-[#e6e6e6]' : 'text-[#cccccc]'
                          }`} title={item.valB}>
                            {item.valB || <span className="text-[#555555] italic">—</span>}
                          </span>
                          <div className="col-span-3 flex justify-end">
                            {item.status === 'MATCH' && (
                              <span className="px-1.5 py-0.5 text-[9px] font-mono bg-[#062c19] text-[#6ee7b7] border border-[#047857] rounded uppercase">
                                MATCH
                              </span>
                            )}
                            {item.status === 'ONLY_RIGHT' && (
                              <span className="px-1.5 py-0.5 text-[9px] font-mono bg-[#2d2208] text-[#fcd34d] border border-[#78350f] rounded uppercase">
                                ONLY RIGHT
                              </span>
                            )}
                            {item.status === 'ONLY_LEFT' && (
                              <span className="text-[9px] font-mono text-[#555555] italic">
                                [NOT IN F2]
                              </span>
                            )}
                            {item.status === 'MODIFIED' && (
                              <span className="px-1.5 py-0.5 text-[9px] font-mono bg-[#2d2208] text-[#fcd34d] border border-[#78350f] rounded uppercase">
                                DIFF
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {filteredItems.length === 0 && (
                    <div className="p-12 text-center text-xs font-mono text-[#666666] space-y-2">
                      <Filter className="w-8 h-8 mx-auto text-[#444444]" />
                      <p>No items match current filter criteria</p>
                      <button
                        onClick={() => {
                          setSearchFilter('');
                          setFilterTab('all');
                          setEnabledCategories(new Set(CHANGE_CATEGORIES.map(c => c.id)));
                        }}
                        className="btn-secondary text-[10px] py-1 px-3 mt-2"
                      >
                        Reset Filters
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* 3-Column Breakdown Mode */
            <div className={`p-4 grid grid-cols-1 md:grid-cols-3 gap-4 ${isFullView ? 'flex-1 min-h-0' : ''}`}>
              {/* Intersection */}
              <div className="border border-[#262626] bg-[#0d0d0d] flex flex-col">
                <div className="bg-[#141414] p-3 border-b border-[#262626] flex items-center justify-between shrink-0">
                  <span className="text-xs font-mono uppercase text-[#6ee7b7] font-bold">
                    INTERSECTION ({intersectionList.length})
                  </span>
                  <button
                    onClick={() => {
                      const csv = 'Intersection Values\n' + intersectionList.join('\n');
                      downloadCsv(csv, 'intersection.csv');
                    }}
                    className="text-[10px] font-mono text-[#999999] hover:text-white flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" /> CSV
                  </button>
                </div>
                <div className="p-2 font-mono text-xs space-y-1 overflow-y-auto flex-1 min-h-[300px]">
                  {intersectionList.slice(0, 500).map((val, idx) => (
                    <div key={idx} className="bg-[#062c19]/50 text-[#6ee7b7] p-2 border-l-2 border-[#047857] truncate">
                      {val}
                    </div>
                  ))}
                  {intersectionList.length === 0 && (
                    <div className="text-[#666666] p-6 text-center">No common items found</div>
                  )}
                </div>
              </div>

              {/* Only Left */}
              <div className="border border-[#262626] bg-[#0d0d0d] flex flex-col">
                <div className="bg-[#141414] p-3 border-b border-[#262626] flex items-center justify-between shrink-0">
                  <span className="text-xs font-mono uppercase text-[#fca5a5] font-bold">
                    ONLY LEFT ({onlyInAList.length})
                  </span>
                  <button
                    onClick={() => {
                      const csv = 'Only Left Values\n' + onlyInAList.join('\n');
                      downloadCsv(csv, 'only_left.csv');
                    }}
                    className="text-[10px] font-mono text-[#999999] hover:text-white flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" /> CSV
                  </button>
                </div>
                <div className="p-2 font-mono text-xs space-y-1 overflow-y-auto flex-1 min-h-[300px]">
                  {onlyInAList.slice(0, 500).map((val, idx) => (
                    <div key={idx} className="bg-[#3b1219]/50 text-[#fca5a5] p-2 border-l-2 border-[#b91c1c] truncate">
                      {val}
                    </div>
                  ))}
                  {onlyInAList.length === 0 && (
                    <div className="text-[#666666] p-6 text-center">No unique left items</div>
                  )}
                </div>
              </div>

              {/* Only Right */}
              <div className="border border-[#262626] bg-[#0d0d0d] flex flex-col">
                <div className="bg-[#141414] p-3 border-b border-[#262626] flex items-center justify-between shrink-0">
                  <span className="text-xs font-mono uppercase text-[#fcd34d] font-bold">
                    ONLY RIGHT ({onlyInBList.length})
                  </span>
                  <button
                    onClick={() => {
                      const csv = 'Only Right Values\n' + onlyInBList.join('\n');
                      downloadCsv(csv, 'only_right.csv');
                    }}
                    className="text-[10px] font-mono text-[#999999] hover:text-white flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" /> CSV
                  </button>
                </div>
                <div className="p-2 font-mono text-xs space-y-1 overflow-y-auto flex-1 min-h-[300px]">
                  {onlyInBList.slice(0, 500).map((val, idx) => (
                    <div key={idx} className="bg-[#2d2208]/50 text-[#fcd34d] p-2 border-l-2 border-[#78350f] truncate">
                      {val}
                    </div>
                  ))}
                  {onlyInBList.length === 0 && (
                    <div className="text-[#666666] p-6 text-center">No unique right items</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Status Bar Integration */}
          <StatusBar
            status={stats.onlyInACount > 0 || stats.onlyInBCount > 0 ? 'CHANGES DETECTED' : 'COLUMNS MATCH'}
            fileAName={fileNameA}
            sheetAName={activeSheetNameA}
            fileBName={fileNameB}
            sheetBName={activeSheetNameB}
            displayedCount={filteredItems.length}
            totalCount={alignedItems.length}
            isComparing={false}
          />
        </div>

        {/* Right Sidebar: Details Grid, Navigation, Histogram & Export Actions */}
        {showRightSidebar && (
          <div className={`lg:col-span-3 bg-[#141414] border border-[#262626] p-4 space-y-4 select-none transition-all ${
            isFullView ? 'h-full min-h-0 overflow-y-auto flex flex-col' : ''
          }`}>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#262626] pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-white font-bold uppercase tracking-wider">Comparison Audit</span>
              </div>
              <button onClick={() => setShowRightSidebar(false)} className="text-[#666666] hover:text-white transition-colors" title="Collapse Sidebar">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Summary Counters Bar */}
            <div className="flex items-center justify-between bg-[#000000] p-2 border border-[#262626] text-xs font-mono shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-[#6ee7b7] font-bold" title="Matches">= {stats.intersectionCount}</span>
                <span className="text-[#fca5a5] font-bold" title="Missing from Right">- {stats.onlyInACount}</span>
                <span className="text-[#fcd34d] font-bold" title="Missing from Left">+ {stats.onlyInBCount}</span>
              </div>
              <div className="text-[10px] text-[#999999] font-bold">TOTAL: {filteredItems.length}</div>
            </div>

            {/* Stepper Navigation */}
            <div className="flex items-center justify-between bg-[#1f1f1f] p-2 border border-[#3a3a3a] shrink-0">
              <span className="text-xs font-mono text-[#cccccc]">
                {filteredItems.length > 0 ? `${activeItemIndex + 1} of ${filteredItems.length}` : '0 of 0'}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => jumpToIndex(activeItemIndex - 1)}
                  disabled={filteredItems.length === 0}
                  className="p-1 text-[#cccccc] hover:text-white border border-[#3a3a3a] hover:border-white disabled:opacity-30 rounded transition-colors"
                  title="Previous Item (Up Arrow / k)"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  onClick={() => jumpToIndex(activeItemIndex + 1)}
                  disabled={filteredItems.length === 0}
                  className="p-1 text-[#cccccc] hover:text-white border border-[#3a3a3a] hover:border-white disabled:opacity-30 rounded transition-colors"
                  title="Next Item (Down Arrow / j)"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Details Grid Integration */}
            <div className="flex-1 min-h-[220px] max-h-[340px] shrink-0 overflow-hidden flex flex-col">
              <div className="text-[10px] font-mono text-[#999999] uppercase tracking-wider mb-1 shrink-0">
                DETAILS GRID
              </div>
              <div className="flex-1 min-h-0">
                <ResultsGrid
                  items={detailsGridItems}
                  onRowClick={(item) => {
                    setSelectedDetailItem(item);
                    if (item.rowIdx != null) {
                      jumpToRowIdx(item.rowIdx);
                    }
                  }}
                  activeRowId={selectedDetailItem?.id}
                  getCategoryColor={(cat, subtype) => cat === 'STRUCTURAL' ? getStructuralColor(subtype) : getCategoryColor(cat)}
                  getCategoryPattern={(cat, subtype) => cat === 'STRUCTURAL' ? getStructuralPattern(subtype) : getCategoryPattern(cat)}
                />
              </div>
            </div>

            {/* Change Histogram Integration */}
            <div className="shrink-0">
              <ChangeHistogram
                items={histogramItems}
                total={histogramItems.length}
                bins={30}
                onBinClick={(rowIdx) => jumpToRowIdx(rowIdx)}
                caption="DISTRIBUTION BY ROW"
                categoryColors={Object.fromEntries(CHANGE_CATEGORIES.map(c => [c.id, c.colorToken]))}
              />
            </div>

            {/* Quick Export Actions */}
            <div className="flex gap-2 p-2 border-t border-[#262626] bg-[#000000] shrink-0">
              <button
                onClick={handleExportXlsx}
                className="flex-1 btn-secondary text-xs py-2 flex items-center justify-center gap-1"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#5fa657]" />
                EXPORT XLSX
              </button>
              <button
                onClick={handleCopyCsv}
                className="flex-1 btn-secondary text-xs py-2 flex items-center justify-center gap-1"
              >
                <Copy className="w-3.5 h-3.5 text-[#c3d9f3]" />
                {copiedExport ? 'COPIED!' : 'COPY CSV'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
