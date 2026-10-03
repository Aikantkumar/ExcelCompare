import React, { useState, useRef } from 'react';
import { 
  Upload, 
  X, 
  FileSpreadsheet, 
  ChevronDown, 
  ChevronLeft,
  ChevronRight,
  Settings,
  RotateCcw,
  Lock,
  HelpCircle
} from 'lucide-react';

export default function FileSidebar({ 
  side, 
  parsedFile, 
  selectedSheet, 
  onFileDrop, 
  onSheetChange, 
  onRemoveFile,
  settings,
  onSettingsChange,
  isExpanded = true,
  onToggleExpand,
  title
}) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files[0]) {
      onFileDrop(e.dataTransfer.files[0], side);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files[0]) {
      onFileDrop(e.target.files[0], side);
    }
  };

  const sheetNames = parsedFile?.sheetNames || [];
  const fileName = parsedFile?.fileName || null;

  return (
    <aside 
      className={`fixed inset-y-0 z-40 transition-all duration-300 ease-out ${
        side === 'left' ? 'left-0' : 'right-0'
      } ${isExpanded ? 'w-80' : 'w-16'} bg-[#0d0d0d] border-r border-[#262626] flex flex-col`}
      style={{ 
        [side === 'left' ? 'left' : 'right']: 0,
        top: 0,
        bottom: 0,
        width: isExpanded ? '320px' : '64px'
      }}
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={handleFileSelect}
        className="hidden"
        id={`file-input-${side}`}
      />

      {/* Collapse/Expand Toggle */}
      <button
        onClick={onToggleExpand}
        className="absolute -right-10 top-4 w-10 h-10 bg-[#141414] border border-[#262626] rounded-full flex items-center justify-center text-white hover:border-white hover:bg-[#1f1f1f] transition-all z-50 shadow-lg"
        aria-label={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
        style={{ 
          [side === 'left' ? 'right' : 'left']: '-40px',
          top: '16px'
        }}
      >
        {side === 'left' ? (
          isExpanded ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />
        ) : (
          isExpanded ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />
        )}
      </button>

      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[#262626] flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 bg-[#000000] border border-[#262626] flex items-center justify-center flex-shrink-0 transition-colors ${
            fileName ? 'border-[#5fa657] bg-[#062c19]' : ''
          }`}>
            <FileSpreadsheet className={`w-5 h-5 ${fileName ? 'text-[#5fa657]' : 'text-[#999999]'}`} />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-caption text-[#c3d9f3] block whitespace-nowrap overflow-hidden text-ellipsis">
              {title}
            </span>
            {fileName && (
              <span className="text-[10px] font-mono text-[#999999] truncate block">
                {fileName}
              </span>
            )}
          </div>
        </div>
        
        {isExpanded && fileName && (
          <button
            onClick={onRemoveFile}
            className="p-1.5 text-[#999999] hover:text-white hover:bg-[#1f1f1f] rounded-full transition-all"
            aria-label="Remove file"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {isExpanded ? (
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {!fileName ? (
            <label htmlFor={`file-input-${side}`} className="cursor-pointer block">
              <div className={`border-2 border-dashed rounded-none p-8 text-center transition-all ${
                isDragActive 
                  ? 'border-white bg-[#1f1f1f]' 
                  : 'border-[#3a3a3a] hover:border-white hover:bg-[#141414]'
              }`}>
                <Upload className="w-10 h-10 text-[#999999] mx-auto mb-3 transition-colors" />
                <span className="text-xs font-mono text-white block uppercase tracking-wider mb-1">
                  DROP FILE HERE OR CLICK
                </span>
                <span className="text-[10px] font-serif text-[#666666] block">
                  Supports .xlsx, .xls, .csv
                </span>
              </div>
            </label>
          ) : (
            <>
              {/* File Info */}
              <div className="bg-[#000000] border border-[#262626] p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="w-5 h-5 text-[#5fa657] shrink-0" />
                  <span className="text-xs font-mono text-white truncate flex-1">{fileName}</span>
                  <label className="text-[10px] font-mono text-[#c3d9f3] hover:underline cursor-pointer shrink-0 ml-2">
                    CHANGE
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Sheet Selector */}
                {sheetNames.length > 1 && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-[#999999] uppercase block">
                      SELECT WORKSHEET
                    </label>
                    <select
                      value={selectedSheet}
                      onChange={(e) => onSheetChange(e.target.value)}
                      className="w-full bg-[#000000] border border-[#3a3a3a] text-white p-2 font-mono text-xs focus:outline-none focus:border-white"
                    >
                      {sheetNames.map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                    <span className="text-[10px] font-mono text-[#666666]">
                      {sheetNames.length} SHEETS TOTAL
                    </span>
                  </div>
                )}

                {sheetNames.length === 1 && (
                  <div className="text-[10px] font-mono text-[#666666]">
                    SINGLE SHEET: {sheetNames[0]}
                  </div>
                )}
              </div>

              {/* Settings Panel */}
              <div className="space-y-3">
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="w-full flex items-center justify-between p-3 bg-[#000000] border border-[#262626] hover:border-white transition-colors"
                >
                  <span className="flex items-center gap-2 text-xs font-mono text-white">
                    <Settings className="w-4 h-4 text-[#c3d9f3]" />
                    COMPARISON SETTINGS
                  </span>
                  <ChevronDown className={`w-4 h-4 text-[#999999] transition-transform ${showSettings ? 'rotate-180' : ''}`} />
                </button>

                {showSettings && (
                  <div className="space-y-4 p-3 bg-[#000000] border border-[#262626] animate-slide-down">
                    <div className="space-y-3">
                      <label className="flex items-center gap-2 text-xs font-mono text-white cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={settings?.smartRowMatch ?? true}
                          onChange={(e) => onSettingsChange({ smartRowMatch: e.target.checked })}
                          className="w-4 h-4 accent-[#c3d9f3] border-[#3a3a3a] bg-[#0d0d0d] focus:ring-0"
                        />
                        <span>SMART FUZZY ROW MATCHING</span>
                      </label>
                    </div>

                    <div className="space-y-3">
                      <label className="flex items-center gap-2 text-xs font-mono text-white cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={settings?.compareFormulas ?? true}
                          onChange={(e) => onSettingsChange({ compareFormulas: e.target.checked })}
                          className="w-4 h-4 accent-[#c3d9f3] border-[#3a3a3a] bg-[#0d0d0d] focus:ring-0"
                        />
                        <span>FORMULA DIFFERENCE DETECTION</span>
                      </label>
                    </div>

                    <div className="pt-3 border-t border-[#262626] flex items-center gap-2 text-xs font-mono text-[#5fa657]">
                      <Lock className="w-3.5 h-3.5 inline" />
                      100% BROWSER OFFLINE — NO DATA SENT
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Sample Data Shortcuts */}
          <div className="pt-4 border-t border-[#262626]">
            <span className="text-caption text-[#c3d9f3] block mb-3">LOAD DEMO SAMPLES</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onSettingsChange({ loadSample: 'financial' })}
                className="px-3 py-2 text-[10px] font-mono border border-[#3a3a3a] text-[#c3d9f3] hover:border-[#c3d9f3] hover:bg-[#1e1b4b] transition-all text-left"
              >
                FINANCIAL
              </button>
              <button
                onClick={() => onSettingsChange({ loadSample: 'inventory' })}
                className="px-3 py-2 text-[10px] font-mono border border-[#3a3a3a] text-[#c3d9f3] hover:border-[#c3d9f3] hover:bg-[#1e1b4b] transition-all text-left"
              >
                INVENTORY
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-between p-2 space-y-4">
          <div className="flex flex-col items-center space-y-2">
            <div className={`w-10 h-10 bg-[#000000] border border-[#262626] flex items-center justify-center ${
              fileName ? 'border-[#5fa657] bg-[#062c19]' : ''
            }`}>
              <FileSpreadsheet className={`w-5 h-5 ${fileName ? 'text-[#5fa657]' : 'text-[#999999]'}`} />
            </div>
          </div>
          
          <div className="flex flex-col items-center space-y-2 w-full">
            <button
              onClick={() => onSettingsChange({ loadSample: 'financial' })}
              className="w-full p-2 bg-[#000000] border border-[#3a3a3a] text-[#c3d9f3] hover:border-[#c3d9f3] hover:bg-[#1e1b4b] transition-all"
              title="Load Financial Sample"
            >
              <HelpCircle className="w-4 h-4 mx-auto" />
            </button>
          </div>
        </div>
      )}

      {/* Bottom Actions */}
      <div className="p-4 border-t border-[#262626] flex-shrink-0">
        {isExpanded ? (
          <div className="space-y-2">
            <button
              onClick={() => onSettingsChange({ loadSample: 'financial' })}
              className="w-full btn-secondary justify-center text-xs py-2"
            >
              <RotateCcw className="w-3.5 h-3.5 inline mr-1" />
              RELOAD SAMPLE
            </button>
            <div className="flex items-center gap-2 text-xs font-mono text-[#5fa657]">
              <Lock className="w-3.5 h-3.5 inline shrink-0" />
              <span className="truncate">OFFLINE DIFF</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-2">
            <Lock className="w-5 h-5 text-[#5fa657]" />
          </div>
        )}
      </div>
    </aside>
  );
}