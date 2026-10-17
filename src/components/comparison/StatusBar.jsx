import React, { useMemo } from 'react';

export default function StatusBar({
  status = 'READY',
  fileAName,
  sheetAName,
  fileBName,
  sheetBName,
  displayedCount,
  totalCount,
  isComparing = false,
}) {
  const statusText = useMemo(() => {
    if (isComparing) return 'COMPARING…';
    if (status) return status;
    return 'READY';
  }, [status, isComparing]);

  const file1Text = fileAName ? `FILE 1: ${fileAName}${sheetAName ? ` [${sheetAName}]` : ''}` : 'FILE 1: —';
  const file2Text = fileBName ? `FILE 2: ${fileBName}${sheetBName ? ` [${sheetBName}]` : ''}` : 'FILE 2: —';

  let countText = 'TOTAL DISPLAYED ITEMS: 0';
  if (displayedCount != null && totalCount != null) {
    countText = `TOTAL DISPLAYED ITEMS: ${displayedCount} (OF ${totalCount})`;
  } else if (displayedCount != null) {
    countText = `TOTAL DISPLAYED ITEMS: ${displayedCount}`;
  }

  return (
    <div className="bg-[#0d0d0d] border-t border-[#262626] px-3 py-1.5 shrink-0">
      <div className="flex items-center gap-4 text-[10px] font-mono text-[#999999] uppercase tracking-wider">
        <span className={isComparing ? 'text-[#fcd34d] animate-pulse' : 'text-[#6ee7b7]'}>{statusText}</span>
        <span className="w-px h-3 bg-[#262626" />
        <span>{file1Text}</span>
        <span className="w-px h-3 bg-[#262626" />
        <span>{file2Text}</span>
        <span className="w-px h-3 bg-[#262626" />
        <span className="text-[#c3d9f3] font-bold tabular-nums ml-auto">{countText}</span>
      </div>
    </div>
  );
}