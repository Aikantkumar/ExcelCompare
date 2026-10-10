import React from 'react';

export default function ViewerLoadingSkeleton() {
  return (
    <div className="space-y-4" style={{ minHeight: '500px' }}>
      {/* Toolbar skeleton */}
      <div className="bg-[#141414] border border-[#262626] p-3 animate-pulse">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-24 h-8 bg-[#262626] rounded" />
            <div className="w-20 h-8 bg-[#262626] rounded" />
            <div className="w-24 h-8 bg-[#262626] rounded" />
          </div>
          <div className="w-40 h-8 bg-[#262626] rounded" />
          <div className="flex items-center gap-2">
            <div className="w-16 h-8 bg-[#262626] rounded" />
            <div className="w-16 h-8 bg-[#262626] rounded" />
            <div className="w-16 h-8 bg-[#262626] rounded" />
          </div>
        </div>
      </div>

      {/* Main grid skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left sidebar skeleton */}
        <div className="lg:col-span-3 bg-[#141414] border border-[#262626] p-4 space-y-6 animate-pulse">
          <div className="flex items-center justify-between border-b border-[#262626] pb-3">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-[#262626] rounded" />
              <div className="w-32 h-4 bg-[#262626] rounded" />
            </div>
            <div className="w-4 h-4 bg-[#262626] rounded" />
          </div>
          <div className="space-y-3">
            <div className="w-24 h-3 bg-[#262626] rounded" />
            <div className="grid grid-cols-2 gap-1">
              <div className="h-8 bg-[#262626] rounded" />
              <div className="h-8 bg-[#262626] rounded" />
            </div>
            <div className="grid grid-cols-3 gap-1">
              <div className="h-8 bg-[#262626] rounded" />
              <div className="h-8 bg-[#262626] rounded" />
              <div className="h-8 bg-[#262626] rounded" />
            </div>
          </div>
          <div className="space-y-3 border-t border-[#262626] pt-4">
            <div className="h-6 bg-[#262626] rounded" />
            <div className="h-6 bg-[#262626] rounded" />
            <div className="h-6 bg-[#262626] rounded" />
            <div className="h-6 bg-[#262626] rounded" />
            <div className="h-6 bg-[#262626] rounded" />
            <div className="h-6 bg-[#262626] rounded" />
          </div>
          <div className="space-y-3 border-t border-[#262626] pt-4">
            <div className="w-24 h-3 bg-[#262626] rounded" />
            <div className="h-8 bg-[#262626] rounded" />
            <div className="h-10 bg-[#262626] rounded" />
          </div>
          <div className="space-y-3 border-t border-[#262626] pt-4">
            <div className="w-24 h-3 bg-[#262626] rounded" />
            <div className="h-6 bg-[#262626] rounded" />
            <div className="grid grid-cols-2 gap-2">
              <div className="h-8 bg-[#262626] rounded" />
              <div className="h-8 bg-[#262626] rounded" />
            </div>
          </div>
        </div>

        {/* Center viewport skeleton */}
        <div className="lg:col-span-6 bg-[#0d0d0d] border border-[#262626] space-y-0 animate-pulse">
          <div className="bg-[#141414] px-4 py-2 border-b border-[#262626]">
            <div className="flex items-center gap-4">
              <div className="w-24 h-4 bg-[#262626] rounded" />
              <div className="w-32 h-3 bg-[#262626] rounded" />
            </div>
          </div>
          <div className="p-4 h-[620px] bg-[#0d0d0d]">
            <table className="w-full border-collapse text-xs font-mono">
              <thead>
                <tr className="text-[#999999]">
                  <th className="py-2 px-3 border-r border-[#262626] text-left font-semibold text-white uppercase min-w-[120px] sticky top-0 bg-[#000000] z-10" style={{ width: '48px' }}></th>
                  {Array.from({ length: 10 }).map((_, i) => (
                    <th key={i} className="py-2 px-3 border-r border-[#262626] text-left font-semibold text-white uppercase min-w-[120px] sticky top-0 bg-[#000000] z-10">
                      <div className="w-16 h-3 bg-[#262626] rounded" />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 20 }).map((_, rowIdx) => (
                  <tr key={rowIdx} className="border-b border-[#262626]/60 hover:bg-[#1a1a1a]/50">
                    <td className="py-2 px-2 border-r border-[#262626] text-center text-[#666666] select-none text-[10px] font-mono bg-[#050505] sticky left-0 z-20" style={{ width: '48px' }}>
                      <div className="w-6 h-3 bg-[#262626] rounded mx-auto" />
                    </td>
                    {Array.from({ length: 10 }).map((_, colIdx) => (
                      <td key={colIdx} className="py-2 px-3 border-r border-[#262626] relative cursor-pointer font-mono whitespace-nowrap overflow-hidden text-ellipsis max-w-[220px]">
                        <div className="h-4 w-full bg-[#262626] rounded" />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right sidebar skeleton */}
        <div className="lg:col-span-3 bg-[#141414] border border-[#262626] p-4 space-y-4 animate-pulse">
          <div className="flex items-center justify-between border-b border-[#262626] pb-3">
            <div className="flex items-center gap-2">
              <div className="w-20 h-4 bg-[#262626] rounded" />
            </div>
            <div className="w-4 h-4 bg-[#262626] rounded" />
          </div>
          <div className="flex items-center justify-between bg-[#000000] p-2 border border-[#262626]">
            <div className="flex items-center gap-3">
              <div className="w-16 h-4 bg-[#262626] rounded" />
              <div className="w-16 h-4 bg-[#262626] rounded" />
              <div className="w-16 h-4 bg-[#262626] rounded" />
            </div>
            <div className="w-20 h-3 bg-[#262626] rounded" />
          </div>
          <div className="flex items-center justify-between bg-[#1f1f1f] p-2 border border-[#3a3a3a]">
            <div className="w-24 h-3 bg-[#262626] rounded" />
            <div className="flex items-center gap-1">
              <div className="w-6 h-6 bg-[#262626] rounded" />
              <div className="w-6 h-6 bg-[#262626] rounded" />
            </div>
          </div>
          <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="p-3 border text-xs font-mono space-y-1.5 bg-[#0d0d0d] border-[#262626]">
                <div className="flex items-center justify-between">
                  <div className="w-16 h-4 bg-[#262626] rounded-full" />
                  <div className="flex items-center gap-2">
                    <div className="w-12 h-3 bg-[#262626] rounded" />
                    <div className="w-8 h-3 bg-[#262626] rounded" />
                  </div>
                </div>
                <div className="pt-1">
                  <div className="w-full h-3 bg-[#262626] rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}