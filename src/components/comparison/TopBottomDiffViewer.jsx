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
  colWidthsB = []
}) {
  const [viewMode, setViewMode] = useState('stacked'); // 'stacked' | 'overlapped'
  const [showLeftSidebar, setShowLeftSidebar] = useState(true);
  const [showRightSidebar, setShowRightSidebar] = useState(true);
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
  const [tableHeight, setTableHeight] = useState(() => Math.floor(window.innerHeight / 2 - 140));
  const [registerBodyHeight, setRegisterBodyHeight] = useState(0);
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1024);

  const { isFullView, toggleFullView, exitFullView } = useFullView({ isDesktop });

  useEffect(() => {
    const handleResize = () => setTableHeight(Math.floor(window.innerHeight / 2 - 140));
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
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
          list.push(...(row.hiddenRows || []));
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
      className: `py-2 px-3 border-r border-[#262626] relative cursor-pointer font-mono transition-all ${
        isCellFocused ? 'ring-2 ring-[#fcd34d] z-10 shadow-lg' : ''
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
    return isRowFocused ? 'bg-[#1f1f1f]/80' : '';
  };

  return (
    <div className={isFullView ? 'fixed inset-0 z-[60] bg-[#000000] flex flex-col gap-4 p-4 overflow-y-auto lg:overflow-hidden' : 'space-y-4'}>
      {/* Top Main Toolbar */}
      <div className="shrink-0 bg-[#141414] border border-[#262626] p-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowLeftSidebar(!showLeftSidebar)}
            className={`p-1.5 text-xs font-mono border rounded transition-all ${
              showLeftSidebar
                ? 'border-[#5fa657] text-[#5fa657] bg-[#062c19]'
                : 'border-[#3a3a3a] text-[#999999] hover:border-white hover:text-white'
            }`}
            title="Toggle Left Tools Sidebar"
          >
            <Sliders className="w-4 h-4 inline" />
            <span className="ml-1 text-[11px] font-bold hidden sm:inline">
              {showLeftSidebar ? 'HIDE TOOLS' : 'SHOW TOOLS'}
            </span>
          </button>

          <div className="h-4 w-px bg-[#262626] mx-1" />

          <span className="text-[10px] font-mono text-[#999999] uppercase tracking-wider hidden md:inline">LAYOUT:</span>
          <button
            onClick={() => setViewMode('stacked')}
            className={`px-3 py-1.5 text-xs font-mono tracking-wider uppercase border rounded-full transition-all ${
              viewMode === 'stacked'
                ? 'border-white text-white bg-[#1f1f1f] font-bold'
                : 'border-[#3a3a3a] text-[#999999] hover:border-white hover:text-white'
            }`}
          >
            <LayersIcon className="w-3.5 h-3.5 inline mr-1" />
            Stacked
          </button>
          <button
            onClick={() => setViewMode('overlapped')}
            className={`px-3 py-1.5 text-xs font-mono tracking-wider uppercase border rounded-full transition-all ${
              viewMode === 'overlapped'
                ? 'border-white text-white bg-[#1f1f1f] font-bold'
                : 'border-[#3a3a3a] text-[#999999] hover:border-white hover:text-white'
            }`}
          >
            <Maximize2 className="w-3.5 h-3.5 inline mr-1" />
            Overlapped
          </button>

          <div className="h-4 w-px bg-[#262626] mx-1" />

          <span className="text-[10px] font-mono text-[#999999] uppercase tracking-wider hidden md:inline">VIEW:</span>
          <button
            onClick={() => setViewTab('both')}
            className={`px-3 py-1.5 text-xs font-mono tracking-wider uppercase border rounded-full transition-all ${
              viewTab === 'both'
                ? 'border-white text-white bg-[#1f1f1f] font-bold'
                : 'border-[#3a3a3a] text-[#999999] hover:border-white hover:text-white'
            }`}
          >
            <Eye className="w-3.5 h-3.5 inline mr-1" />
            Both Files
          </button>
          <button
            onClick={() => setViewTab('original')}
            className={`px-3 py-1.5 text-xs font-mono tracking-wider uppercase border rounded-full transition-all ${
              viewTab === 'original'
                ? 'border-white text-white bg-[#1f1f1f] font-bold'
                : 'border-[#3a3a3a] text-[#999999] hover:border-white hover:text-white'
            }`}
          >
            Original (Top)
          </button>
          <button
            onClick={() => setViewTab('changed')}
            className={`px-3 py-1.5 text-xs font-mono tracking-wider uppercase border rounded-full transition-all ${
              viewTab === 'changed'
                ? 'border-white text-white bg-[#1f1f1f] font-bold'
                : 'border-[#3a3a3a] text-[#999999] hover:border-white hover:text-white'
            }`}
          >
            Changed (Bottom)
          </button>

          <div className="h-4 w-px bg-[#262626] mx-1" />

          <label className="flex items-center gap-2 cursor-pointer text-xs font-mono text-[#999999] hover:text-white">
            <input
              type="checkbox"
              checked={syncScroll}
              onChange={(e) => setSyncScroll(e.target.checked)}
              className="w-4 h-4 accent-[#5fa657]"
            />
            Sync Scroll
          </label>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#666666]" />
            <input
              type="text"
              placeholder="Filter cells..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[#000000] border border-[#3a3a3a] pl-8 pr-3 py-1 text-xs font-mono text-white placeholder-[#666666] focus:outline-none focus:border-white w-40 sm:w-56"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAppearanceModal(true)}
            className="p-1.5 text-xs font-mono border border-[#3a3a3a] text-[#999999] hover:border-white hover:text-white rounded"
            title="Appearance Settings"
          >
            <Settings className="w-4 h-4" />
          </button>

          <button
            onClick={toggleFullView}
            className={`p-1.5 text-xs font-mono border rounded transition-all ${
              isFullView
                ? 'border-[#5fa657] text-[#5fa657] bg-[#062c19]'
                : 'border-[#3a3a3a] text-[#999999] hover:border-white hover:text-white'
            }`}
            title={isFullView ? 'Exit Full View' : 'Enter Full View'}
            aria-pressed={isFullView}
            aria-label={isFullView ? 'Exit Full View' : 'Enter Full View'}
          >
            {isFullView ? <Minimize className="w-4 h-4 inline" /> : <Maximize className="w-4 h-4 inline" />}
            <span className="ml-1 text-[11px] font-bold hidden sm:inline">
              {isFullView ? 'EXIT FULL VIEW' : 'FULL VIEW'}
            </span>
          </button>

          <button onClick={onExport} className="btn-primary py-1.5 px-3 text-xs h-8 tracking-[1px]">
            <Download className="w-3.5 h-3.5 inline mr-1" />
            Export
          </button>
          <button
            onClick={() => { if (onShare) onShare(); setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2000); }}
            className="btn-secondary py-1.5 px-3 text-xs h-8 tracking-[1px]"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 inline mr-1 text-[#5fa657]" /> : <Share2 className="w-3.5 h-3.5 inline mr-1" />}
            {copiedLink ? 'Copied' : 'Share'}
          </button>

          <div className="h-4 w-px bg-[#262626] mx-1" />

          <button
            onClick={() => setShowRightSidebar(!showRightSidebar)}
            className={`p-1.5 text-xs font-mono border rounded transition-all ${
              showRightSidebar
                ? 'border-[#c3d9f3] text-[#c3d9f3] bg-[#1e1b4b]'
                : 'border-[#3a3a3a] text-[#999999] hover:border-white hover:text-white'
            }`}
            title="Toggle Right Changes Sidebar"
          >
            <span className="mr-1 text-[11px] font-bold hidden sm:inline">
              {showRightSidebar ? 'HIDE AUDIT' : 'SHOW AUDIT'}
            </span>
            <Layers className="w-4 h-4 inline" />
          </button>
        </div>
      </div>

      <div className={`grid grid-cols-1 lg:grid-cols-12 gap-4 ${isFullView ? 'flex-1 min-h-0 items-stretch h-full' : 'items-start'}`}>
        {showLeftSidebar && (
          <div className={`lg:col-span-3 bg-[#141414] border border-[#262626] p-4 space-y-6 select-none transition-all ${isFullView ? 'h-full min-h-0 overflow-y-auto' : ''}`}>
            <div className="flex items-center justify-between border-b border-[#262626] pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#c3d9f3]" />
                <span className="text-xs font-mono text-white font-bold uppercase tracking-wider">Tools & Options</span>
              </div>
              <button onClick={() => setShowLeftSidebar(false)} className="text-[#666666] hover:text-white transition-colors" title="Collapse Sidebar">
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="text-[11px] font-mono text-[#999999] uppercase tracking-wider font-semibold">Comparison options</div>
              
              <div className="grid grid-cols-2 gap-1 bg-[#000000] p-1 border border-[#262626]">
                <button onClick={() => updateOption('compareFormulas', false)} className={`py-1.5 text-xs font-mono text-center transition-all ${!compareFormulas ? 'bg-white text-black font-bold' : 'text-[#999999] hover:text-white'}`}>Standard</button>
                <button onClick={() => updateOption('compareFormulas', true)} className={`py-1.5 text-xs font-mono text-center transition-all ${compareFormulas ? 'bg-white text-black font-bold' : 'text-[#999999] hover:text-white'}`}>Formulas</button>
              </div>

              <div className="grid grid-cols-3 gap-1 bg-[#000000] p-1 border border-[#262626]">
                {['smart', 'word', 'char'].map((mode) => (
                  <button key={mode} onClick={() => updateOption('diffGranularity', mode)} className={`py-1.5 text-xs font-mono text-center capitalize transition-all ${diffGranularity === mode ? 'bg-[#1e1b4b] text-[#c3d9f3] font-bold border border-[#4338ca]' : 'text-[#999999] hover:text-white'}`}>{mode}</button>
                ))}
              </div>
            </div>

            <div className="space-y-3 border-t border-[#262626] pt-4">
              <ToggleRow label="Match columns by headers" checked={matchColumnsByHeaders} onChange={(val) => updateOption('matchColumnsByHeaders', val)} />
              <ToggleRow label="Ignore white space" checked={ignoreWhitespace} onChange={(val) => updateOption('ignoreWhitespace', val)} />
              <ToggleRow label="Ignore case changes" checked={ignoreCase} onChange={(val) => updateOption('ignoreCase', val)} />
              <ToggleRow label="Collapse unchanged blocks" checked={collapseUnchangedBlocks} onChange={(val) => updateOption('collapseUnchangedBlocks', val)} />
              <ToggleRow label="Hide unchanged rows" checked={hideUnchangedRows} onChange={(val) => updateOption('hideUnchangedRows', val)} />
              <ToggleRow label="Hide unchanged columns" checked={hideUnchangedColumns} onChange={(val) => updateOption('hideUnchangedColumns', val)} />
            </div>

            <div className="space-y-3 border-t border-[#262626] pt-4">
              <div className="text-[11px] font-mono text-[#999999] uppercase tracking-wider font-semibold">Appearance</div>
              <ToggleRow label="Preserve formatting" checked={preserveFormatting} onChange={(val) => updateOption('preserveFormatting', val)} />
              <button onClick={() => setShowAppearanceModal(true)} className="w-full py-2 px-3 border border-[#3a3a3a] text-xs font-mono text-[#cccccc] hover:border-white hover:text-white text-left flex items-center justify-between transition-all">
                <span>🎨 Change appearance</span>
                <ChevronRight className="w-3.5 h-3.5 text-[#666666]" />
              </button>
            </div>

            <div className="space-y-3 border-t border-[#262626] pt-4">
              <div className="text-[11px] font-mono text-[#999999] uppercase tracking-wider font-semibold">Tools & Normalization</div>
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-[#666666] uppercase">Sort rows</label>
                <select value={sortRows} onChange={(e) => updateOption('sortRows', e.target.value)} className="w-full bg-[#000000] border border-[#3a3a3a] px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-white">
                  <option value="none">Original Order</option>
                  {headersA.map((header, idx) => (
                    <option key={idx} value={`col${idx}`}>
                      {header || `Column ${getColumnLetter(idx)}`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => { updateOption('normalizeDatesUS', !normalizeDatesUS); if (!normalizeDatesUS) updateOption('normalizeDatesEU', false); }} className={`py-1.5 px-2 text-[11px] font-mono border text-center transition-all ${normalizeDatesUS ? 'border-[#5fa657] text-[#6ee7b7] bg-[#062c19]' : 'border-[#3a3a3a] text-[#999999] hover:border-white hover:text-white'}`}>Dates (US)</button>
                <button onClick={() => { updateOption('normalizeDatesEU', !normalizeDatesEU); if (!normalizeDatesEU) updateOption('normalizeDatesUS', false); }} className={`py-1.5 px-2 text-[11px] font-mono border text-center transition-all ${normalizeDatesEU ? 'border-[#5fa657] text-[#6ee7b7] bg-[#062c19]' : 'border-[#3a3a3a] text-[#999999] hover:border-white hover:text-white'}`}>Dates (EU)</button>
              </div>
            </div>
          </div>
        )}

        <div className={`${
          showLeftSidebar && showRightSidebar ? 'lg:col-span-6' :
          showLeftSidebar || showRightSidebar ? 'lg:col-span-9' : 'lg:col-span-12'
        } bg-[#0d0d0d] border border-[#262626] space-y-0 transition-all min-w-0 ${isFullView ? 'min-h-0 flex flex-col' : ''}`}>
          
          <div className="shrink-0 bg-[#141414] px-4 py-2 border-b border-[#262626] flex items-center justify-between text-xs font-mono uppercase text-white select-none">
            <div className="flex items-center gap-4">
              <span className="font-bold text-[#c3d9f3]">{sheetName}</span>
              <span className="text-[10px] text-[#666666]">{displayRows.length} ROW(S) DISPLAYED</span>
              {viewMode === 'overlapped' && (
                <span className="px-2 py-0.5 text-[10px] font-mono bg-[#1e1b4b] text-[#a5b4fc] border border-[#4338ca] rounded">OVERLAPPED VIEW</span>
              )}
            </div>
            {activeChange && (
              <div className="text-[11px] text-[#fcd34d] font-mono animate-pulse hidden sm:block">
                FOCUSED: CELL {activeChange.cellRef} (#{activeChange.id})
              </div>
            )}
          </div>

          <div ref={registerBodyRef} className={isFullView ? 'flex-1 min-h-0 overflow-hidden' : ''}>
            {viewMode === 'stacked' ? (
              <div className="space-y-4 p-4">
              <div className="bg-[#141414] border border-[#262626] p-2"
                onPointerDown={() => { activePaneRef.current = 'top'; }}
                onWheel={() => { activePaneRef.current = 'top'; }}
                onTouchStart={() => { activePaneRef.current = 'top'; }}
                onFocus={() => { activePaneRef.current = 'top'; }}
                onPointerLeave={() => { if (activePaneRef.current === 'top') activePaneRef.current = null; }}
              >
                <div className="text-xs font-mono text-[#c3d9f3] mb-2">FILE 1 (ORIGINAL / BEFORE)</div>
                <SpreadsheetVirtualizedTable
                  ref={virtualTopTableRef}
                  rows={displayRows}
                  columns={buildColumns(colWidthsA)}
                  rowHeight={32}
                  headerHeight={36}
                  firstColWidth={48}
                  containerHeight={stackedTableHeight}
                  overscan={12}
                  estimatedRowSize={() => 32}
                  fixedRowHeight={true}
                  onToggleCollapse={handleToggleCollapse}
                  renderCollapsedRow={(row) => (
                    <div className="flex items-center justify-center gap-2 py-1 text-[#c3d9f3] font-bold">
                      <span>↕</span>
                      <span>{row.count} UNCHANGED ROWS COLLAPSED</span>
                      <span className="text-[10px] text-[#999999] font-normal">(Click row to expand)</span>
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
              <div className="bg-[#141414] border border-[#262626] p-2"
                onPointerDown={() => { activePaneRef.current = 'bottom'; }}
                onWheel={() => { activePaneRef.current = 'bottom'; }}
                onTouchStart={() => { activePaneRef.current = 'bottom'; }}
                onFocus={() => { activePaneRef.current = 'bottom'; }}
                onPointerLeave={() => { if (activePaneRef.current === 'bottom') activePaneRef.current = null; }}
              >
                <div className="text-xs font-mono text-[#fca5a5] mb-2">FILE 2 (MODIFIED / AFTER)</div>
                <SpreadsheetVirtualizedTable
                  ref={virtualBottomTableRef}
                  rows={displayRows}
                  columns={buildColumns(colWidthsB)}
                  rowHeight={32}
                  headerHeight={36}
                  firstColWidth={48}
                  containerHeight={stackedTableHeight}
                  overscan={12}
                  estimatedRowSize={() => 32}
                  fixedRowHeight={true}
                  onToggleCollapse={handleToggleCollapse}
                  renderCollapsedRow={(row) => (
                    <div className="flex items-center justify-center gap-2 py-1 text-[#c3d9f3] font-bold">
                      <span>↕</span>
                      <span>{row.count} UNCHANGED ROWS COLLAPSED</span>
                      <span className="text-[10px] text-[#999999] font-normal">(Click row to expand)</span>
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
            <div className="p-4">
              <div className="bg-[#141414] border border-[#262626] p-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono text-[#a5b4fc]">OVERLAPPED / MERGED VIEW</span>
                  <span className="text-[10px] text-[#666666]">Green = Added, Red = Deleted, Yellow = Modified, Blue = Formula Changed</span>
                </div>
                <SpreadsheetVirtualizedTable
                  ref={virtualOverlappedTableRef}
                  rows={displayRows}
                  columns={buildColumns(colWidthsA.length > 0 ? colWidthsA : colWidthsB)}
                  rowHeight={32}
                  headerHeight={36}
                  firstColWidth={48}
                  containerHeight={overlappedTableHeight}
                  overscan={5}
                  estimatedRowSize={() => 32}
                  onToggleCollapse={handleToggleCollapse}
                  renderCollapsedRow={(row) => (
                    <div className="flex items-center justify-center gap-2 py-1 text-[#c3d9f3] font-bold">
                      <span>↕</span>
                      <span>{row.count} UNCHANGED ROWS COLLAPSED</span>
                      <span className="text-[10px] text-[#999999] font-normal">(Click row to expand)</span>
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

        {showRightSidebar && (
          <div className={`lg:col-span-3 bg-[#141414] border border-[#262626] p-4 space-y-4 select-none transition-all ${isFullView ? 'h-full min-h-0 overflow-y-auto' : ''}`}>
            <div className="flex items-center justify-between border-b border-[#262626] pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-white font-bold uppercase tracking-wider">Changes</span>
              </div>
              <button onClick={() => setShowRightSidebar(false)} className="text-[#666666] hover:text-white transition-colors" title="Collapse Sidebar">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between bg-[#000000] p-2 border border-[#262626] text-xs font-mono">
              <div className="flex items-center gap-3">
                <span className="text-[#fca5a5] font-bold" title="Deletions">- {stats.totalDeleted || 0}</span>
                <span className="text-[#6ee7b7] font-bold" title="Additions">+ {stats.totalAdded || 0}</span>
                <span className="text-[#fcd34d] font-bold" title="Modifications">~ {stats.totalModified || 0}</span>
                <span className="text-[#a5b4fc] font-bold" title="Formula Changes">ƒ {stats.totalFormulaChanges || 0}</span>
              </div>
              <div className="text-[10px] text-[#999999] font-bold">TOTAL: {changesList.length}</div>
            </div>

            <div className="flex items-center justify-between bg-[#1f1f1f] p-2 border border-[#3a3a3a]">
              <span className="text-xs font-mono text-[#cccccc]">{changesList.length > 0 ? `${activeChangeIndex + 1} of ${changesList.length}` : '0 of 0'}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => jumpToChange(activeChangeIndex - 1)} disabled={changesList.length === 0} className="p-1 text-[#cccccc] hover:text-white border border-[#3a3a3a] hover:border-white disabled:opacity-30 rounded transition-colors" title="Previous Change (Up Arrow)"><ChevronUp className="w-4 h-4" /></button>
                <button onClick={() => jumpToChange(activeChangeIndex + 1)} disabled={changesList.length === 0} className="p-1 text-[#cccccc] hover:text-white border border-[#3a3a3a] hover:border-white disabled:opacity-30 rounded transition-colors" title="Next Change (Down Arrow)"><ChevronDown className="w-4 h-4" /></button>
              </div>
            </div>

            <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1 scrollbar-thin">
              {changesList.length === 0 ? (
                <div className="text-center py-8 text-xs font-mono text-[#666666]">No changes detected in current view.</div>
              ) : (
                changesList.map((item, idx) => {
                  const isActive = activeChangeIndex === idx;
                  return (
                    <div key={item.id} onClick={() => jumpToChange(idx)} className={`p-3 border text-xs font-mono transition-all cursor-pointer space-y-1.5 ${isActive ? 'border-white bg-[#1f1f1f] shadow-md transform translate-x-0.5' : 'border-[#262626] bg-[#0d0d0d] hover:border-[#3a3a3a] hover:bg-[#141414]'}`}>
                      <div className="flex items-center justify-between">
                        <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full ${item.type === 'MODIFIED' ? 'bg-[#2d2208] text-[#fcd34d] border border-[#78350f]' : item.type === 'ADDED' ? 'bg-[#062c19] text-[#6ee7b7] border border-[#047857]' : item.type === 'DELETED' ? 'bg-[#3b1219] text-[#fca5a5] border border-[#b91c1c]' : 'bg-[#1e1b4b] text-[#a5b4fc] border border-[#4338ca]'}`}>{item.type}</span>
                        <div className="flex items-center gap-2"><span className="font-bold text-white">{item.cellRef}</span><span className="text-[10px] text-[#666666]">#{item.id}</span></div>
                      </div>
                      <div className="pt-1 text-[11px] leading-relaxed break-words font-mono"><FormattedCardDiff item={item} /></div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

      </div>

      {showAppearanceModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#262626] p-6 max-w-md w-full space-y-4 select-none">
            <div className="flex justify-between items-center border-b border-[#262626] pb-3">
              <h3 className="text-title-sm text-white flex items-center gap-2"><Settings className="w-4 h-4 text-[#c3d9f3]" />APPEARANCE & THEME SETTINGS</h3>
              <button onClick={() => setShowAppearanceModal(false)} className="text-[#999999] hover:text-white">✕</button>
            </div>
            <div className="space-y-3">
              <div className="text-xs font-mono text-[#999999] uppercase">Grid Theme Preset</div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setAppearanceTheme('dark')} className={`p-3 border text-xs font-mono text-left ${appearanceTheme === 'dark' ? 'border-white bg-[#1f1f1f] text-white' : 'border-[#262626] text-[#999999]'}`}>Sleek Dark Mode</button>
                <button onClick={() => setAppearanceTheme('highContrast')} className={`p-3 border text-xs font-mono text-left ${appearanceTheme === 'highContrast' ? 'border-white bg-[#1f1f1f] text-white' : 'border-[#262626] text-[#999999]'}`}>High Contrast</button>
              </div>
            </div>
            <div className="flex justify-end pt-2"><button onClick={() => setShowAppearanceModal(false)} className="btn-primary text-xs h-8 py-1 px-4">APPLY & CLOSE</button></div>
          </div>
        </div>
      )}

      {showAnnotationModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#262626] p-6 max-w-md w-full space-y-4">
            <div className="flex justify-between items-center border-b border-[#262626] pb-3">
              <h3 className="text-title-sm text-white flex items-center gap-2"><MessageSquare className="w-4 h-4 text-[#c3d9f3]" />CELL ANNOTATION & AUDIT NOTE</h3>
              <button onClick={() => setShowAnnotationModal(false)} className="text-[#999999] hover:text-white">✕</button>
            </div>
            <div className="text-xs font-mono text-[#999999] space-y-1">
              <div>POSITION: Row {selectedCell?.rIdx + 1}, Col {getColumnLetter(selectedCell?.cIdx)}</div>
              <div>VALUE: <span className="text-white font-semibold">{selectedCell?.cell?.val || '(empty)'}</span></div>
            </div>
            <textarea rows={3} placeholder="Add your note or audit flag here..." value={annotationText} onChange={(e) => setAnnotationText(e.target.value)} className="w-full bg-[#000000] border border-[#3a3a3a] p-3 text-xs font-mono text-white placeholder-[#666666] focus:outline-none focus:border-white" />
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

function ToggleRow({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between text-xs font-mono text-[#cccccc] cursor-pointer hover:text-white transition-colors">
      <span>{label}</span>
      <div className="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only peer" />
        <div className="w-8 h-4 bg-[#262626] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[#5fa657]"></div>
      </div>
    </label>
  );
}

function getCellStyle(status, viewTab, preserveFormatting, viewMode) {
  if (status === 'MODIFIED') return 'bg-[#2d2208]/90 text-[#fcd34d] border-[#78350f] font-medium';
  if (status === 'ADDED') return 'bg-[#062c19]/90 text-[#6ee7b7] border-[#047857] font-medium';
  if (status === 'DELETED') return 'bg-[#3b1219]/90 text-[#fca5a5] border-[#b91c1c] font-medium';
  if (status === 'FORMULA_CHANGED') return 'bg-[#1e1b4b]/90 text-[#a5b4fc] border-[#4338ca] font-medium underline';
  return 'bg-[#000000] text-[#cccccc] hover:bg-[#141414]';
}

function OverlappedCellContent({ cellA, cellB, status, granularity, compareFormulas }) {
  if (status === 'SAME') {
    return <span className="cell-text">{cellB.val || cellA.val || '-'}</span>;
  }
  if (status === 'ADDED') {
    return <span className="cell-text text-[#6ee7b7] underline font-bold">+{cellB.val}</span>;
  }
  if (status === 'DELETED') {
    return <span className="cell-text line-through text-[#fca5a5]">-{cellA.val}</span>;
  }
  if (status === 'FORMULA_CHANGED') {
    return (
      <div className="redline-cell-content">
        <span className="line-through text-[#fca5a5] opacity-80 block truncate">{cellA.formula || cellA.val}</span>
        <span className="text-[#a5b4fc] font-bold underline block truncate">ƒ{cellB.formula || cellB.val}</span>
      </div>
    );
  }
  const valA = cellA.val || '';
  const valB = cellB.val || '';
  return (
    <div className="redline-cell-content">
      <span className="line-through text-[#fca5a5] opacity-80 block truncate">{valA}</span>
      <span className="text-[#6ee7b7] font-bold block truncate">{valB}</span>
    </div>
  );
}

function FormattedCardDiff({ item }) {
  const { charDiff, valA, valB, type } = item;
  if (type === 'ADDED') return <span className="text-[#6ee7b7] font-bold">+{valB}</span>;
  if (type === 'DELETED') return <span className="line-through text-[#fca5a5]">{valA}</span>;
  if (type === 'FORMULA_CHANGED') {
    return (
      <div className="flex flex-wrap items-center gap-1">
        <span className="line-through text-[#fca5a5] bg-[#3b1219] px-0.5 rounded">ƒ{item.formulaA}</span>
        <span className="text-[#a5b4fc] underline bg-[#1e1b4b] px-0.5 rounded font-bold">ƒ{item.formulaB}</span>
      </div>
    );
  }
  if (charDiff && charDiff.length > 0) {
    return (
      <div className="flex flex-wrap items-center gap-1">
        {charDiff.map((chunk, i) => {
          if (chunk.type === 'del') return <span key={i} className="line-through text-[#fca5a5] bg-[#3b1219] px-0.5 rounded">{chunk.text}</span>;
          if (chunk.type === 'add') return <span key={i} className="text-[#6ee7b7] underline bg-[#062c19] px-0.5 rounded font-bold">{chunk.text}</span>;
          return <span key={i} className="text-[#cccccc]">{chunk.text}</span>;
        })}
      </div>
    );
  }
  return <div><span className="line-through text-[#fca5a5] mr-2">{valA}</span><span className="text-[#6ee7b7] font-bold">{valB}</span></div>;
}