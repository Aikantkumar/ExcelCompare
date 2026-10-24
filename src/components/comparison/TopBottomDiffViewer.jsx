import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { 
  Eye, 
  Layers, 
  Search, 
  Download, 
  Share2, 
  MessageSquare, 
  Check, 
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Sliders,
  Settings,
  Maximize2,
  Minimize2,
  Maximize,
  Minimize,
  Layers as LayersIcon
} from 'lucide-react';
import { getColumnLetter } from './diffEngine';
import { SpreadsheetVirtualizedTable } from './VirtualizedTable';
import { useFullView } from './useFullView';
import { t } from '../../utils/translations';

export default function TopBottomDiffViewer({ 
  diffData, 
  sheetName, 
  onExport, 
  onShare,
  options = {},
  onOptionsChange = () => {},
  headersA = [],
  headersB = [],
  colWidthsA = [],
  colWidthsB = [],
  locale = 'en'
}) {
  const [viewMode, setViewMode] = useState('stacked'); // 'stacked' | 'overlapped'
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1024);
  const [showLeftSidebar, setShowLeftSidebar] = useState(isDesktop);
  const [showRightSidebar, setShowRightSidebar] = useState(isDesktop);
  const [mobileDrawer, setMobileDrawer] = useState(null); // 'tools' | 'audit' | null
  const [viewTab, setViewTab] = useState('both'); // 'both' | 'original' | 'changed'
  const [activeChangeIndex, setActiveChangeIndex] = useState(0);
  const [selectedCell, setSelectedCell] = useState(null);
  const [annotationText, setAnnotationText] = useState('');
  const [showAnnotationModal, setShowAnnotationModal] = useState(false);
  const [showAppearanceModal, setShowAppearanceModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [annotations, setAnnotations] = useState({});
  const [appearanceTheme, setAppearanceTheme] = useState('dark');
  const [syncScroll, setSyncScroll] = useState(true);
  const [tableHeight, setTableHeight] = useState(() => {
    if (typeof window === 'undefined') return 400;
    return Math.min(Math.max(Math.floor(window.innerHeight / 2 - 140), 220), Math.floor(window.innerHeight * 0.6));
  });
  const [tableDims, setTableDims] = useState(() => ({
    rowHeight: typeof window !== 'undefined' && window.innerWidth < 640 ? 36 : 32,
    firstColWidth: typeof window !== 'undefined' && window.innerWidth < 640 ? 36 : 48,
  }));
  const [registerBodyHeight, setRegisterBodyHeight] = useState(0);

  const { isFullView, toggleFullView, exitFullView } = useFullView({ isDesktop });

  useEffect(() => {
    const handleResize = () => {
      setTableHeight(Math.min(Math.max(Math.floor(window.innerHeight / 2 - 140), 220), Math.floor(window.innerHeight * 0.6)));
      setIsDesktop(window.innerWidth >= 1024);
      setTableDims({
        rowHeight: window.innerWidth < 640 ? 36 : 32,
        firstColWidth: window.innerWidth < 640 ? 36 : 48,
      });
      if (window.innerWidth < 1024) {
        setShowLeftSidebar(false);
        setShowRightSidebar(false);
      }
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  const virtualTopTableRef = useRef(null);
  const virtualBottomTableRef = useRef(null);
  const virtualOverlappedTableRef = useRef(null);
  const activePaneRef = useRef(null);
  const registerBodyRef = useRef(null);

  const { rows = [], changesList = [], activeColIndices = [], stats = {} } = diffData || {};

  const {
    compareFormulas = true,
    smartRowMatch = true,
    diffGranularity = 'smart',
    matchColumnsByHeaders = false,
    ignoreWhitespace = false,
    ignoreCase = false,
    collapseUnchangedBlocks = false,
    hideUnchangedRows = false,
    hideUnchangedColumns = false,
    normalizeDatesUS = false,
    normalizeDatesEU = false,
    preserveFormatting = true,
    sortRows = 'none',
  } = options;

  const updateOption = (key, value) => {
    onOptionsChange({ ...options, [key]: value });
  };

  const jumpToChange = (index) => {
    if (!changesList || changesList.length === 0) return;
    const targetIdx = (index + changesList.length) % changesList.length;
    setActiveChangeIndex(targetIdx);

    const change = changesList[targetIdx];
    if (change) {
      // Scroll virtualized table to row
      if (viewMode === 'stacked') {
        activePaneRef.current = 'top';
        if (virtualTopTableRef.current) {
          virtualTopTableRef.current.scrollToIndex(change.rowIdx, 'center');
        }
        if (virtualBottomTableRef.current) {
          virtualBottomTableRef.current.scrollToIndex(change.rowIdx, 'center');
        }
      } else {
        if (virtualOverlappedTableRef.current) {
          virtualOverlappedTableRef.current.scrollToIndex(change.rowIdx, 'center');
        }
      }
      // Then scroll the cell into view horizontally (container only, no page scroll)
      const cellId = `cell-${change.rowIdx}-${change.colIdx}`;
      const elem = document.getElementById(cellId);
      if (elem && viewMode === 'stacked') {
        const topVirtualizer = virtualTopTableRef.current?.getVirtualizer?.();
        const bottomVirtualizer = virtualBottomTableRef.current?.getVirtualizer?.();
        const topScrollEl = topVirtualizer?.scrollElement;
        const bottomScrollEl = bottomVirtualizer?.scrollElement;
        const container = topScrollEl || bottomScrollEl;
        if (container) {
          const cellRect = elem.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          const left = container.scrollLeft + (cellRect.left - containerRect.left) - (containerRect.width / 2) + (cellRect.width / 2);
          container.scrollTo({ left: Math.max(0, left), behavior: 'auto' });
        }
      } else if (elem && viewMode === 'overlapped') {
        const overlappedVirtualizer = virtualOverlappedTableRef.current?.getVirtualizer?.();
        const scrollEl = overlappedVirtualizer?.scrollElement;
        if (scrollEl) {
          const cellRect = elem.getBoundingClientRect();
          const containerRect = scrollEl.getBoundingClientRect();
          const left = scrollEl.scrollLeft + (cellRect.left - containerRect.left) - (containerRect.width / 2) + (cellRect.width / 2);
          scrollEl.scrollTo({ left: Math.max(0, left), behavior: 'auto' });
        }
      }
    }
  };

  // Synchronized scrolling for stacked viewport
  const handleScrollSync = useCallback((source) => {
    if (!syncScroll) return;
    if (activePaneRef.current !== null && activePaneRef.current !== source) return;
    
    let sourceVirtualizer, targetVirtualizer;
    if (source === 'top') {
      sourceVirtualizer = virtualTopTableRef.current?.getVirtualizer?.();
      targetVirtualizer = virtualBottomTableRef.current?.getVirtualizer?.();
    } else if (source === 'bottom') {
      sourceVirtualizer = virtualBottomTableRef.current?.getVirtualizer?.();
      targetVirtualizer = virtualTopTableRef.current?.getVirtualizer?.();
    }

    if (sourceVirtualizer && targetVirtualizer) {
      const sourceScrollEl = sourceVirtualizer.scrollElement;
      const targetScrollEl = targetVirtualizer.scrollElement;
      if (sourceScrollEl && targetScrollEl) {
        const topDiff = Math.abs(targetScrollEl.scrollTop - sourceScrollEl.scrollTop);
        const leftDiff = Math.abs(targetScrollEl.scrollLeft - sourceScrollEl.scrollLeft);
        if (topDiff >= 1) {
          targetScrollEl.scrollTop = sourceScrollEl.scrollTop;
        }
        if (leftDiff >= 1) {
          targetScrollEl.scrollLeft = sourceScrollEl.scrollLeft;
        }
      }
    }
  }, [syncScroll]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        jumpToChange(activeChangeIndex + 1);
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        jumpToChange(activeChangeIndex - 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeChangeIndex, changesList]);

  // ResizeObserver for register body height in full view
  useEffect(() => {
    if (!isFullView || !isDesktop || !registerBodyRef.current) {
      setRegisterBodyHeight(0);
      return;
    }
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setRegisterBodyHeight(entry.contentRect.height);
      }
    });
    ro.observe(registerBodyRef.current);
    return () => ro.disconnect();
  }, [isFullView, isDesktop]);

  // Full view: Esc to exit (modal-aware, handled by hook for base behavior)
  useEffect(() => {
    if (!isFullView) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (showAnnotationModal || showAppearanceModal) return;
        const exportModal = document.querySelector('[data-export-modal]');
        if (exportModal) return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        exitFullView();
      } else if (e.key === 'ArrowDown' || e.key === 'j' || e.key === 'ArrowUp' || e.key === 'k') {
        // Allow j/k/ArrowUp/ArrowDown navigation in full view
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullView, showAnnotationModal, showAppearanceModal, exitFullView]);

  // Mobile drawer: Esc to close
  useEffect(() => {
    if (!mobileDrawer) return;
    const handleKeyDown = (e) => { if (e.key === 'Escape') setMobileDrawer(null); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileDrawer]);

  // Calculate table heights for full view
  const stackedTableHeight = React.useMemo(() => {
    if (!isFullView || !isDesktop || registerBodyHeight === 0) return tableHeight;
    // Vertical chrome: header strip (48px) + padding (16px*2) + gap (16px) + label rows (2*24px) + container padding (2*16px)
    // header strip = ~48px, p-4 = 16px top/bottom, gap-4 = 16px, label rows = 24px each, table container p-2 = 8px each
    const verticalChrome = 48 + 32 + 16 + 48 + 32; // ~176px
    const availableHeight = registerBodyHeight - verticalChrome;
    const height = Math.floor(availableHeight / 2);
    return Math.max(160, height);
  }, [isFullView, isDesktop, registerBodyHeight, tableHeight]);

  const overlappedTableHeight = React.useMemo(() => {
    if (!isFullView || !isDesktop || registerBodyHeight === 0) return 500;
    // Vertical chrome: header strip + padding + label row + container padding
    const verticalChrome = 48 + 32 + 24 + 16; // ~120px
    const availableHeight = registerBodyHeight - verticalChrome;
    return Math.max(200, availableHeight);
  }, [isFullView, isDesktop, registerBodyHeight]);

  const activeChange = changesList[activeChangeIndex];

  // Scroll to active change when table heights change in full view
  useEffect(() => {
    if (!isFullView) return;
    if (activeChange == null) return;
    const targetIdx = activeChange.rowIdx;
    if (viewMode === 'stacked') {
      activePaneRef.current = 'top';
      virtualTopTableRef.current?.scrollToIndex(targetIdx, 'center');
      virtualBottomTableRef.current?.scrollToIndex(targetIdx, 'center');
    } else {
      virtualOverlappedTableRef.current?.scrollToIndex(targetIdx, 'center');
    }
  }, [isFullView, stackedTableHeight, overlappedTableHeight, viewMode, activeChange]);

  const handleCellClick = (rIdx, cIdx, cell, side = 'both') => {
    const key = `${rIdx}_${cIdx}_${side}`;
    setSelectedCell({ rIdx, cIdx, cell, side, key });
    setAnnotationText(annotations[key] || '');
    setShowAnnotationModal(true);
  };

  const saveAnnotation = () => {
    if (!selectedCell) return;
    setAnnotations((prev) => ({ ...prev, [selectedCell.key]: annotationText }));
    setShowAnnotationModal(false);
  };

  const [expandedBlockIds, setExpandedBlockIds] = useState(new Set());

  const handleToggleCollapse = (row) => {
    if (row.blockId !== undefined) {
      setExpandedBlockIds((prev) => {
        const next = new Set(prev);
        if (next.has(row.blockId)) {
          next.delete(row.blockId);
        } else {
          next.add(row.blockId);
        }
        return next;
      });
    }
  };

  const displayRows = React.useMemo(() => {
    let list = [];
    rows.forEach((row, idx) => {
      if (row.type === 'COLLAPSED') {
        if (expandedBlockIds.has(idx)) {
          list.push(...(Array.isArray(row.hiddenRows) ? row.hiddenRows : []));
        } else {
          list.push({ ...row, blockId: idx });
        }
      } else {
        list.push(row);
      }
    });

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((row) => {
        if (row.type === 'COLLAPSED') return true;
        const matchA = row.cellsA?.some((c) => String(c?.val || '').toLowerCase().includes(q));
        const matchB = row.cellsB?.some((c) => String(c?.val || '').toLowerCase().includes(q));
        return matchA || matchB;
      });
    }

    return list;
  }, [rows, expandedBlockIds, searchQuery]);

  const colsToRender = activeColIndices.length > 0
    ? activeColIndices
    : Array.from({ length: stats.maxCols || 1 }, (_, i) => i);

  // Build column definitions with actual widths from Excel
  const buildColumns = (colWidths) => colsToRender.map(cIdx => ({
    key: cIdx,
    minWidth: colWidths[cIdx] ? `${colWidths[cIdx]}px` : '120px',
    width: colWidths[cIdx] ? `${colWidths[cIdx]}px` : '120px'
  }));

  const getCellContent = (row, cIdx, rIdx, isTop) => {
    const cellA = row.cellsA?.[cIdx] || { val: '' };
    const cellB = row.cellsB?.[cIdx] || { val: '' };
    const status = row.cellStatuses?.[cIdx] || 'SAME';

    let cellToShow;
    let cellStatus;
    if (viewMode === 'overlapped') {
      if (status === 'ADDED') {
        cellToShow = cellB;
        cellStatus = 'ADDED';
      } else if (status === 'DELETED') {
        cellToShow = cellA;
        cellStatus = 'DELETED';
      } else if (status === 'MODIFIED' || status === 'FORMULA_CHANGED') {
        cellToShow = cellB;
        cellStatus = status;
      } else {
        cellToShow = cellA;
        cellStatus = 'SAME';
      }
    } else {
      cellToShow = isTop ? cellA : cellB;
      cellStatus = status;
    }

    return (
      <div className="cell-content">
        {viewMode === 'overlapped' ? (
          <OverlappedCellContent
            cellA={cellA}
            cellB={cellB}
            status={status}
            granularity={diffGranularity}
            compareFormulas={compareFormulas}
          />
        ) : (
          <span className="cell-text">{cellToShow.val || '-'}</span>
        )}
      </div>
    );
  };

  const getCellProps = (row, cIdx, rIdx, isTop) => {
    const cellA = row.cellsA?.[cIdx] || { val: '' };
    const cellB = row.cellsB?.[cIdx] || { val: '' };
    const status = row.cellStatuses?.[cIdx] || 'SAME';
    const cellId = `cell-${rIdx}-${cIdx}`;
    const isCellFocused = activeChange && activeChange.rowIdx === rIdx && activeChange.colIdx === cIdx;

    let cellToShow;
    let cellStatus;
    if (viewMode === 'overlapped') {
      if (status === 'ADDED') {
        cellToShow = cellB;
        cellStatus = 'ADDED';
      } else if (status === 'DELETED') {
        cellToShow = cellA;
        cellStatus = 'DELETED';
      } else if (status === 'MODIFIED' || status === 'FORMULA_CHANGED') {
        cellToShow = cellB;
        cellStatus = status;
      } else {
        cellToShow = cellA;
        cellStatus = 'SAME';
      }
    } else {
      cellToShow = isTop ? cellA : cellB;
      cellStatus = status;
    }

    return {
      id: cellId,
      onClick: () => handleCellClick(rIdx, cIdx, cellToShow, isTop ? 'A' : 'B'),
      className: `py-2 px-3 border-r border-hairline relative cursor-pointer font-mono transition-all ${
        isCellFocused ? 'ring-2 ring-diff-modified-text z-10 shadow-lg' : ''
      } ${getCellStyle(cellStatus, viewTab, preserveFormatting, viewMode)}`,
    };
  };

  const renderFirstColCell = (row, rIdx, isTop) => (
    <span>
      {isTop 
        ? (row.indexA !== null ? row.indexA + 1 : '-')
        : (row.indexB !== null ? row.indexB + 1 : '-')
      }
    </span>
  );

  const getRowClassName = (row, rIdx) => {
    const isRowFocused = activeChange && activeChange.rowIdx === rIdx;
    return isRowFocused ? 'bg-surface-elevated/80' : '';
  };

  return (
    <div className={isFullView ? 'fixed left-0 top-0 right-0 bottom-0 z-[60] bg-canvas h-[100dvh] flex flex-col gap-4 p-4 overflow-y-auto lg:overflow-hidden [padding-bottom:env(safe-area-inset-bottom)] [padding-top:env(safe-area-inset-top)]' : 'space-y-4'}>
      {/* Top Main Toolbar */}
      <div className="shrink-0 bg-surface-card border border-hairline p-3 flex flex-wrap sm:flex-nowrap items-center justify-between gap-4">
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
          <button
            onClick={() => { if (isDesktop) setShowLeftSidebar(!showLeftSidebar); else setMobileDrawer(mobileDrawer === 'tools' ? null : 'tools'); }}
            className={`p-1.5 text-xs font-mono border rounded transition-all ${
              showLeftSidebar
                ? 'border-success text-success bg-diff-added-bg'
                : 'border-hairline-strong text-muted hover:border-white hover:text-ink'
            }`}
            title={mobileDrawer === 'tools' && !isDesktop ? 'Close Tools Drawer' : 'Toggle Left Tools Sidebar'}
            aria-label={mobileDrawer === 'tools' && !isDesktop ? 'Close Tools & Options drawer' : (showLeftSidebar ? 'Hide Tools Sidebar' : 'Show Tools Sidebar')}
          >
            <span className="mr-1 text-[11px] font-bold hidden sm:inline">
              {showLeftSidebar ? t(locale, 'comparison.hideTools', 'HIDE TOOLS') : t(locale, 'comparison.showTools', 'SHOW TOOLS')}
            </span>
            <Sliders className="w-4 h-4 inline" />
          </button>

          <div className="h-4 w-px bg-hairline mx-1" />

          <span className="text-[10px] font-mono text-muted uppercase tracking-wider hidden md:inline">LAYOUT:</span>
          <button
            onClick={() => setViewMode('stacked')}
            className={`px-3 py-1.5 text-xs font-mono tracking-wider uppercase border rounded-full transition-all ${
              viewMode === 'stacked'
                ? 'border-white text-ink bg-surface-elevated font-bold'
                : 'border-hairline-strong text-muted hover:border-white hover:text-ink'
            }`}
            aria-label={viewMode === 'stacked' ? 'Stacked layout, active' : 'Stacked layout'}
          >
            <LayersIcon className="w-3.5 h-3.5 inline mr-1" />
            <span className="hidden sm:inline">Stacked</span>
          </button>
          <button
            onClick={() => setViewMode('overlapped')}
            className={`px-3 py-1.5 text-xs font-mono tracking-wider uppercase border rounded-full transition-all ${
              viewMode === 'overlapped'
                ? 'border-white text-ink bg-surface-elevated font-bold'
                : 'border-hairline-strong text-muted hover:border-white hover:text-ink'
            }`}
            aria-label={viewMode === 'overlapped' ? 'Overlapped layout, active' : 'Overlapped layout'}
          >
            <Maximize2 className="w-3.5 h-3.5 inline mr-1" />
            <span className="hidden sm:inline">Overlapped</span>
          </button>

          <div className="h-4 w-px bg-hairline mx-1" />

          <label className="flex items-center gap-2 cursor-pointer text-xs font-mono text-muted hover:text-ink">
            <input
              type="checkbox"
              checked={syncScroll}
              onChange={(e) => setSyncScroll(e.target.checked)}
              className="w-4 h-4 accent-success"
            />
            Sync Scroll
          </label>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="relative shrink-0">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted-soft" />
            <input
              type="text"
              placeholder="Filter cells..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-canvas border border-hairline-strong pl-8 pr-3 py-1 text-xs font-mono text-ink placeholder-muted-soft focus:outline-none focus:border-ink w-full sm:w-56 max-w-xs sm:max-w-none shrink-0"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAppearanceModal(true)}
            className="p-1.5 text-xs font-mono border border-hairline-strong text-muted hover:border-white hover:text-ink rounded"
            title="Appearance Settings"
            aria-label="Appearance Settings"
          >
            <Settings className="w-4 h-4" />
          </button>

          <button
            onClick={toggleFullView}
            className={`p-1.5 text-xs font-mono border rounded transition-all shadow-[0_0_14px_rgba(34,197,94,0.55)] ${
              isFullView
                ? 'border-success text-success bg-diff-added-bg'
                : 'border-hairline-strong text-muted hover:border-white hover:text-ink'
            }`}
            title={isFullView ? 'Exit Full View' : 'Enter Full View'}
            aria-pressed={isFullView}
            aria-label={isFullView ? 'Exit Full View' : 'Enter Full View'}
          >
            {isFullView ? <Minimize className="w-4 h-4 inline" /> : <Maximize className="w-4 h-4 inline" />}
            <span className="ml-1 text-[11px] font-bold hidden sm:inline">
              {isFullView ? t(locale, 'comparison.exitFullView', 'EXIT FULL VIEW') : t(locale, 'comparison.fullView', 'FULL VIEW')}
            </span>
          </button>

          <button onClick={onExport} className="btn-primary px-2 py-1.5 text-[10px] h-9 tracking-[1px]">
            <Download className="w-3 h-3 inline mr-1" />
            Export
          </button>
          <button
            onClick={() => { if (onShare) onShare(); setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2000); }}
            className="btn-secondary px-2 py-1.5 text-[10px] h-9 tracking-[1px]"
          >
            {copiedLink ? <Check className="w-3 h-3 inline mr-1 text-success" /> : <Share2 className="w-3 h-3 inline mr-1" />}
            {copiedLink ? 'Copied' : 'Share'}
          </button>

          <div className="h-4 w-px bg-hairline mx-1" />

          <button
            onClick={() => { if (isDesktop) setShowRightSidebar(!showRightSidebar); else setMobileDrawer(mobileDrawer === 'audit' ? null : 'audit'); }}
            className={`p-1.5 text-xs font-mono border rounded transition-all ${
              showRightSidebar
                ? 'border-link text-link bg-diff-formula-bg'
                : 'border-hairline-strong text-muted hover:border-white hover:text-ink'
            }`}
            title={mobileDrawer === 'audit' && !isDesktop ? 'Close Audit Drawer' : 'Toggle Right Changes Sidebar'}
            aria-label={mobileDrawer === 'audit' && !isDesktop ? 'Close Changes Audit drawer' : (showRightSidebar ? 'Hide Changes Sidebar' : 'Show Changes Sidebar')}
          >
            <span className="mr-1 text-[11px] font-bold hidden sm:inline">
              {showRightSidebar ? t(locale, 'comparison.hideAudit', 'HIDE AUDIT') : t(locale, 'comparison.showAudit', 'SHOW AUDIT')}
            </span>
            <Layers className="w-4 h-4 inline" />
          </button>
        </div>
      </div>

      <div className={`grid grid-cols-1 lg:grid-cols-12 gap-4 ${isFullView ? 'flex-1 min-h-0 items-stretch h-full' : 'items-start'}`}>
        {!isDesktop && mobileDrawer === 'tools' ? null : showLeftSidebar && (
          <div className={`lg:col-span-3 bg-surface-card border border-hairline p-4 space-y-6 select-none transition-all ${isFullView ? 'h-full min-h-0 overflow-y-auto' : ''}`}>
            <ToolsSidebar
              compareFormulas={compareFormulas}
              diffGranularity={diffGranularity}
              matchColumnsByHeaders={matchColumnsByHeaders}
              ignoreWhitespace={ignoreWhitespace}
              ignoreCase={ignoreCase}
              collapseUnchangedBlocks={collapseUnchangedBlocks}
              hideUnchangedRows={hideUnchangedRows}
              hideUnchangedColumns={hideUnchangedColumns}
              preserveFormatting={preserveFormatting}
              sortRows={sortRows}
              normalizeDatesUS={normalizeDatesUS}
              normalizeDatesEU={normalizeDatesEU}
              updateOption={updateOption}
              headersA={headersA}
              onOpenAppearance={() => setShowAppearanceModal(true)}
              onClose={() => { setShowLeftSidebar(false); setMobileDrawer(null); }}
              isDrawer={!isDesktop && mobileDrawer === 'tools'}
            />
          </div>
        )}

        <div className={`${
          showLeftSidebar && showRightSidebar ? 'lg:col-span-6' :
          showLeftSidebar || showRightSidebar ? 'lg:col-span-9' : 'lg:col-span-12'
        } bg-surface-soft border border-hairline space-y-0 transition-all min-w-0 ${isFullView ? 'min-h-0 flex flex-col' : ''}`}>
          
          <div className="shrink-0 bg-surface-card px-4 py-2 border-b border-hairline flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs font-mono uppercase text-ink select-none">
            <div className="flex items-center gap-4">
              <span className="font-bold text-link">{sheetName}</span>
              <span className="text-[10px] text-muted-soft">{displayRows.length} ROW(S) DISPLAYED</span>
              {viewMode === 'overlapped' && (
                <span className="px-2 py-0.5 text-[10px] font-mono bg-diff-formula-bg text-diff-formula-text border border-diff-formula-border rounded">{t(locale, 'comparison.overlappedView', 'OVERLAPPED VIEW')}</span>
              )}
            </div>
            {activeChange && (
              <div className="text-[11px] text-diff-modified-text font-mono animate-pulse hidden sm:block">
                FOCUSED: CELL {activeChange.cellRef} (#{activeChange.id})
              </div>
            )}
          </div>

          <div ref={registerBodyRef} className={isFullView ? 'flex-1 min-h-0 overflow-hidden' : ''}>
            {viewMode === 'stacked' ? (
              <div className="space-y-2 p-2 sm:p-4">
              <div className="bg-surface-card border border-hairline p-1 sm:p-2"
                onPointerDown={() => { activePaneRef.current = 'top'; }}
                onWheel={() => { activePaneRef.current = 'top'; }}
                onTouchStart={() => { activePaneRef.current = 'top'; }}
                onFocus={() => { activePaneRef.current = 'top'; }}
                onPointerLeave={() => { if (activePaneRef.current === 'top') activePaneRef.current = null; }}
              >
                <div className="text-xs font-mono text-link mb-2">{t(locale, 'comparison.file1', 'FILE 1 (ORIGINAL / BEFORE)')}</div>
                <SpreadsheetVirtualizedTable
                  ref={virtualTopTableRef}
                  rows={displayRows}
                  columns={buildColumns(colWidthsA)}
                  rowHeight={tableDims.rowHeight}
                  headerHeight={36}
                  firstColWidth={tableDims.firstColWidth}
                  containerHeight={stackedTableHeight}
                  overscan={12}
                  estimatedRowSize={() => 32}
                  fixedRowHeight={true}
                  onToggleCollapse={handleToggleCollapse}
                  renderCollapsedRow={(row) => (
                    <div className="flex items-center justify-center gap-2 py-1 text-link font-bold">
                      <span>↕</span>
                      <span>{t(locale, 'comparison.unchangedRowsCollapsed', '{count} UNCHANGED ROWS COLLAPSED').replace('{count}', row.count)}</span>
                      <span className="text-[10px] text-muted font-normal">(Click row to expand)</span>
                    </div>
                  )}
                  renderFirstColHeader={() => 'FILE 1'}
                  renderFirstColCell={(row, rIdx) => renderFirstColCell(row, rIdx, true)}
                  renderHeader={(col, cIdx) => getColumnLetter(colsToRender[cIdx])}
                  renderCell={(row, cIdx, rIdx) => getCellContent(row, colsToRender[cIdx], rIdx, true)}
                  getCellProps={(row, cIdx, rIdx) => getCellProps(row, colsToRender[cIdx], rIdx, true)}
                  getRowClassName={getRowClassName}
                  onScroll={syncScroll ? (e) => handleScrollSync('top') : undefined}
                />
              </div>
              <div className="bg-surface-card border border-hairline p-1 sm:p-2"
                onPointerDown={() => { activePaneRef.current = 'bottom'; }}
                onWheel={() => { activePaneRef.current = 'bottom'; }}
                onTouchStart={() => { activePaneRef.current = 'bottom'; }}
                onFocus={() => { activePaneRef.current = 'bottom'; }}
                onPointerLeave={() => { if (activePaneRef.current === 'bottom') activePaneRef.current = null; }}
              >
                <div className="text-xs font-mono text-diff-deleted-text mb-2">{t(locale, 'comparison.file2', 'FILE 2 (MODIFIED / AFTER)')}</div>
                <SpreadsheetVirtualizedTable
                  ref={virtualBottomTableRef}
                  rows={displayRows}
                  columns={buildColumns(colWidthsB)}
                  rowHeight={tableDims.rowHeight}
                  headerHeight={36}
                  firstColWidth={tableDims.firstColWidth}
                  containerHeight={stackedTableHeight}
                  overscan={12}
                  estimatedRowSize={() => 32}
                  fixedRowHeight={true}
                  onToggleCollapse={handleToggleCollapse}
                  renderCollapsedRow={(row) => (
                    <div className="flex items-center justify-center gap-2 py-1 text-link font-bold">
                      <span>↕</span>
                      <span>{t(locale, 'comparison.unchangedRowsCollapsed', '{count} UNCHANGED ROWS COLLAPSED').replace('{count}', row.count)}</span>
                      <span className="text-[10px] text-muted font-normal">(Click row to expand)</span>
                    </div>
                  )}
                  renderFirstColHeader={() => 'FILE 2'}
                  renderFirstColCell={(row, rIdx) => renderFirstColCell(row, rIdx, false)}
                  renderHeader={(col, cIdx) => getColumnLetter(colsToRender[cIdx])}
                  renderCell={(row, cIdx, rIdx) => getCellContent(row, colsToRender[cIdx], rIdx, false)}
                  getCellProps={(row, cIdx, rIdx) => getCellProps(row, colsToRender[cIdx], rIdx, false)}
                  getRowClassName={getRowClassName}
                  onScroll={syncScroll ? (e) => handleScrollSync('bottom') : undefined}
                />
              </div>
            </div>
            ) : (
              <div className="p-2 sm:p-4">
                <div className="bg-surface-card border border-hairline p-1 sm:p-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono text-diff-formula-text">{t(locale, 'comparison.overlappedMergedView', 'OVERLAPPED / MERGED VIEW')}</span>
                  <span className="text-[10px] text-muted-soft">Green = Added, Red = Deleted, Yellow = Modified, Blue = Formula Changed</span>
                </div>
                <SpreadsheetVirtualizedTable
                  ref={virtualOverlappedTableRef}
                  rows={displayRows}
                  columns={buildColumns(colWidthsA.length > 0 ? colWidthsA : colWidthsB)}
                  rowHeight={tableDims.rowHeight}
                  headerHeight={36}
                  firstColWidth={tableDims.firstColWidth}
                  containerHeight={overlappedTableHeight}
                  overscan={5}
                  estimatedRowSize={() => 32}
                  onToggleCollapse={handleToggleCollapse}
                  renderCollapsedRow={(row) => (
                    <div className="flex items-center justify-center gap-2 py-1 text-link font-bold">
                      <span>↕</span>
                      <span>{t(locale, 'comparison.unchangedRowsCollapsed', '{count} UNCHANGED ROWS COLLAPSED').replace('{count}', row.count)}</span>
                      <span className="text-[10px] text-muted font-normal">(Click row to expand)</span>
                    </div>
                  )}
                  renderFirstColHeader={() => 'FILE 1'}
                  renderFirstColCell={(row, rIdx) => renderFirstColCell(row, rIdx, true)}
                  renderHeader={(col, cIdx) => getColumnLetter(colsToRender[cIdx])}
                  renderCell={(row, cIdx, rIdx) => getCellContent(row, colsToRender[cIdx], rIdx, true)}
                  getCellProps={(row, cIdx, rIdx) => getCellProps(row, colsToRender[cIdx], rIdx, true)}
                  getRowClassName={getRowClassName}
                />
              </div>
            </div>
          )}
          </div>
        </div>

        {!isDesktop && mobileDrawer === 'audit' ? null : showRightSidebar && (
          <div className={`lg:col-span-3 bg-surface-card border border-hairline p-4 space-y-4 select-none transition-all ${isFullView ? 'h-full min-h-0 overflow-y-auto' : ''}`}>
            <ChangesSidebar
              stats={stats}
              changesList={changesList}
              activeChangeIndex={activeChangeIndex}
              jumpToChange={jumpToChange}
              onClose={() => { setShowRightSidebar(false); setMobileDrawer(null); }}
              isDrawer={!isDesktop && mobileDrawer === 'audit'}
            />
          </div>
        )}

      </div>

      {/* Mobile bottom-sheet drawers for Tools & Options and Audit panels */}
      {!isDesktop && mobileDrawer === 'tools' && (
        <div className="fixed left-0 top-0 right-0 bottom-0 z-[80] bg-canvas/60 backdrop-blur-sm pointer-events-auto" role="dialog" aria-modal="true" aria-label="Tools & Options">
          <div className="absolute left-0 bottom-0 right-0 z-[85] bg-canvas border border-hairline border-t-0 flex flex-col max-h-[85vh] h-[85vh] shadow-2xl [padding-bottom:env(safe-area-inset-bottom)] [padding-top:env(safe-area-inset-top)]">
            <div className="shrink-0 bg-surface-card border-b border-hairline px-4 py-3 flex items-center justify-between">
              <h3 className="text-xs font-mono text-ink font-bold uppercase tracking-wider">Tools & Options</h3>
              <button onClick={() => setMobileDrawer(null)} className="text-muted-soft hover:text-ink" title="Close drawer" aria-label="Close Tools & Options drawer">
                <span className="text-[14px]">✕</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <ToolsSidebar
                compareFormulas={compareFormulas}
                diffGranularity={diffGranularity}
                matchColumnsByHeaders={matchColumnsByHeaders}
                ignoreWhitespace={ignoreWhitespace}
                ignoreCase={ignoreCase}
                collapseUnchangedBlocks={collapseUnchangedBlocks}
                hideUnchangedRows={hideUnchangedRows}
                hideUnchangedColumns={hideUnchangedColumns}
                preserveFormatting={preserveFormatting}
                sortRows={sortRows}
                normalizeDatesUS={normalizeDatesUS}
                normalizeDatesEU={normalizeDatesEU}
                updateOption={updateOption}
                headersA={headersA}
                onOpenAppearance={() => { setShowAppearanceModal(true); setMobileDrawer(null); }}
                onClose={() => setMobileDrawer(null)}
                isDrawer={true}
              />
            </div>
          </div>
        </div>
      )}

      {!isDesktop && mobileDrawer === 'audit' && (
        <div className="fixed left-0 top-0 right-0 bottom-0 z-[80] bg-canvas/60 backdrop-blur-sm pointer-events-auto" role="dialog" aria-modal="true" aria-label="Changes Audit">
          <div className="absolute left-0 bottom-0 right-0 z-[85] bg-canvas border border-hairline border-t-0 flex flex-col max-h-[85vh] h-[85vh] shadow-2xl [padding-bottom:env(safe-area-inset-bottom)] [padding-top:env(safe-area-inset-top)]">
            <div className="shrink-0 bg-surface-card border-b border-hairline px-4 py-3 flex items-center justify-between">
              <h3 className="text-xs font-mono text-ink font-bold uppercase tracking-wider">Changes Audit</h3>
              <button onClick={() => setMobileDrawer(null)} className="text-muted-soft hover:text-ink" title="Close drawer" aria-label="Close Changes Audit drawer">
                <span className="text-[14px]">✕</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <ChangesSidebar
                stats={stats}
                changesList={changesList}
                activeChangeIndex={activeChangeIndex}
                jumpToChange={jumpToChange}
                onClose={() => setMobileDrawer(null)}
                isDrawer={true}
              />
            </div>
          </div>
        </div>
      )}

      {showAppearanceModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 [padding-bottom:env(safe-area-inset-bottom)] [padding-top:env(safe-area-inset-top)]">
          <div className="bg-surface-card border border-hairline p-4 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto space-y-4 select-none">
            <div className="flex justify-between items-center border-b border-hairline pb-3">
              <h3 className="text-title-sm text-ink flex items-center gap-2"><Settings className="w-4 h-4 text-link" />{t(locale, 'comparison.appearanceThemeSettings', 'APPEARANCE & THEME SETTINGS')}</h3>
              <button onClick={() => setShowAppearanceModal(false)} className="p-2 text-muted hover:text-ink" aria-label="Close appearance settings">✕</button>
            </div>
            <div className="space-y-3">
              <div className="text-xs font-mono text-muted uppercase">Grid Theme Preset</div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setAppearanceTheme('dark')} className={`p-3 border text-xs font-mono text-left ${appearanceTheme === 'dark' ? 'border-white bg-surface-elevated text-ink' : 'border-hairline text-muted'}`}>Sleek Dark Mode</button>
                <button onClick={() => setAppearanceTheme('highContrast')} className={`p-3 border text-xs font-mono text-left ${appearanceTheme === 'highContrast' ? 'border-white bg-surface-elevated text-ink' : 'border-hairline text-muted'}`}>High Contrast</button>
              </div>
            </div>
            <div className="flex justify-end pt-2"><button onClick={() => setShowAppearanceModal(false)} className="btn-primary text-xs h-8 py-1 px-4">APPLY & CLOSE</button></div>
          </div>
        </div>
      )}

      {showAnnotationModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 [padding-bottom:env(safe-area-inset-bottom)] [padding-top:env(safe-area-inset-top)]">
          <div className="bg-surface-card border border-hairline p-4 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex justify-between items-center border-b border-hairline pb-3">
              <h3 className="text-title-sm text-ink flex items-center gap-2"><MessageSquare className="w-4 h-4 text-link" />{t(locale, 'comparison.cellAnnotationAuditNote', 'CELL ANNOTATION & AUDIT NOTE')}</h3>
              <button onClick={() => setShowAnnotationModal(false)} className="p-2 text-muted hover:text-ink" aria-label="Close annotation editor">✕</button>
            </div>
            <div className="text-xs font-mono text-muted space-y-1">
              <div>POSITION: Row {selectedCell?.rIdx + 1}, Col {getColumnLetter(selectedCell?.cIdx)}</div>
              <div>VALUE: <span className="text-ink font-semibold">{selectedCell?.cell?.val || '(empty)'}</span></div>
            </div>
            <textarea rows={3} placeholder="Add your note or audit flag here..." value={annotationText} onChange={(e) => setAnnotationText(e.target.value)} className="w-full bg-canvas border border-hairline-strong p-3 text-xs font-mono text-ink placeholder-muted-soft focus:outline-none focus:border-ink" />
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowAnnotationModal(false)} className="btn-secondary text-xs h-8 py-1 px-4">CANCEL</button>
              <button onClick={saveAnnotation} className="btn-primary text-xs h-8 py-1 px-4">SAVE NOTE</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ToolsSidebar({
  compareFormulas,
  diffGranularity,
  matchColumnsByHeaders,
  ignoreWhitespace,
  ignoreCase,
  collapseUnchangedBlocks,
  hideUnchangedRows,
  hideUnchangedColumns,
  preserveFormatting,
  sortRows,
  normalizeDatesUS,
  normalizeDatesEU,
  updateOption,
  headersA,
  onOpenAppearance,
  onClose,
  isDrawer
}) {
  return (
    <>
      {!isDrawer && (
        <div className="flex items-center justify-between border-b border-hairline pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-link" />
            <span className="text-xs font-mono text-ink font-bold uppercase tracking-wider">Tools & Options</span>
          </div>
          <button onClick={onClose} className="text-muted-soft hover:text-ink transition-colors" title="Collapse Sidebar" aria-label="Collapse Tools & Options">
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      )}
      <div className="space-y-3">
        <div className="text-[11px] font-mono text-muted uppercase tracking-wider font-semibold">Comparison options</div>

        <div className="grid grid-cols-2 gap-1 bg-canvas p-1 border border-hairline">
          <button onClick={() => updateOption('compareFormulas', false)} className={`py-1.5 text-xs font-mono text-center transition-all ${!compareFormulas ? 'bg-white text-black font-bold' : 'text-muted hover:text-ink'}`}>Standard</button>
          <button onClick={() => updateOption('compareFormulas', true)} className={`py-1.5 text-xs font-mono text-center transition-all ${compareFormulas ? 'bg-white text-black font-bold' : 'text-muted hover:text-ink'}`}>Formulas</button>
        </div>

        <div className="grid grid-cols-3 gap-1 bg-canvas p-1 border border-hairline">
          {['smart', 'word', 'char'].map((mode) => (
            <button key={mode} onClick={() => updateOption('diffGranularity', mode)} className={`py-1.5 text-xs font-mono text-center capitalize transition-all ${diffGranularity === mode ? 'bg-diff-formula-bg text-link font-bold border border-diff-formula-border' : 'text-muted hover:text-ink'}`}>{mode}</button>
          ))}
        </div>
      </div>

      <div className="space-y-3 border-t border-hairline pt-4">
        <ToggleRow label="Match columns by headers" checked={matchColumnsByHeaders} onChange={(val) => updateOption('matchColumnsByHeaders', val)} />
        <ToggleRow label="Ignore white space" checked={ignoreWhitespace} onChange={(val) => updateOption('ignoreWhitespace', val)} />
        <ToggleRow label="Ignore case changes" checked={ignoreCase} onChange={(val) => updateOption('ignoreCase', val)} />
        <ToggleRow label="Collapse unchanged blocks" checked={collapseUnchangedBlocks} onChange={(val) => updateOption('collapseUnchangedBlocks', val)} />
        <ToggleRow label="Hide unchanged rows" checked={hideUnchangedRows} onChange={(val) => updateOption('hideUnchangedRows', val)} />
        <ToggleRow label="Hide unchanged columns" checked={hideUnchangedColumns} onChange={(val) => updateOption('hideUnchangedColumns', val)} />
      </div>

      <div className="space-y-3 border-t border-hairline pt-4">
        <div className="text-[11px] font-mono text-muted uppercase tracking-wider font-semibold">Appearance</div>
        <ToggleRow label="Preserve formatting" checked={preserveFormatting} onChange={(val) => updateOption('preserveFormatting', val)} />
        <button onClick={onOpenAppearance} className="w-full py-2 px-3 border border-hairline-strong text-xs font-mono text-body hover:border-white hover:text-ink text-left flex items-center justify-between transition-all">
          <span>🎨 Change appearance</span>
          <ChevronRight className="w-3.5 h-3.5 text-muted-soft" />
        </button>
      </div>

      <div className="space-y-3 border-t border-hairline pt-4">
        <div className="text-[11px] font-mono text-muted uppercase tracking-wider font-semibold">Tools & Normalization</div>
        <div className="space-y-1">
          <label className="text-[10px] font-mono text-muted-soft uppercase">Sort rows</label>
          <select value={sortRows} onChange={(e) => updateOption('sortRows', e.target.value)} className="w-full bg-canvas border border-hairline-strong px-3 py-1.5 text-xs font-mono text-ink focus:outline-none focus:border-ink">
            <option value="none">Original Order</option>
            {headersA.map((header, idx) => (
              <option key={idx} value={`col${idx}`}>
                {header || `Column ${getColumnLetter(idx)}`}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => { updateOption('normalizeDatesUS', !normalizeDatesUS); if (!normalizeDatesUS) updateOption('normalizeDatesEU', false); }} className={`py-1.5 px-2 text-[11px] font-mono border text-center transition-all ${normalizeDatesUS ? 'border-success text-diff-added-text bg-diff-added-bg' : 'border-hairline-strong text-muted hover:border-ink hover:text-ink'}`}>Dates (US)</button>
          <button onClick={() => { updateOption('normalizeDatesEU', !normalizeDatesEU); if (!normalizeDatesEU) updateOption('normalizeDatesUS', false); }} className={`py-1.5 px-2 text-[11px] font-mono border text-center transition-all ${normalizeDatesEU ? 'border-success text-diff-added-text bg-diff-added-bg' : 'border-hairline-strong text-muted hover:border-ink hover:text-ink'}`}>Dates (EU)</button>
        </div>
      </div>
    </>
  );
}

function ChangesSidebar({ stats, changesList, activeChangeIndex, jumpToChange, onClose, isDrawer }) {
  return (
    <>
      {!isDrawer && (
        <div className="flex items-center justify-between border-b border-hairline pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-ink font-bold uppercase tracking-wider">Changes</span>
          </div>
          <button onClick={onClose} className="text-muted-soft hover:text-ink transition-colors" title="Collapse Sidebar" aria-label="Collapse Changes Sidebar">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
      <div className="flex items-center justify-between bg-canvas p-2 border border-hairline text-xs font-mono">
        <div className="flex items-center gap-3">
          <span className="text-diff-deleted-text font-bold" title="Deletions">- {stats.totalDeleted || 0}</span>
          <span className="text-diff-added-text font-bold" title="Additions">+ {stats.totalAdded || 0}</span>
          <span className="text-diff-modified-text font-bold" title="Modifications">~ {stats.totalModified || 0}</span>
          <span className="text-diff-formula-text font-bold" title="Formula Changes">ƒ {stats.totalFormulaChanges || 0}</span>
        </div>
        <div className="text-[10px] text-muted font-bold">TOTAL: {changesList.length}</div>
      </div>

      <div className="flex items-center justify-between bg-surface-elevated p-2 border border-hairline-strong">
        <span className="text-xs font-mono text-body">{changesList.length > 0 ? `${activeChangeIndex + 1} of ${changesList.length}` : '0 of 0'}</span>
        <div className="flex items-center gap-1">
          <button onClick={() => jumpToChange(activeChangeIndex - 1)} disabled={changesList.length === 0} className="p-1 text-body hover:text-ink border border-hairline-strong hover:border-white disabled:opacity-30 rounded transition-colors" title="Previous Change (Up Arrow)"><ChevronUp className="w-4 h-4" /></button>
          <button onClick={() => jumpToChange(activeChangeIndex + 1)} disabled={changesList.length === 0} className="p-1 text-body hover:text-ink border border-hairline-strong hover:border-white disabled:opacity-30 rounded transition-colors" title="Next Change (Down Arrow)"><ChevronDown className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1 scrollbar-thin">
        {changesList.length === 0 ? (
          <div className="text-center py-8 text-xs font-mono text-muted-soft">No changes detected in current view.</div>
        ) : (
          changesList.map((item, idx) => {
            const isActive = activeChangeIndex === idx;
            return (
              <div key={item.id} onClick={() => jumpToChange(idx)} className={`p-3 border text-xs font-mono transition-all cursor-pointer space-y-1.5 ${isActive ? 'border-white bg-surface-elevated shadow-md transform translate-x-0.5' : 'border-hairline bg-surface-soft hover:border-hairline-strong hover:bg-surface-card'}`}>
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full ${item.type === 'MODIFIED' ? 'bg-diff-modified-bg text-diff-modified-text border border-diff-modified-border' : item.type === 'ADDED' ? 'bg-diff-added-bg text-diff-added-text border border-diff-added-border' : item.type === 'DELETED' ? 'bg-diff-deleted-bg text-diff-deleted-text border border-diff-deleted-border' : 'bg-diff-formula-bg text-diff-formula-text border border-diff-formula-border'}`}>{item.type}</span>
                  <div className="flex items-center gap-2"><span className="font-bold text-ink">{item.cellRef}</span><span className="text-[10px] text-muted-soft">#{item.id}</span></div>
                </div>
                <div className="pt-1 text-[11px] leading-relaxed break-words font-mono"><FormattedCardDiff item={item} /></div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}

function ToggleRow({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between text-xs font-mono text-body cursor-pointer hover:text-ink transition-colors">
      <span>{label}</span>
      <div className="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only peer" />
        <div className="w-8 h-4 bg-hairline peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-ink after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-ink after:border-ink after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-success"></div>
      </div>
    </label>
  );
}

function getCellStyle(status, viewTab, preserveFormatting, viewMode) {
  if (status === 'MODIFIED') return 'bg-diff-modified-bg/90 text-diff-modified-text border-diff-modified-border font-medium';
  if (status === 'ADDED') return 'bg-diff-added-bg/90 text-diff-added-text border-diff-added-border font-medium';
  if (status === 'DELETED') return 'bg-diff-deleted-bg/90 text-diff-deleted-text border-diff-deleted-border font-medium';
  if (status === 'FORMULA_CHANGED') return 'bg-diff-formula-bg/90 text-diff-formula-text border-diff-formula-border font-medium underline';
  return 'bg-canvas text-body hover:bg-surface-card';
}

function OverlappedCellContent({ cellA, cellB, status, granularity, compareFormulas }) {
  if (status === 'SAME') {
    return <span className="cell-text">{cellB.val || cellA.val || '-'}</span>;
  }
  if (status === 'ADDED') {
    return <span className="cell-text text-diff-added-text underline font-bold">+{cellB.val}</span>;
  }
  if (status === 'DELETED') {
    return <span className="cell-text line-through text-diff-deleted-text">-{cellA.val}</span>;
  }
  if (status === 'FORMULA_CHANGED') {
    return (
      <div className="redline-cell-content">
        <span className="line-through text-diff-deleted-text opacity-80 block truncate">{cellA.formula || cellA.val}</span>
        <span className="text-diff-formula-text font-bold underline block truncate">ƒ{cellB.formula || cellB.val}</span>
      </div>
    );
  }
  const valA = cellA.val || '';
  const valB = cellB.val || '';
  return (
    <div className="redline-cell-content">
      <span className="line-through text-diff-deleted-text opacity-80 block truncate">{valA}</span>
      <span className="text-diff-added-text font-bold block truncate">{valB}</span>
    </div>
  );
}

function FormattedCardDiff({ item }) {
  const { charDiff, valA, valB, type } = item;
  if (type === 'ADDED') return <span className="text-diff-added-text font-bold">+{valB}</span>;
  if (type === 'DELETED') return <span className="line-through text-diff-deleted-text">{valA}</span>;
  if (type === 'FORMULA_CHANGED') {
    return (
      <div className="flex flex-wrap items-center gap-1">
        <span className="line-through text-diff-deleted-text bg-diff-deleted-bg px-0.5 rounded">ƒ{item.formulaA}</span>
        <span className="text-diff-formula-text underline bg-diff-formula-bg px-0.5 rounded font-bold">ƒ{item.formulaB}</span>
      </div>
    );
  }
  if (charDiff && charDiff.length > 0) {
    return (
      <div className="flex flex-wrap items-center gap-1">
        {charDiff.map((chunk, i) => {
          if (chunk.type === 'del') return <span key={i} className="line-through text-diff-deleted-text bg-diff-deleted-bg px-0.5 rounded">{chunk.text}</span>;
          if (chunk.type === 'add') return <span key={i} className="text-diff-added-text underline bg-diff-added-bg px-0.5 rounded font-bold">{chunk.text}</span>;
          return <span key={i} className="text-body">{chunk.text}</span>;
        })}
      </div>
    );
  }
  return <div><span className="line-through text-diff-deleted-text mr-2">{valA}</span><span className="text-diff-added-text font-bold">{valB}</span></div>;
}