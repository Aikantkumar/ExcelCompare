import React, { useMemo } from 'react';

const HISTOGRAM_HEIGHT = 56;
const BIN_CAPTION_HEIGHT = 14;

export default function ChangeHistogram({
  items,
  total,
  bins = 40,
  onBinClick,
  caption = 'CHANGES BY ROW',
  categoryColors,
}) {
  const histogramData = useMemo(() => {
    if (!items.length || !total) {
      return { binData: [], maxBinCount: 0, binSize: 0 };
    }

    const rowItems = items.filter(item => item.rowIdx != null && item.rowIdx >= 0);
    if (!rowItems.length) {
      return { binData: [], maxBinCount: 0, binSize: 0 };
    }

    const minRow = Math.min(...rowItems.map(i => i.rowIdx));
    const maxRow = Math.max(...rowItems.map(i => i.rowIdx));
    const rowRange = maxRow - minRow + 1;

    const binSize = Math.max(1, Math.ceil(rowRange / bins));
    const actualBins = Math.ceil(rowRange / binSize);

    const binData = Array.from({ length: actualBins }, (_, binIdx) => {
      const binStart = minRow + binIdx * binSize;
      const binEnd = binStart + binSize - 1;

      const binItems = rowItems.filter(item => item.rowIdx >= binStart && item.rowIdx <= binEnd);
      const categories = {};

      binItems.forEach(item => {
        const cat = item.category || 'UNKNOWN';
        categories[cat] = (categories[cat] || 0) + 1;
      });

      return {
        binIdx,
        binStart,
        binEnd,
        total: binItems.length,
        categories,
      };
    }).filter(b => b.total > 0);

    const maxBinCount = Math.max(...binData.map(b => b.total), 1);

    return { binData, maxBinCount, binSize };
  }, [items, total, bins]);

  const { binData, maxBinCount, binSize } = histogramData;

  if (!binData.length) {
    return (
      <div className="h-[56px] bg-[#0d0d0d] border border-[#262626] flex items-center justify-center">
        <span className="text-[10px] font-mono text-[#666666] uppercase tracking-wider">{caption}</span>
      </div>
    );
  }

  const barWidth = Math.max(2, Math.floor((100 / binData.length) * 0.85));
  const gapWidth = (100 - barWidth * binData.length) / (binData.length + 1);

  return (
    <div className="bg-[#0d0d0d] border border-[#262626] p-2">
      <div className="text-[10px] font-mono text-[#999999] uppercase tracking-wider mb-2">{caption}</div>
      <div className="relative h-[42px]" style={{ position: 'relative' }}>
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 100 ${HISTOGRAM_HEIGHT - BIN_CAPTION_HEIGHT}`}
          style={{ cursor: 'pointer' }}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
            let accumulated = 0;
            for (let i = 0; i < binData.length; i++) {
              accumulated += gapWidth;
              if (xPercent >= accumulated && xPercent <= accumulated + barWidth) {
                onBinClick?.(binData[i].binStart);
                break;
              }
              accumulated += barWidth;
            }
          }}
        >
          <line
            x1="0"
            y1={HISTOGRAM_HEIGHT - BIN_CAPTION_HEIGHT - 1}
            x2="100"
            y2={HISTOGRAM_HEIGHT - BIN_CAPTION_HEIGHT - 1}
            stroke="#262626"
            strokeWidth="0.5"
          />
          {binData.map((bin, idx) => {
            const x = idx * (barWidth + gapWidth) + gapWidth;
            let yOffset = 0;

            return (
              <g key={idx}>
                {Object.entries(bin.categories).map(([cat, count]) => {
                  const height = (count / maxBinCount) * (HISTOGRAM_HEIGHT - BIN_CAPTION_HEIGHT - 2);
                  const y = HISTOGRAM_HEIGHT - BIN_CAPTION_HEIGHT - 2 - yOffset - height;
                  const color = categoryColors?.[cat] || '#999999';
                  const pattern = (cat === 'SYSGEN_FORMULA' || cat === 'SYSGEN_NAMES') ? 'dashed' : 'solid';

                  yOffset += height;

                  return (
                    <rect
                      key={cat}
                      x={x}
                      y={y}
                      width={barWidth}
                      height={height}
                      fill={color}
                      opacity={pattern === 'dashed' ? 0.55 : 1}
                      style={pattern === 'dashed' ? { stroke: color, strokeWidth: 0.5, strokeDasharray: '2,2' } : {}}
                    />
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}