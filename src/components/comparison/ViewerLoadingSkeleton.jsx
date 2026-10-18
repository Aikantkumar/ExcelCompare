import React from 'react';

export default function ViewerLoadingSkeleton() {
  return (
    <div className="space-y-4" style={{ minHeight: '500px' }}>
      {/* Toolbar skeleton */}
      <div className="bg-surface-card border border-hairline p-3 animate-pulse">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-24 h-8 bg-hairline rounded" />
            <div className="w-20 h-8 bg-hairline rounded" />
            <div className="w-24 h-8 bg-hairline rounded" />
          </div>
          <div className="w-40 h-8 bg-hairline rounded" />
          <div className="flex items-center gap-2">
            <div className="w-16 h-8 bg-hairline rounded" />
            <div className="w-16 h-8 bg-hairline rounded" />
            <div className="w-16 h-8 bg-hairline rounded" />
          </div>
        </div>
      </div>

      {/* Main grid skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left sidebar skeleton */}
        <div className="lg:col-span-3 bg-surface-card border border-hairline p-4 space-y-6 animate-pulse">
          <div className="flex items-center justify-between border-b border-hairline pb-3">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-hairline rounded" />
              <div className="w-32 h-4 bg-hairline rounded" />
            </div>
            <div className="w-4 h-4 bg-hairline rounded" />
          </div>
          <div className="space-y-3">
            <div className="w-24 h-3 bg-hairline rounded" />
            <div className="grid grid-cols-2 gap-1">
              <div className="h-8 bg-hairline rounded" />
              <div className="h-8 bg-hairline rounded" />
            </div>
            <div className="grid grid-cols-3 gap-1">
              <div className="h-8 bg-hairline rounded" />
              <div className="h-8 bg-hairline rounded" />
              <div className="h-8 bg-hairline rounded" />
            </div>
          </div>
          <div className="space-y-3 border-t border-hairline pt-4">
            <div className="h-6 bg-hairline rounded" />
            <div className="h-6 bg-hairline rounded" />
            <div className="h-6 bg-hairline rounded" />
            <div className="h-6 bg-hairline rounded" />
            <div className="h-6 bg-hairline rounded" />
            <div className="h-6 bg-hairline rounded" />
          </div>
          <div className="space-y-3 border-t border-hairline pt-4">
            <div className="w-24 h-3 bg-hairline rounded" />
            <div className="h-8 bg-hairline rounded" />
            <div className="h-10 bg-hairline rounded" />
          </div>
          <div className="space-y-3 border-t border-hairline pt-4">
            <div className="w-24 h-3 bg-hairline rounded" />
            <div className="h-6 bg-hairline rounded" />
            <div className="grid grid-cols-2 gap-2">
              <div className="h-8 bg-hairline rounded" />
              <div className="h-8 bg-hairline rounded" />
            </div>
          </div>
        </div>

        {/* Center viewport skeleton */}
        <div className="lg:col-span-6 bg-surface-soft border border-hairline space-y-0 animate-pulse">
          <div className="bg-surface-card px-4 py-2 border-b border-hairline">
            <div className="flex items-center gap-4">
              <div className="w-24 h-4 bg-hairline rounded" />
              <div className="w-32 h-3 bg-hairline rounded" />
            </div>
          </div>
          <div className="p-4 h-[620px] bg-surface-soft">
            <table className="w-full border-collapse text-xs font-mono">
              <thead>
                <tr className="text-muted">
                  <th className="py-2 px-3 border-r border-hairline text-left font-semibold text-ink uppercase min-w-[120px] sticky top-0 bg-canvas z-10" style={{ width: '48px' }}></th>
                  {Array.from({ length: 10 }).map((_, i) => (
                    <th key={i} className="py-2 px-3 border-r border-hairline text-left font-semibold text-ink uppercase min-w-[120px] sticky top-0 bg-canvas z-10">
                      <div className="w-16 h-3 bg-hairline rounded" />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 20 }).map((_, rowIdx) => (
                  <tr key={rowIdx} className="border-b border-hairline/60 hover:bg-surface-hover/50">
                    <td className="py-2 px-2 border-r border-hairline text-center text-muted-soft select-none text-[10px] font-mono bg-surface-gutter sticky left-0 z-20" style={{ width: '48px' }}>
                      <div className="w-6 h-3 bg-hairline rounded mx-auto" />
                    </td>
                    {Array.from({ length: 10 }).map((_, colIdx) => (
                      <td key={colIdx} className="py-2 px-3 border-r border-hairline relative cursor-pointer font-mono whitespace-nowrap overflow-hidden text-ellipsis max-w-[220px]">
                        <div className="h-4 w-full bg-hairline rounded" />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right sidebar skeleton */}
        <div className="lg:col-span-3 bg-surface-card border border-hairline p-4 space-y-4 animate-pulse">
          <div className="flex items-center justify-between border-b border-hairline pb-3">
            <div className="flex items-center gap-2">
              <div className="w-20 h-4 bg-hairline rounded" />
            </div>
            <div className="w-4 h-4 bg-hairline rounded" />
          </div>
          <div className="flex items-center justify-between bg-canvas p-2 border border-hairline">
            <div className="flex items-center gap-3">
              <div className="w-16 h-4 bg-hairline rounded" />
              <div className="w-16 h-4 bg-hairline rounded" />
              <div className="w-16 h-4 bg-hairline rounded" />
            </div>
            <div className="w-20 h-3 bg-hairline rounded" />
          </div>
          <div className="flex items-center justify-between bg-surface-elevated p-2 border border-hairline-strong">
            <div className="w-24 h-3 bg-hairline rounded" />
            <div className="flex items-center gap-1">
              <div className="w-6 h-6 bg-hairline rounded" />
              <div className="w-6 h-6 bg-hairline rounded" />
            </div>
          </div>
          <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="p-3 border text-xs font-mono space-y-1.5 bg-surface-soft border-hairline">
                <div className="flex items-center justify-between">
                  <div className="w-16 h-4 bg-hairline rounded-full" />
                  <div className="flex items-center gap-2">
                    <div className="w-12 h-3 bg-hairline rounded" />
                    <div className="w-8 h-3 bg-hairline rounded" />
                  </div>
                </div>
                <div className="pt-1">
                  <div className="w-full h-3 bg-hairline rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}