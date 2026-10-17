import React, { useRef, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const TAB_MIN_WIDTH = 120;
const TAB_MAX_WIDTH = 200;
const TAB_HEIGHT = 28;

export default function SheetTabs({
  sheets,
  activeSheet,
  onSheetChange,
  changeCounts,
  linkSheets,
  otherSheets,
  otherActiveSheet,
  onLinkSheetsChange,
  side,
}) {
  const containerRef = useRef(null);
  const [scrollX, setScrollX] = React.useState(0);
  const [showLeftArrow, setShowLeftArrow] = React.useState(false);
  const [showRightArrow, setShowRightArrow] = React.useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const updateArrows = () => {
      setShowLeftArrow(container.scrollLeft > 4);
      setShowRightArrow(container.scrollLeft + container.clientWidth < container.scrollWidth - 4);
    };
    updateArrows();
    const ro = new ResizeObserver(updateArrows);
    ro.observe(container);
    container.addEventListener('scroll', updateArrows);
    return () => {
      ro.disconnect();
      container.removeEventListener('scroll', updateArrows);
    };
  }, []);

  const handleScroll = (direction) => {
    const container = containerRef.current;
    if (!container) return;
    const scrollAmount = 200;
    container.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
  };

  const handleTabClick = (sheetName) => {
    onSheetChange(sheetName);
    if (linkSheets && otherSheets && otherActiveSheet) {
      const match = otherSheets.find(s => s === sheetName);
      if (match) {
        // The container will handle the other side's sheet change via its own handler
      }
    }
  };

  const tabStyle = (sheet) => {
    const count = changeCounts?.[sheet] || 0;
    const isHidden = sheet.startsWith('HIDDEN:');
    const displayName = isHidden ? sheet.replace('HIDDEN:', '') : sheet;
    const isActive = activeSheet === sheet;

    return {
      displayName,
      isHidden,
      isActive,
      count,
    };
  };

  const tabs = useMemo(() => sheets.map(s => tabStyle(s)), [sheets, activeSheet, changeCounts]);

  return (
    <div className="bg-[#141414] border-t border-[#262626] shrink-0 relative">
      <div className="flex items-center gap-1 px-2 h-[28px] bg-[#141414] border-b border-[#262626]">
        {linkSheets && otherSheets && otherSheets.length > 1 && (
          <label className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-mono text-[#999999] cursor-pointer hover:text-white shrink-0 border-r border-[#262626]">
            <input
              type="checkbox"
              checked={linkSheets}
              onChange={(e) => onLinkSheetsChange(e.target.checked)}
              className="w-3 h-3 accent-[#5fa657]"
            />
            LINK SHEETS
          </label>
        )}

        <button
          onClick={() => handleScroll('left')}
          disabled={!showLeftArrow}
          className={`p-1 text-[#999999] hover:text-white disabled:opacity-30 shrink-0 transition-colors ${showLeftArrow ? '' : 'invisible'}`}
          aria-label="Scroll tabs left"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div
          ref={containerRef}
          className="flex overflow-x-auto scrollbar-hide -ml-2"
          style={{ scrollPaddingLeft: showLeftArrow ? '28px' : 0 }}
        >
          <div className="flex gap-1 px-2" style={{ minWidth: 'max-content' }}>
            {tabs.map((tab) => (
              <button
                key={tab.displayName}
                onClick={() => handleTabClick(tab.displayName)}
                className={`flex items-center gap-1.5 px-3 py-1 text-[11px] font-mono uppercase tracking-wider border border-[#262626] rounded-t-none transition-all shrink-0 whitespace-nowrap ${
                  tab.isActive
                    ? 'border-b-white bg-[#1f1f1f] text-white font-bold z-10 relative'
                    : 'border-b-transparent bg-[#141414] text-[#cccccc] hover:text-white hover:border-white'
                }`}
                style={{ minWidth: TAB_MIN_WIDTH, maxWidth: TAB_MAX_WIDTH, height: TAB_HEIGHT }}
              >
                {tab.isHidden && (
                  <span className="text-[9px] font-mono text-[#666666] bg-[#262626] px-1 rounded">HIDDEN</span>
                )}
                <span className="truncate">{tab.displayName}</span>
                {tab.count > 0 && (
                  <span className="text-[10px] font-mono tabular-nums px-1.5 py-0.5 bg-[#262626] rounded-full"
                    style={{ backgroundColor: tab.isActive ? '#0d0d0d' : '#262626' }}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => handleScroll('right')}
          disabled={!showRightArrow}
          className={`p-1 text-[#999999] hover:text-white disabled:opacity-30 shrink-0 transition-colors ${showRightArrow ? '' : 'invisible'}`}
          aria-label="Scroll tabs right"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}