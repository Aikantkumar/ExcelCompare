import React, { useState, useRef, useEffect } from 'react';
import { 
  Eye, 
  Layers, 
  GitCommit, 
  Search, 
  Download, 
  Share2, 
  MessageSquare, 
  Zap, 
  Sparkles, 
  Check, 
  Filter, 
  FileText,
  FileSpreadsheet,
  Settings
} from 'lucide-react';

export default function DiffViewer({ diffData, sheetName, onExport, onShare }) {
  const [viewMode, setViewMode] = useState('sideBySide'); // 'sideBySide' | 'overlay' | 'unified'
  const [filterMode, setFilterMode] = useState('ALL'); // 'ALL' | 'MODIFIED' | 'ADDED' | 'DELETED' | 'FORMULA'
  const [searchQuery, setSearchQuery] = useState('');
  const [showFormulas, setShowFormulas] = useState(false);
  const [annotations, setAnnotations] = useState({});
  const [selectedCell, setSelectedCell] = useState(null);
  const [annotationText, setAnnotationText] = useState('');
  const [showAnnotationModal, setShowAnnotationModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Sync scroll refs
  const leftTableRef = useRef(null);
  const rightTableRef = useRef(null);
  const isSyncingRef = useRef(false);

  const { rows = [], stats = {} } = diffData || {};

  // Synchronized Scrolling Logic
  const handleScroll = (source) => {
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

  // Filter rows based on search query & diff filter
  const filteredRows = rows.filter((row) => {
    // Diff mode filter
    if (filterMode === 'MODIFIED' && row.type !== 'MODIFIED') return false;
    if (filterMode === 'ADDED' && row.type !== 'ADDED') return false;
    if (filterMode === 'DELETED' && row.type !== 'DELETED') return false;
    if (filterMode === 'FORMULA') {
      const hasFormulaChange = row.cellStatuses?.includes('FORMULA_CHANGED');
      if (!hasFormulaChange) return false;
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchA = row.cellsA?.some((c) => String(c?.val || '').toLowerCase().includes(q));
      const matchB = row.cellsB?.some((c) => String(c?.val || '').toLowerCase().includes(q));
      if (!matchA && !matchB) return false;
    }

    return true;
  });

  const handleCellClick = (rIdx, cIdx, cell, side) => {
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

  const getCellBg = (status, side) => {
    if (status === 'MODIFIED') return 'bg-[#2d2208] text-[#fcd34d] border-[#78350f]';
    if (status === 'ADDED') return 'bg-[#062c19] text-[#6ee7b7] border-[#047857]';
    if (status === 'DELETED') return 'bg-[#3b1219] text-[#fca5a5] border-[#b91c1c]';
    if (status === 'FORMULA_CHANGED') return 'bg-[#1e1b4b] text-[#a5b4fc] border-[#4338ca]';
    return side === 'left' ? 'bg-[#000000] text-[#cccccc]' : 'bg-[#0d0d0d] text-[#cccccc]';
  };

  return (
    <div className="space-y-6">
      {/* Top Controls & Diff Summary Toolbar */}
      <div className="bg-[#141414] border border-[#262626] p-4 flex flex-wrap items-center justify-between gap-4">
        {/* Left: View Modes */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-[#999999] uppercase tracking-wider mr-2 hidden sm:inline">VIEW:</span>
          <button
            onClick={() => setViewMode('sideBySide')}
            className={`px-3 py-1.5 text-xs font-mono tracking-wider uppercase border rounded-full transition-all ${
              viewMode === 'sideBySide'
                ? 'border-white text-white bg-[#1f1f1f]'
                : 'border-[#3a3a3a] text-[#999999] hover:border-white hover:text-white'
            }`}
          >
            <Eye className="w-3.5 h-3.5 inline mr-1" />
            Side-by-Side
          </button>
          <button
            onClick={() => setViewMode('overlay')}
            className={`px-3 py-1.5 text-xs font-mono tracking-wider uppercase border rounded-full transition-all ${
              viewMode === 'overlay'
                ? 'border-white text-white bg-[#1f1f1f]'
                : 'border-[#3a3a3a] text-[#999999] hover:border-white hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5 inline mr-1" />
            Overlay
          </button>
          <button
            onClick={() => setViewMode('unified')}
            className={`px-3 py-1.5 text-xs font-mono tracking-wider uppercase border rounded-full transition-all ${
              viewMode === 'unified'
                ? 'border-white text-white bg-[#1f1f1f]'
                : 'border-[#3a3a3a] text-[#999999] hover:border-white hover:text-white'
            }`}
          >
            <GitCommit className="w-3.5 h-3.5 inline mr-1" />
            Unified Diff
          </button>
        </div>

        {/* Center: Formula Toggle & Filter */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFormulas(!showFormulas)}
            className={`px-3 py-1.5 text-xs font-mono tracking-wider uppercase border rounded-full transition-all ${
              showFormulas
                ? 'border-[#c3d9f3] text-[#c3d9f3] bg-[#1e1b4b]'
                : 'border-[#3a3a3a] text-[#999999] hover:border-[#c3d9f3] hover:text-[#c3d9f3]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 inline mr-1" />
            {showFormulas ? 'SHOW VALUES' : 'COMPARE FORMULAS'}
          </button>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#666666]" />
            <input
              type="text"
              placeholder="SEARCH CELLS..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[#000000] border border-[#3a3a3a] pl-8 pr-3 py-1 text-xs font-mono text-white placeholder-[#666666] focus:outline-none focus:border-white w-36 sm:w-48"
            />
          </div>
        </div>

        {/* Right: Export & Share Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onExport}
            className="btn-primary py-1.5 px-4 text-xs h-8 tracking-[1.5px]"
          >
            <Download className="w-3.5 h-3.5 inline mr-1" />
            EXPORT DIFF
          </button>
          <button
            onClick={() => {
              if (onShare) onShare();
              setCopiedLink(true);
              setTimeout(() => setCopiedLink(false), 2000);
            }}
            className="btn-secondary py-1.5 px-3 text-xs h-8 tracking-[1.5px]"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 inline mr-1 text-[#5fa657]" /> : <Share2 className="w-3.5 h-3.5 inline mr-1" />}
            {copiedLink ? 'COPIED!' : 'SHARE'}
          </button>
        </div>
      </div>

      {/* Summary Stat Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <button
          onClick={() => setFilterMode('ALL')}
          className={`p-3 border text-left transition-colors ${
            filterMode === 'ALL' ? 'border-white bg-[#1f1f1f]' : 'border-[#262626] bg-[#0d0d0d]'
          }`}
        >
          <div className="text-[10px] font-mono text-[#999999] uppercase">TOTAL ROWS</div>
          <div className="text-xl font-display text-white">{stats.totalRows || 0}</div>
        </button>

        <button
          onClick={() => setFilterMode('MODIFIED')}
          className={`p-3 border text-left transition-colors ${
            filterMode === 'MODIFIED' ? 'border-[#fcd34d] bg-[#2d2208]' : 'border-[#262626] bg-[#0d0d0d]'
          }`}
        >
          <div className="text-[10px] font-mono text-[#fcd34d] uppercase">MODIFIED CELLS</div>
          <div className="text-xl font-display text-[#fcd34d]">{stats.totalModified || 0}</div>
        </button>

        <button
          onClick={() => setFilterMode('ADDED')}
          className={`p-3 border text-left transition-colors ${
            filterMode === 'ADDED' ? 'border-[#6ee7b7] bg-[#062c19]' : 'border-[#262626] bg-[#0d0d0d]'
          }`}
        >
          <div className="text-[10px] font-mono text-[#6ee7b7] uppercase">ADDED ROWS</div>
          <div className="text-xl font-display text-[#6ee7b7]">{stats.totalAdded || 0}</div>
        </button>

        <button
          onClick={() => setFilterMode('DELETED')}
          className={`p-3 border text-left transition-colors ${
            filterMode === 'DELETED' ? 'border-[#fca5a5] bg-[#3b1219]' : 'border-[#262626] bg-[#0d0d0d]'
          }`}
        >
          <div className="text-[10px] font-mono text-[#fca5a5] uppercase">DELETED ROWS</div>
          <div className="text-xl font-display text-[#fca5a5]">{stats.totalDeleted || 0}</div>
        </button>

        <button
          onClick={() => setFilterMode('FORMULA')}
          className={`p-3 border text-left transition-colors ${
            filterMode === 'FORMULA' ? 'border-[#a5b4fc] bg-[#1e1b4b]' : 'border-[#262626] bg-[#0d0d0d]'
          }`}
        >
          <div className="text-[10px] font-mono text-[#a5b4fc] uppercase">FORMULA CHANGES</div>
          <div className="text-xl font-display text-[#a5b4fc]">{stats.totalFormulaChanges || 0}</div>
        </button>
      </div>

      {/* Main Diff Display Area */}
      {viewMode === 'sideBySide' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left File Grid */}
          <div className="border border-[#262626] bg-[#0d0d0d]">
            <div className="bg-[#141414] px-4 py-2 border-b border-[#262626] flex items-center justify-between text-xs font-mono uppercase tracking-wider text-white">
              <span>LEFT FILE (ORIGINAL / SHEET: {sheetName})</span>
              <span className="text-[#999999] text-[10px]">SYNC SCROLL ENABLED</span>
            </div>
            <div
              ref={leftTableRef}
              onScroll={() => handleScroll('left')}
              className="overflow-auto max-h-[550px] scrollbar-thin"
            >
              <table className="w-full text-xs font-mono border-collapse">
                <thead>
                  <tr className="bg-[#000000] border-b border-[#262626] text-[#999999]">
                    <th className="w-10 py-2 px-2 border-r border-[#262626] text-center font-normal">#</th>
                    {Array.from({ length: stats.maxCols || 1 }).map((_, cIdx) => (
                      <th key={cIdx} className="py-2 px-3 border-r border-[#262626] text-left font-normal uppercase">
                        COL {String.fromCharCode(65 + cIdx)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row, rIdx) => (
                    <tr key={rIdx} className="border-b border-[#262626]/50 hover:bg-[#1f1f1f]/50">
                      <td className="py-2 px-2 border-r border-[#262626] text-center text-[#666666] select-none">
                        {row.indexA !== null ? row.indexA + 1 : '-'}
                      </td>
                      {row.cellsA.map((cell, cIdx) => {
                        const status = row.cellStatuses?.[cIdx] || 'SAME';
                        const cellBg = getCellBg(status, 'left');
                        const key = `${rIdx}_${cIdx}_left`;
                        const hasNote = annotations[key];

                        return (
                          <td
                            key={cIdx}
                            onClick={() => handleCellClick(rIdx, cIdx, cell, 'left')}
                            className={`py-2 px-3 border-r border-[#262626] relative cursor-pointer font-mono whitespace-nowrap overflow-hidden text-ellipsis max-w-[180px] ${cellBg}`}
                          >
                            {showFormulas && cell.formula ? (
                              <span className="font-semibold">{cell.formula}</span>
                            ) : (
                              cell.val || '-'
                            )}
                            {hasNote && (
                              <span className="absolute top-0 right-0 w-2 h-2 bg-[#c3d9f3]" title={hasNote} />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right File Grid */}
          <div className="border border-[#262626] bg-[#0d0d0d]">
            <div className="bg-[#141414] px-4 py-2 border-b border-[#262626] flex items-center justify-between text-xs font-mono uppercase tracking-wider text-white">
              <span>RIGHT FILE (MODIFIED / SHEET: {sheetName})</span>
              <span className="text-[#999999] text-[10px]">SYNC SCROLL ENABLED</span>
            </div>
            <div
              ref={rightTableRef}
              onScroll={() => handleScroll('right')}
              className="overflow-auto max-h-[550px] scrollbar-thin"
            >
              <table className="w-full text-xs font-mono border-collapse">
                <thead>
                  <tr className="bg-[#000000] border-b border-[#262626] text-[#999999]">
                    <th className="w-10 py-2 px-2 border-r border-[#262626] text-center font-normal">#</th>
                    {Array.from({ length: stats.maxCols || 1 }).map((_, cIdx) => (
                      <th key={cIdx} className="py-2 px-3 border-r border-[#262626] text-left font-normal uppercase">
                        COL {String.fromCharCode(65 + cIdx)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row, rIdx) => (
                    <tr key={rIdx} className="border-b border-[#262626]/50 hover:bg-[#1f1f1f]/50">
                      <td className="py-2 px-2 border-r border-[#262626] text-center text-[#666666] select-none">
                        {row.indexB !== null ? row.indexB + 1 : '-'}
                      </td>
                      {row.cellsB.map((cell, cIdx) => {
                        const status = row.cellStatuses?.[cIdx] || 'SAME';
                        const cellBg = getCellBg(status, 'right');
                        const key = `${rIdx}_${cIdx}_right`;
                        const hasNote = annotations[key];

                        return (
                          <td
                            key={cIdx}
                            onClick={() => handleCellClick(rIdx, cIdx, cell, 'right')}
                            className={`py-2 px-3 border-r border-[#262626] relative cursor-pointer font-mono whitespace-nowrap overflow-hidden text-ellipsis max-w-[180px] ${cellBg}`}
                          >
                            {showFormulas && cell.formula ? (
                              <span className="font-semibold">{cell.formula}</span>
                            ) : (
                              cell.val || '-'
                            )}
                            {hasNote && (
                              <span className="absolute top-0 right-0 w-2 h-2 bg-[#c3d9f3]" title={hasNote} />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Overlay View Mode */}
      {viewMode === 'overlay' && (
        <div className="border border-[#262626] bg-[#0d0d0d] overflow-x-auto">
          <div className="bg-[#141414] px-4 py-2 border-b border-[#262626] text-xs font-mono uppercase tracking-wider text-white">
            OVERLAY COMPARISON MODE (BEFORE → AFTER CELL VALUES)
          </div>
          <table className="w-full text-xs font-mono border-collapse">
            <thead>
              <tr className="bg-[#000000] border-b border-[#262626] text-[#999999]">
                <th className="w-12 py-2 px-2 border-r border-[#262626] text-center font-normal">L / R</th>
                {Array.from({ length: stats.maxCols || 1 }).map((_, cIdx) => (
                  <th key={cIdx} className="py-2 px-3 border-r border-[#262626] text-left font-normal uppercase">
                    COL {String.fromCharCode(65 + cIdx)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, rIdx) => (
                <tr key={rIdx} className="border-b border-[#262626]/50">
                  <td className="py-2 px-2 border-r border-[#262626] text-center text-[#666666]">
                    {row.indexA !== null ? row.indexA + 1 : '-'}/{row.indexB !== null ? row.indexB + 1 : '-'}
                  </td>
                  {row.cellsB.map((cellB, cIdx) => {
                    const cellA = row.cellsA[cIdx] || { val: '' };
                    const status = row.cellStatuses?.[cIdx] || 'SAME';
                    const isMod = status === 'MODIFIED' || status === 'FORMULA_CHANGED';

                    return (
                      <td key={cIdx} className={`py-2 px-3 border-r border-[#262626] ${getCellBg(status, 'left')}`}>
                        {isMod ? (
                          <div>
                            <span className="line-through text-[#fca5a5] mr-2">{cellA.val || 'empty'}</span>
                            <span className="text-[#6ee7b7] font-bold">→ {cellB.val || 'empty'}</span>
                          </div>
                        ) : (
                          cellB.val || '-'
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Unified Diff View Mode */}
      {viewMode === 'unified' && (
        <div className="border border-[#262626] bg-[#0d0d0d] font-mono text-xs p-4 space-y-1">
          <div className="text-[#999999] border-b border-[#262626] pb-2 mb-2">
            --- LEFT FILE: {sheetName}<br />
            +++ RIGHT FILE: {sheetName}
          </div>
          {filteredRows.map((row, rIdx) => {
            if (row.type === 'DELETED') {
              return (
                <div key={rIdx} className="bg-[#3b1219] text-[#fca5a5] p-1 border-l-2 border-[#b91c1c]">
                  - Row {row.indexA + 1}: {row.cellsA.map((c) => c.val).join(' | ')}
                </div>
              );
            }
            if (row.type === 'ADDED') {
              return (
                <div key={rIdx} className="bg-[#062c19] text-[#6ee7b7] p-1 border-l-2 border-[#047857]">
                  + Row {row.indexB + 1}: {row.cellsB.map((c) => c.val).join(' | ')}
                </div>
              );
            }
            if (row.type === 'MODIFIED') {
              return (
                <div key={rIdx} className="bg-[#2d2208] text-[#fcd34d] p-1 border-l-2 border-[#78350f]">
                  ~ Row {row.indexA + 1} → {row.indexB + 1}:<br />
                  &nbsp;&nbsp;L: {row.cellsA.map((c) => c.val).join(' | ')}<br />
                  &nbsp;&nbsp;R: {row.cellsB.map((c) => c.val).join(' | ')}
                </div>
              );
            }
            return (
              <div key={rIdx} className="text-[#666666] p-0.5">
                &nbsp; Row {row.indexA + 1}: {row.cellsA.map((c) => c.val).join(' | ')}
              </div>
            );
          })}
        </div>
      )}

      {/* Annotation Cell Modal */}
      {showAnnotationModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#262626] p-6 max-w-md w-full space-y-4">
            <div className="flex justify-between items-center border-b border-[#262626] pb-3">
              <h3 className="text-title-sm text-white flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#c3d9f3]" />
                CELL ANNOTATION & NOTE
              </h3>
              <button onClick={() => setShowAnnotationModal(false)} className="text-[#999999] hover:text-white">✕</button>
            </div>

            <div className="text-xs font-mono text-[#999999] space-y-1">
              <div>POSITION: Row {selectedCell?.rIdx + 1}, Col {String.fromCharCode(65 + selectedCell?.cIdx)}</div>
              <div>SIDE: {selectedCell?.side?.toUpperCase()}</div>
              <div>VALUE: <span className="text-white font-semibold">{selectedCell?.cell?.val || '(empty)'}</span></div>
              {selectedCell?.cell?.formula && (
                <div>FORMULA: <span className="text-[#a5b4fc]">{selectedCell?.cell?.formula}</span></div>
              )}
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
