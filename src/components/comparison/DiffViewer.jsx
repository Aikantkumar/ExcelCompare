import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  Settings
} from 'lucide-react';
import { getColumnLetter } from './diffEngine';
import { VirtualizedTable, SpreadsheetVirtualizedTable } from './VirtualizedTable';

export default function DiffViewer({ 
  diffData, 
  sheetName, 
  onExport, 
  onShare,
  options = {},
  onOptionsChange = () => {},
  headersA = [],
  headersB = []
}) {
  // Sidebar visibility states
  const [showLeftSidebar, setShowLeftSidebar] = useState(true);
  const [showRightSidebar, setShowRightSidebar] = useState(true);

  // Tab mode above table: 'redline' | 'original' | 'changed'
  const [viewTab, setViewTab] = useState('redline');

  // Interactive change selection & navigation state
  const [activeChangeIndex, setActiveChangeIndex] = useState(0);
  const [selectedCell, setSelectedCell] = useState(null);
  const [annotationText, setAnnotationText] = useState('');
  const [showAnnotationModal, setShowAnnotationModal] = useState(false);
  const [showAppearanceModal, setShowAppearanceModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [annotations, setAnnotations] = useState({});

  // Appearance settings
  const [appearanceTheme, setAppearanceTheme] = useState('dark'); // 'dark' | 'glass' | 'highContrast'

  // Sync scroll and scroll-to-cell refs
  const leftTableRef = useRef(null);
  const rightTableRef = useRef(null);
  const isSyncingRef = useRef(false);
  const virtualTableRef = useRef(null);

  const { rows = [], changesList = [], activeColIndices = [], stats = {} } = diffData || {};

  // Extract options or fall back to defaults
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
    onOptionsChange({
      ...options,
      [key]: value,
    });
  };

  // Step to change item (Up/Down arrows or card click)
  const jumpToChange = (index) => {
    if (!changesList || changesList.length === 0) return;
    const targetIdx = (index + changesList.length) % changesList.length;
    setActiveChangeIndex(targetIdx);

    const change = changesList[targetIdx];
    if (change) {
      // First scroll the virtualized table to the row
      if (virtualTableRef.current) {
        virtualTableRef.current.scrollToIndex(change.rowIdx, 'center');
      }
      // Then scroll the cell into view horizontally
      const cellId = `cell-${change.rowIdx}-${change.colIdx}`;
      const elem = document.getElementById(cellId);
      if (elem) {
        elem.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      }
    }
  };

  // Keyboard navigation (Up/Down arrow keys)
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

  // Synchronized scrolling for dual viewport fallback
  const handleScrollSync = (source) => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    const sourceElem = source === 'left' ? leftTableRef.current : rightTableRef.current;
    const targetElem = source === 'left' ? rightTableRef.current : leftTableRef.current;

    if (sourceElem && targetElem) {
      targetElem.scrollTop = sourceElem.scrollTop;
      targetElem.scrollLeft = sourceElem.scrollLeft;
    }
    requestAnimationFrame(() => {
      isSyncingRef.current = false;
    });
  };

  const handleCellClick = (rIdx, cIdx, cell, side = 'both') => {
    const key = `${rIdx}_${cIdx}_${side}`;
    setSelectedCell({ rIdx, cIdx, cell, side, key });
    setAnnotationText(annotations[key] || '');
    setShowAnnotationModal(true);
  };

  const saveAnnotation = () => {
    if (!selectedCell) return;
    setAnnotations((prev) => ({
      ...prev,
      [selectedCell.key]: annotationText,
    }));
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

  // Filter and flatten rows by searchQuery and expanded blocks
  const displayRows = useMemo(() => {
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

  const activeChange = changesList[activeChangeIndex];

  return (
    <div className="space-y-4">
      {/* Top Main Toolbar */}
      <div className="bg-[#141414] border border-[#262626] p-3 flex flex-wrap items-center justify-between gap-4">
        {/* Left: View Mode Switches & Sidebar Toggles */}
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

          <span className="text-[10px] font-mono text-[#999999] uppercase tracking-wider hidden md:inline">VIEW:</span>
          <button
            onClick={() => setViewTab('redline')}
            className={`px-3 py-1.5 text-xs font-mono tracking-wider uppercase border rounded-full transition-all ${
              viewTab === 'redline'
                ? 'border-white text-white bg-[#1f1f1f] font-bold'
                : 'border-[#3a3a3a] text-[#999999] hover:border-white hover:text-white'
            }`}
          >
            <Eye className="w-3.5 h-3.5 inline mr-1" />
            Redline Grid
          </button>
          <button
            onClick={() => setViewTab('original')}
            className={`px-3 py-1.5 text-xs font-mono tracking-wider uppercase border rounded-full transition-all ${
              viewTab === 'original'
                ? 'border-white text-white bg-[#1f1f1f] font-bold'
                : 'border-[#3a3a3a] text-[#999999] hover:border-white hover:text-white'
            }`}
          >
            Original
          </button>
          <button
            onClick={() => setViewTab('changed')}
            className={`px-3 py-1.5 text-xs font-mono tracking-wider uppercase border rounded-full transition-all ${
              viewTab === 'changed'
                ? 'border-white text-white bg-[#1f1f1f] font-bold'
                : 'border-[#3a3a3a] text-[#999999] hover:border-white hover:text-white'
            }`}
          >
            Changed
          </button>
        </div>

        {/* Center: Search & Formula Indicator */}
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

        {/* Right: Actions & Right Sidebar Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAppearanceModal(true)}
            className="p-1.5 text-xs font-mono border border-[#3a3a3a] text-[#999999] hover:border-white hover:text-white rounded"
            title="Appearance Settings"
          >
            <Settings className="w-4 h-4" />
          </button>

          <button
            onClick={onExport}
            className="btn-primary py-1.5 px-3 text-xs h-8 tracking-[1px]"
          >
            <Download className="w-3.5 h-3.5 inline mr-1" />
            Export
          </button>
          <button
            onClick={() => {
              if (onShare) onShare();
              setCopiedLink(true);
              setTimeout(() => setCopiedLink(false), 2000);
            }}
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

      {/* Main 3-Column Split Viewport Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        
        {/* ========================================================================= */}
        {/* 🛠️ LEFT SIDEBAR: TOOLS & COMPARISON OPTIONS PANEL                          */}
        {/* ========================================================================= */}
        {showLeftSidebar && (
          <div className="lg:col-span-3 bg-[#141414] border border-[#262626] p-4 space-y-6 select-none transition-all">
            {/* Panel Header */}
            <div className="flex items-center justify-between border-b border-[#262626] pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#c3d9f3]" />
                <span className="text-xs font-mono text-white font-bold uppercase tracking-wider">
                  Tools & Options
                </span>
              </div>
              <button
                onClick={() => setShowLeftSidebar(false)}
                className="text-[#666666] hover:text-white transition-colors"
                title="Collapse Sidebar"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>

            {/* Section 1: Comparison options (Standard vs Formulas / Granularity) */}
            <div className="space-y-3">
              <div className="text-[11px] font-mono text-[#999999] uppercase tracking-wider font-semibold">
                Comparison options
              </div>

              {/* Standard vs Formulas Segmented Buttons */}
              <div className="grid grid-cols-2 gap-1 bg-[#000000] p-1 border border-[#262626]">
                <button
                  onClick={() => updateOption('compareFormulas', false)}
                  className={`py-1.5 text-xs font-mono text-center transition-all ${
                    !compareFormulas
                      ? 'bg-white text-black font-bold'
                      : 'text-[#999999] hover:text-white'
                  }`}
                >
                  Standard
                </button>
                <button
                  onClick={() => updateOption('compareFormulas', true)}
                  className={`py-1.5 text-xs font-mono text-center transition-all ${
                    compareFormulas
                      ? 'bg-white text-black font-bold'
                      : 'text-[#999999] hover:text-white'
                  }`}
                >
                  Formulas
                </button>
              </div>

              {/* Smart | Word | Char Segmented Buttons */}
              <div className="grid grid-cols-3 gap-1 bg-[#000000] p-1 border border-[#262626]">
                {['smart', 'word', 'char'].map((mode) => (
                  <button
                    key={mode}
                    onClick={() => updateOption('diffGranularity', mode)}
                    className={`py-1.5 text-xs font-mono text-center capitalize transition-all ${
                      diffGranularity === mode
                        ? 'bg-[#1e1b4b] text-[#c3d9f3] font-bold border border-[#4338ca]'
                        : 'text-[#999999] hover:text-white'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {/* Section 2: Matching & Visibility Toggles */}
            <div className="space-y-3 border-t border-[#262626] pt-4">
              <ToggleRow
                label="Match columns by headers"
                checked={matchColumnsByHeaders}
                onChange={(val) => updateOption('matchColumnsByHeaders', val)}
              />
              <ToggleRow
                label="Ignore white space"
                checked={ignoreWhitespace}
                onChange={(val) => updateOption('ignoreWhitespace', val)}
              />
              <ToggleRow
                label="Ignore case changes"
                checked={ignoreCase}
                onChange={(val) => updateOption('ignoreCase', val)}
              />
              <ToggleRow
                label="Collapse unchanged blocks"
                checked={collapseUnchangedBlocks}
                onChange={(val) => updateOption('collapseUnchangedBlocks', val)}
              />
              <ToggleRow
                label="Hide unchanged rows"
                checked={hideUnchangedRows}
                onChange={(val) => updateOption('hideUnchangedRows', val)}
              />
              <ToggleRow
                label="Hide unchanged columns"
                checked={hideUnchangedColumns}
                onChange={(val) => updateOption('hideUnchangedColumns', val)}
              />
            </div>

            {/* Section 3: Appearance Controls */}
            <div className="space-y-3 border-t border-[#262626] pt-4">
              <div className="text-[11px] font-mono text-[#999999] uppercase tracking-wider font-semibold">
                Appearance
              </div>
              <ToggleRow
                label="Preserve formatting"
                checked={preserveFormatting}
                onChange={(val) => updateOption('preserveFormatting', val)}
              />
              <button
                onClick={() => setShowAppearanceModal(true)}
                className="w-full py-2 px-3 border border-[#3a3a3a] text-xs font-mono text-[#cccccc] hover:border-white hover:text-white text-left flex items-center justify-between transition-all"
              >
                <span>🎨 Change appearance</span>
                <ChevronRight className="w-3.5 h-3.5 text-[#666666]" />
              </button>
            </div>

            {/* Section 4: Data Normalization Tools */}
            <div className="space-y-3 border-t border-[#262626] pt-4">
              <div className="text-[11px] font-mono text-[#999999] uppercase tracking-wider font-semibold">
                Tools & Normalization
              </div>

              {/* Sort Rows Select */}
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-[#666666] uppercase">Sort rows</label>
                <select
                  value={sortRows}
                  onChange={(e) => updateOption('sortRows', e.target.value)}
                  className="w-full bg-[#000000] border border-[#3a3a3a] px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-white"
                >
                  <option value="none">Original Order</option>
                  {headersA.map((header, idx) => (
                    <option key={idx} value={`col${idx}`}>
                      {header || `Column ${getColumnLetter(idx)}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Normalize Dates Buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    updateOption('normalizeDatesUS', !normalizeDatesUS);
                    if (!normalizeDatesUS) updateOption('normalizeDatesEU', false);
                  }}
                  className={`py-1.5 px-2 text-[11px] font-mono border text-center transition-all ${
                    normalizeDatesUS
                      ? 'border-[#5fa657] text-[#6ee7b7] bg-[#062c19]'
                      : 'border-[#3a3a3a] text-[#999999] hover:border-white hover:text-white'
                  }`}
                >
                  Dates (US)
                </button>
                <button
                  onClick={() => {
                    updateOption('normalizeDatesEU', !normalizeDatesEU);
                    if (!normalizeDatesEU) updateOption('normalizeDatesUS', false);
                  }}
                  className={`py-1.5 px-2 text-[11px] font-mono border text-center transition-all ${
                    normalizeDatesEU
                      ? 'border-[#5fa657] text-[#6ee7b7] bg-[#062c19]'
                      : 'border-[#3a3a3a] text-[#999999] hover:border-white hover:text-white'
                  }`}
                >
                  Dates (EU)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 📊 CENTER VIEWPORT: REDLINE SPREADSHEET TABLE GRID                          */}
        {/* ========================================================================= */}
        <div className={`${
          showLeftSidebar && showRightSidebar ? 'lg:col-span-6' :
          showLeftSidebar || showRightSidebar ? 'lg:col-span-9' : 'lg:col-span-12'
        } bg-[#0d0d0d] border border-[#262626] space-y-0 transition-all`}>
          
          {/* Table Header Controls */}
          <div className="bg-[#141414] px-4 py-2 border-b border-[#262626] flex items-center justify-between text-xs font-mono uppercase text-white select-none">
            <div className="flex items-center gap-4">
              <span className="font-bold text-[#c3d9f3]">{sheetName}</span>
              <span className="text-[10px] text-[#666666]">
                {displayRows.length} ROW(S) DISPLAYED
              </span>
            </div>
            {activeChange && (
              <div className="text-[11px] text-[#fcd34d] font-mono animate-pulse hidden sm:block">
                FOCUSED: CELL {activeChange.cellRef} (#{activeChange.id})
              </div>
            )}
          </div>

          {/* Interactive Redline Grid - Virtualized */}
          <SpreadsheetVirtualizedTable
            ref={virtualTableRef}
            rows={displayRows}
            columns={colsToRender.map(cIdx => ({ 
              key: cIdx, 
              minWidth: '120px',
              width: '120px'
            }))}
            rowHeight={32}
            headerHeight={36}
            firstColWidth={48}
            containerHeight={620}
            overscan={5}
            estimatedRowSize={() => 32}
            renderFirstColHeader={() => '1&nbsp;1'}
            onToggleCollapse={handleToggleCollapse}
            renderCollapsedRow={(row) => (
              <div className="flex items-center justify-center gap-2 py-1 text-[#c3d9f3] font-bold">
                <span>↕</span>
                <span>{row.count} UNCHANGED ROWS COLLAPSED</span>
                <span className="text-[10px] text-[#999999] font-normal">(Click row to expand)</span>
              </div>
            )}
            renderFirstColCell={(row) => (
              <>
                <span className="text-[#999999] mr-1">
                  {row.indexA !== null ? row.indexA + 1 : '-'}
                </span>
                <span>
                  {row.indexB !== null ? row.indexB + 1 : '-'}
                </span>
              </>
            )}
            renderHeader={(col, cIdx) => getColumnLetter(colsToRender[cIdx])}
            renderCell={(row, cIdx, rIdx) => {
              const actualColIdx = colsToRender[cIdx];
              const cellA = row.cellsA?.[actualColIdx] || { val: '' };
              const cellB = row.cellsB?.[actualColIdx] || { val: '' };
              const status = row.cellStatuses?.[actualColIdx] || 'SAME';
              const cellId = `cell-${rIdx}-${actualColIdx}`;
              const isCellFocused = activeChange && activeChange.rowIdx === rIdx && activeChange.colIdx === actualColIdx;

              return (
                <td
                  id={cellId}
                  onClick={() => handleCellClick(rIdx, actualColIdx, viewTab === 'original' ? cellA : cellB)}
                  className={`py-2 px-3 border-r border-[#262626] relative cursor-pointer font-mono whitespace-nowrap overflow-hidden text-ellipsis max-w-[220px] transition-all ${
                    isCellFocused ? 'ring-2 ring-[#fcd34d] z-10 shadow-lg' : ''
                  } ${getCellStyle(status, viewTab, preserveFormatting)}`}
                >
                  {viewTab === 'original' ? (
                    <span>{cellA.val || '-'}</span>
                  ) : viewTab === 'changed' ? (
                    <span>{cellB.val || '-'}</span>
                  ) : (
                    <RedlineCellContent
                      cellA={cellA}
                      cellB={cellB}
                      status={status}
                      granularity={diffGranularity}
                    />
                  )}
                </td>
              );
            }}
            getRowClassName={(row, rIdx) => {
              const isRowFocused = activeChange && activeChange.rowIdx === rIdx;
              return isRowFocused ? 'bg-[#1f1f1f]/80' : '';
            }}
          />
        </div>

        {/* ========================================================================= */}
        {/* 📋 RIGHT SIDEBAR: CHANGES AUDIT & NAVIGATION PANEL                        */}
        {/* ========================================================================= */}
        {showRightSidebar && (
          <div className="lg:col-span-3 bg-[#141414] border border-[#262626] p-4 space-y-4 select-none transition-all">
            
            {/* Panel Header & Summary Counters */}
            <div className="flex items-center justify-between border-b border-[#262626] pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-white font-bold uppercase tracking-wider">
                  Changes
                </span>
              </div>
              <button
                onClick={() => setShowRightSidebar(false)}
                className="text-[#666666] hover:text-white transition-colors"
                title="Collapse Sidebar"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Global Summary Stats Header Bar (- 89 | + 89 | ~ 1) */}
            <div className="flex items-center justify-between bg-[#000000] p-2 border border-[#262626] text-xs font-mono">
              <div className="flex items-center gap-3">
                <span className="text-[#fca5a5] font-bold" title="Deletions">
                  - {stats.totalDeleted || 0}
                </span>
                <span className="text-[#6ee7b7] font-bold" title="Additions">
                  + {stats.totalAdded || 0}
                </span>
                <span className="text-[#fcd34d] font-bold" title="Modifications">
                  ~ {stats.totalModified || 0}
                </span>
              </div>
              <div className="text-[10px] text-[#999999] font-bold">
                TOTAL: {changesList.length}
              </div>
            </div>

            {/* Navigation Controls (X of Y with Up/Down buttons) */}
            <div className="flex items-center justify-between bg-[#1f1f1f] p-2 border border-[#3a3a3a]">
              <span className="text-xs font-mono text-[#cccccc]">
                {changesList.length > 0 ? `${activeChangeIndex + 1} of ${changesList.length}` : '0 of 0'}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => jumpToChange(activeChangeIndex - 1)}
                  disabled={changesList.length === 0}
                  className="p-1 text-[#cccccc] hover:text-white border border-[#3a3a3a] hover:border-white disabled:opacity-30 rounded transition-colors"
                  title="Previous Change (Up Arrow)"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  onClick={() => jumpToChange(activeChangeIndex + 1)}
                  disabled={changesList.length === 0}
                  className="p-1 text-[#cccccc] hover:text-white border border-[#3a3a3a] hover:border-white disabled:opacity-30 rounded transition-colors"
                  title="Next Change (Down Arrow)"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Scrollable List of Change Cards */}
            <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1 scrollbar-thin">
              {changesList.length === 0 ? (
                <div className="text-center py-8 text-xs font-mono text-[#666666]">
                  No changes detected in current view.
                </div>
              ) : (
                changesList.map((item, idx) => {
                  const isActive = activeChangeIndex === idx;

                  return (
                    <div
                      key={item.id}
                      onClick={() => jumpToChange(idx)}
                      className={`p-3 border text-xs font-mono transition-all cursor-pointer space-y-1.5 ${
                        isActive
                          ? 'border-white bg-[#1f1f1f] shadow-md transform translate-x-0.5'
                          : 'border-[#262626] bg-[#0d0d0d] hover:border-[#3a3a3a] hover:bg-[#141414]'
                      }`}
                    >
                      {/* Card Header: Type Badge, Cell Ref, Card Number */}
                      <div className="flex items-center justify-between">
                        <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full ${
                          item.type === 'MODIFIED' ? 'bg-[#2d2208] text-[#fcd34d] border border-[#78350f]' :
                          item.type === 'ADDED' ? 'bg-[#062c19] text-[#6ee7b7] border border-[#047857]' :
                          item.type === 'DELETED' ? 'bg-[#3b1219] text-[#fca5a5] border border-[#b91c1c]' :
                          'bg-[#1e1b4b] text-[#a5b4fc] border border-[#4338ca]'
                        }`}>
                          {item.type}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{item.cellRef}</span>
                          <span className="text-[10px] text-[#666666]">#{item.id}</span>
                        </div>
                      </div>

                      {/* Card Body: Inline Diff Snippet */}
                      <div className="pt-1 text-[11px] leading-relaxed break-words font-mono">
                        <FormattedCardDiff item={item} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal: Appearance Options */}
      {showAppearanceModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#262626] p-6 max-w-md w-full space-y-4 select-none">
            <div className="flex justify-between items-center border-b border-[#262626] pb-3">
              <h3 className="text-title-sm text-white flex items-center gap-2">
                <Settings className="w-4 h-4 text-[#c3d9f3]" />
                APPEARANCE & THEME SETTINGS
              </h3>
              <button onClick={() => setShowAppearanceModal(false)} className="text-[#999999] hover:text-white">✕</button>
            </div>

            <div className="space-y-3">
              <div className="text-xs font-mono text-[#999999] uppercase">Grid Theme Preset</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setAppearanceTheme('dark')}
                  className={`p-3 border text-xs font-mono text-left ${
                    appearanceTheme === 'dark' ? 'border-white bg-[#1f1f1f] text-white' : 'border-[#262626] text-[#999999]'
                  }`}
                >
                  Sleek Dark Mode
                </button>
                <button
                  onClick={() => setAppearanceTheme('highContrast')}
                  className={`p-3 border text-xs font-mono text-left ${
                    appearanceTheme === 'highContrast' ? 'border-white bg-[#1f1f1f] text-white' : 'border-[#262626] text-[#999999]'
                  }`}
                >
                  High Contrast
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button onClick={() => setShowAppearanceModal(false)} className="btn-primary text-xs h-8 py-1 px-4">
                APPLY & CLOSE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Cell Annotation Note */}
      {showAnnotationModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#262626] p-6 max-w-md w-full space-y-4">
            <div className="flex justify-between items-center border-b border-[#262626] pb-3">
              <h3 className="text-title-sm text-white flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#c3d9f3]" />
                CELL ANNOTATION & AUDIT NOTE
              </h3>
              <button onClick={() => setShowAnnotationModal(false)} className="text-[#999999] hover:text-white">✕</button>
            </div>

            <div className="text-xs font-mono text-[#999999] space-y-1">
              <div>POSITION: Row {selectedCell?.rIdx + 1}, Col {getColumnLetter(selectedCell?.cIdx)}</div>
              <div>VALUE: <span className="text-white font-semibold">{selectedCell?.cell?.val || '(empty)'}</span></div>
            </div>

            <textarea
              rows={3}
              placeholder="Add your note or audit flag here..."
              value={annotationText}
              onChange={(e) => setAnnotationText(e.target.value)}
              className="w-full bg-[#000000] border border-[#3a3a3a] p-3 text-xs font-mono text-white placeholder-[#666666] focus:outline-none focus:border-white"
            />

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowAnnotationModal(false)} className="btn-secondary text-xs h-8 py-1 px-4">
                CANCEL
              </button>
              <button onClick={saveAnnotation} className="btn-primary text-xs h-8 py-1 px-4">
                SAVE NOTE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Toggle Row Component for Left Tools Sidebar
function ToggleRow({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between text-xs font-mono text-[#cccccc] cursor-pointer hover:text-white transition-colors">
      <span>{label}</span>
      <div className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div className="w-8 h-4 bg-[#262626] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[#5fa657]"></div>
      </div>
    </label>
  );
}

// Helper: Styling for table cells based on diff status
function getCellStyle(status, viewTab, preserveFormatting) {
  if (status === 'MODIFIED') return 'bg-[#2d2208]/90 text-[#fcd34d] border-[#78350f] font-medium';
  if (status === 'ADDED') return 'bg-[#062c19]/90 text-[#6ee7b7] border-[#047857] font-medium';
  if (status === 'DELETED') return 'bg-[#3b1219]/90 text-[#fca5a5] border-[#b91c1c] font-medium';
  if (status === 'FORMULA_CHANGED') return 'bg-[#1e1b4b]/90 text-[#a5b4fc] border-[#4338ca] font-medium';
  return 'bg-[#000000] text-[#cccccc] hover:bg-[#141414]';
}

// Helper: Render cell redline inline diff
function RedlineCellContent({ cellA, cellB, status, granularity }) {
  if (status === 'SAME') {
    return <span>{cellB.val || cellA.val || '-'}</span>;
  }
  if (status === 'ADDED') {
    return <span className="text-[#6ee7b7] underline">{cellB.val}</span>;
  }
  if (status === 'DELETED') {
    return <span className="line-through text-[#fca5a5]">{cellA.val}</span>;
  }
  
  // Modified cell inline rendering
  const valA = cellA.val || '';
  const valB = cellB.val || '';

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="line-through text-[#fca5a5] opacity-80">{valA}</span>
      <span className="text-[#6ee7b7] font-bold">{valB}</span>
    </div>
  );
}

// Helper: Formatted diff inside Right Sidebar Change Cards
function FormattedCardDiff({ item }) {
  const { charDiff, valA, valB, type } = item;

  if (type === 'ADDED') {
    return <span className="text-[#6ee7b7] font-bold">+{valB}</span>;
  }
  if (type === 'DELETED') {
    return <span className="line-through text-[#fca5a5]">{valA}</span>;
  }

  if (charDiff && charDiff.length > 0) {
    return (
      <div className="flex flex-wrap items-center gap-1">
        {charDiff.map((chunk, i) => {
          if (chunk.type === 'del') {
            return (
              <span key={i} className="line-through text-[#fca5a5] bg-[#3b1219] px-0.5 rounded">
                {chunk.text}
              </span>
            );
          }
          if (chunk.type === 'add') {
            return (
              <span key={i} className="text-[#6ee7b7] underline bg-[#062c19] px-0.5 rounded font-bold">
                {chunk.text}
              </span>
            );
          }
          return <span key={i} className="text-[#cccccc]">{chunk.text}</span>;
        })}
      </div>
    );
  }

  return (
    <div>
      <span className="line-through text-[#fca5a5] mr-2">{valA}</span>
      <span className="text-[#6ee7b7] font-bold">{valB}</span>
    </div>
  );
}
