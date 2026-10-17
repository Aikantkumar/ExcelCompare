import React, { useState, useMemo } from 'react';
import { ChevronDown, Check, Minus, Circle } from 'lucide-react';

const GROUP_LABELS = {
  VALUES: 'VALUES',
  FORMULAS: 'FORMULAS',
  STRUCTURE: 'STRUCTURE',
  PRESENTATION: 'PRESENTATION',
  CODE: 'CODE',
  AUDIT: 'AUDIT FLAGS',
};

export default function CategoryFilter({
  categories,
  counts,
  enabled,
  onChange,
  auditFlags,
  auditCounts,
  auditEnabled,
  onAuditChange,
  showOnlyFlagged,
  onShowOnlyFlaggedChange,
  onHideSystemGenerated,
  hideSystemGenerated,
}) {
  const [collapsedGroups, setCollapsedGroups] = useState(new Set());

  const allCategoryIds = useMemo(() => categories.map(c => c.id), [categories]);
  const allAuditIds = useMemo(() => auditFlags.map(f => f.id), [auditFlags]);

  const isAllEnabled = enabled.size === allCategoryIds.filter(id => counts[id] > 0).length;
  const isAllAuditEnabled = auditEnabled.size === allAuditIds.filter(id => auditCounts[id] > 0).length;
  const isIndeterminate = enabled.size > 0 && enabled.size < allCategoryIds.filter(id => counts[id] > 0).length;
  const isAuditIndeterminate = auditEnabled.size > 0 && auditEnabled.size < allAuditIds.filter(id => auditCounts[id] > 0).length;

  const handleSelectAll = () => {
    if (isAllEnabled) {
      onChange(new Set());
    } else {
      const newEnabled = new Set(allCategoryIds.filter(id => counts[id] > 0));
      onChange(newEnabled);
    }
  };

  const handleSelectAllAudit = () => {
    if (isAllAuditEnabled) {
      onAuditChange(new Set());
    } else {
      const newEnabled = new Set(allAuditIds.filter(id => auditCounts[id] > 0));
      onAuditChange(newEnabled);
    }
  };

  const handleToggleGroup = (group) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

  const handleToggleCategory = (id) => {
    const newEnabled = new Set(enabled);
    if (newEnabled.has(id)) newEnabled.delete(id);
    else newEnabled.add(id);
    onChange(newEnabled);
  };

  const handleToggleAudit = (id) => {
    const newEnabled = new Set(auditEnabled);
    if (newEnabled.has(id)) newEnabled.delete(id);
    else newEnabled.add(id);
    onAuditChange(newEnabled);
  };

  const groupedCategories = useMemo(() => {
    const groups = new Map();
    categories.forEach(cat => {
      if (!groups.has(cat.group)) groups.set(cat.group, []);
      groups.get(cat.group).push(cat);
    });
    return groups;
  }, [categories]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs font-mono text-white uppercase tracking-wider border-b border-[#262626] pb-2">
        <span>SHOW CHANGES</span>
        <button
          onClick={onHideSystemGenerated}
          className={`px-2 py-1 text-[10px] font-mono border rounded transition-all ${hideSystemGenerated ? 'border-[#d4a017] text-[#d4a017] bg-[#2d2208]' : 'border-[#3a3a3a] text-[#999999] hover:border-white hover:text-white'}`}
          title="Hide system-generated changes (shifted formulas and names)"
        >
          HIDE SYSTEM-GENERATED
        </button>
      </div>

      <div className="flex items-center gap-2 p-2 bg-[#000000] border border-[#262626]">
        <input
          type="checkbox"
          checked={isAllEnabled}
          ref={el => { if (el) el.indeterminate = isIndeterminate; }}
          onChange={handleSelectAll}
          className="w-4 h-4 accent-[#5fa657]"
        />
        <span className="text-[10px] font-mono text-[#c3d9f3] font-bold">SELECT ALL</span>
        <span className="text-[10px] font-mono text-[#999999] ml-auto tabular-nums">
          {enabled.size} / {allCategoryIds.filter(id => counts[id] > 0).length}
        </span>
      </div>

      {Array.from(groupedCategories.entries()).map(([group, cats]) => {
        const groupCats = cats.filter(c => counts[c.id] > 0 || enabled.has(c.id));
        if (groupCats.length === 0) return null;

        const isCollapsed = collapsedGroups.has(group);

        return (
          <div key={group} className="space-y-1">
            <button
              onClick={() => handleToggleGroup(group)}
              className="w-full flex items-center justify-between text-xs font-mono text-[#999999] hover:text-white py-1 px-2 transition-colors"
            >
              <span className="flex items-center gap-2">
                {isCollapsed ? <ChevronDown className="w-3 h-3 transform rotate-90" /> : <ChevronDown className="w-3 h-3" />}
                <span className="uppercase tracking-wider">{GROUP_LABELS[group] || group}</span>
              </span>
              <span className="text-[10px] font-mono text-[#666666] tabular-nums">
                {groupCats.reduce((sum, c) => sum + (counts[c.id] || 0), 0)}
              </span>
            </button>

            {!isCollapsed && (
              <div className="space-y-1 ml-6">
                {groupCats.map(cat => {
                  const count = counts[cat.id] || 0;
                  const isEnabled = enabled.has(cat.id);
                  const color = cat.colorToken;
                  const pattern = cat.pattern;

                  return (
                    <label
                      key={cat.id}
                      className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer transition-colors rounded ${isEnabled ? '' : 'opacity-50'} hover:bg-[#1a1a1a}`}
                      title={cat.tooltip}
                    >
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={() => handleToggleCategory(cat.id)}
                        className="w-4 h-4 accent-[#5fa657] shrink-0"
                      />
                      <div
                        className="w-6 h-6 flex items-center justify-center font-mono text-[10px] font-bold border rounded"
                        style={{
                          backgroundColor: color + '33',
                          borderColor: color,
                          borderStyle: pattern === 'dashed' ? 'dashed' : 'solid',
                          color: color,
                        }}
                      >
                        Aa
                      </div>
                      <span className="text-[11px] font-mono text-white flex-1 truncate">{cat.label}</span>
                      <span className="text-[10px] font-mono text-[#999999] tabular-nums shrink-0">{count}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      <div className="border-t border-[#262626] pt-2 space-y-3">
        <div className="flex items-center justify-between text-xs font-mono text-white uppercase tracking-wider border-b border-[#262626] pb-2">
          <span>AUDIT FLAGS</span>
        </div>

        <div className="flex items-center gap-2 p-2 bg-[#000000] border border-[#262626]">
          <input
            type="checkbox"
            checked={isAllAuditEnabled}
            indeterminate={isAuditIndeterminate}
            onChange={handleSelectAllAudit}
            className="w-4 h-4 accent-[#5fa657]"
          />
          <span className="text-[10px] font-mono text-[#d4a017] font-bold">SELECT ALL FLAGS</span>
          <span className="text-[10px] font-mono text-[#999999] ml-auto tabular-nums">
            {auditEnabled.size} / {allAuditIds.filter(id => auditCounts[id] > 0).length}
          </span>
        </div>

        {auditFlags.map(flag => {
          const count = auditCounts[flag.id] || 0;
          const isEnabled = auditEnabled.has(flag.id);

          return (
            <label
              key={flag.id}
              className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer transition-colors rounded ${isEnabled ? '' : 'opacity-50'} hover:bg-[#1a1a1a}`}
              title={flag.tooltip}
            >
              <input
                type="checkbox"
                checked={isEnabled}
                onChange={() => handleToggleAudit(flag.id)}
                className="w-4 h-4 accent-[#d4a017] shrink-0"
              />
              <span className="text-[11px] font-mono text-[#d4a017] font-bold shrink-0">{flag.icon}</span>
              <span className="text-[11px] font-mono text-white flex-1 truncate">{flag.label}</span>
              <span className="text-[10px] font-mono text-[#999999] tabular-nums shrink-0">{count}</span>
            </label>
          );
        })}

        <label className="flex items-center gap-2 px-2 py-2 cursor-pointer text-xs font-mono text-[#cccccc] hover:text-white transition-colors">
          <input
            type="checkbox"
            checked={showOnlyFlagged}
            onChange={onShowOnlyFlaggedChange}
            className="w-4 h-4 accent-[#d4a017]"
          />
          <span>SHOW ONLY FLAGGED</span>
        </label>
      </div>
    </div>
  );
}