import React, { useState } from 'react';
import { Download, FileText, Code, Check, Printer, X } from 'lucide-react';
import { t } from '../../utils/translations';
import { localeConfig } from '../../config';
import { buildChangesExport } from './exportBuilders';
import { downloadBlob } from './exportUtils';
import * as XLSX from 'xlsx';

export default function ExportModal({ isOpen, onClose, diffData, sheetName, fileAName, fileBName, locale = 'en' }) {
  const [activeTab, setActiveTab] = useState('html'); // 'html' | 'pdf' | 'embed' | 'csv'
  const [copiedCode, setCopiedCode] = useState(false);

  if (!isOpen) return null;

  const stats = diffData?.stats || {};

  const escapeHtml = (text) => String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const generatePrintableReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      return;
    }
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${t(locale, 'comparison.exportTitle', 'CompareExcel Diff Audit Report')} - ${escapeHtml(fileAName || 'File A')} vs ${escapeHtml(fileBName || 'File B')}</title>
          <style>
            body { font-family: -apple-system, sans-serif; background: #fff; color: #111; padding: 40px; }
            h1 { font-size: 24px; text-transform: uppercase; letter-spacing: 2px; border-bottom: 2px solid #000; padding-bottom: 10px; }
            .meta { font-family: monospace; font-size: 12px; color: #666; margin-bottom: 24px; }
            .stats { display: flex; gap: 20px; margin-bottom: 30px; font-family: monospace; font-size: 14px; }
            .stat-box { border: 1px solid #ccc; padding: 12px 20px; flex: 1; }
            table { width: 100%; border-collapse: collapse; font-family: monospace; font-size: 12px; }
            th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
            th { background: #f5f5f5; }
            .modified { background: #fef3c7; color: #92400e; }
            .added { background: #d1fae5; color: #065f46; }
            .deleted { background: #fee2e2; color: #991b1b; }
          </style>
        </head>
        <body>
          <h1>${t(locale, 'comparison.exportReportTitle', 'COMPAREEXCEL AUDIT REPORT')}</h1>
          <div class="meta">
            ${t(locale, 'comparison.leftFile', 'LEFT FILE')}: ${escapeHtml(fileAName || 'File A')}<br/>
            ${t(locale, 'comparison.rightFile', 'RIGHT FILE')}: ${escapeHtml(fileBName || 'File B')}<br/>
            ${t(locale, 'comparison.sheet', 'SHEET')}: ${escapeHtml(sheetName || 'Sheet 1')}<br/>
            ${t(locale, 'comparison.generated', 'GENERATED')}: ${new Date().toLocaleString(localeConfig[locale].locale.replace('_', '-'))}
          </div>

          <div class="stats">
            <div class="stat-box">${t(locale, 'comparison.totalRows', 'TOTAL ROWS')}: ${stats.totalRows || 0}</div>
            <div class="stat-box">${t(locale, 'comparison.modified', 'MODIFIED')}: ${stats.totalModified || 0}</div>
            <div class="stat-box">${t(locale, 'comparison.added', 'ADDED')}: ${stats.totalAdded || 0}</div>
            <div class="stat-box">${t(locale, 'comparison.deleted', 'DELETED')}: ${stats.totalDeleted || 0}</div>
          </div>

          <h2>${t(locale, 'comparison.differenceList', 'DIFFERENCE LIST')}</h2>
          <table>
            <thead>
              <tr>
                <th>${t(locale, 'comparison.row', 'ROW #')}</th>
                <th>${t(locale, 'comparison.changeType', 'CHANGE TYPE')}</th>
                <th>${t(locale, 'comparison.original', 'ORIGINAL (LEFT FILE)')}</th>
                <th>${t(locale, 'comparison.modifiedFile', 'MODIFIED (RIGHT FILE)')}</th>
              </tr>
            </thead>
            <tbody>
              ${(diffData?.rows || [])
                .filter((r) => r.type !== 'SAME' && r.type !== 'COLLAPSED')
                .map(
                  (r) => `
                <tr class="${escapeHtml(r.type.toLowerCase())}">
                  <td>${r.indexA !== null ? r.indexA + 1 : '-'}/${r.indexB !== null ? r.indexB + 1 : '-'}</td>
                  <td><strong>${escapeHtml(r.type)}</strong></td>
                  <td>${Array.isArray(r.cellsA) ? r.cellsA.map((c) => escapeHtml(c?.val)).join(' | ') : '-'}</td>
                  <td>${Array.isArray(r.cellsB) ? r.cellsB.map((c) => escapeHtml(c?.val)).join(' | ') : '-'}</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
          <script>window.print();</script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const exportCsvReport = () => {
    const result = buildChangesExport(diffData, {
      fileA: fileAName || 'File A',
      fileB: fileBName || 'File B',
      sheetA: sheetName || 'Sheet 1',
      sheetB: sheetName || 'Sheet 1',
    });
    downloadBlob(new Blob([result.csv.content], { type: 'text/csv;charset=utf-8;' }), result.csv.filename);
  };

  const exportXlsxReport = () => {
    const result = buildChangesExport(diffData, {
      fileA: fileAName || 'File A',
      fileB: fileBName || 'File B',
      sheetA: sheetName || 'Sheet 1',
      sheetB: sheetName || 'Sheet 1',
    });
    if (result.workbook) {
      XLSX.writeFile(result.workbook, result.xlsxFilename);
    }
  };

  const embedSnippet = `<compare-excel \n  file-a="${fileAName || 'original.xlsx'}" \n  file-b="${fileBName || 'revised.xlsx'}" \n  theme="dark">\n</compare-excel>\n<script src="https://compareexcel.com/widget.js" async></script>`;

  const copyEmbed = () => {
    navigator.clipboard.writeText(embedSnippet);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
      <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 [padding-bottom:env(safe-area-inset-bottom)] [padding-top:env(safe-area-inset-top)]" data-export-modal>
      <div className="bg-surface-card border border-hairline p-4 sm:p-6 max-w-xl w-full max-h-[90vh] overflow-y-auto space-y-6">
        <div className="flex justify-between items-center border-b border-hairline pb-4 sm:pb-3">
            <h3 className="text-title-md text-ink flex items-center gap-2">
              <Download className="w-5 h-5 text-link" />
              {t(locale, 'comparison.exportShare', 'EXPORT COMPARISON REPORT')}
            </h3>
          <button onClick={onClose} className="p-2 text-muted hover:text-ink" aria-label={t(locale, 'comparison.closeExport', 'Close export modal')}>
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-hairline text-xs font-mono">
          <button
            onClick={() => setActiveTab('html')}
            className={`px-4 py-2 uppercase tracking-wider ${
              activeTab === 'html' ? 'border-b-2 border-white text-ink font-bold' : 'text-muted'
            }`}
          >
            {t(locale, 'comparison.htmlPrintPdf', 'HTML / PRINT PDF')}
          </button>
          <button
            onClick={() => setActiveTab('csv')}
            className={`px-4 py-2 uppercase tracking-wider ${
              activeTab === 'csv' ? 'border-b-2 border-white text-ink font-bold' : 'text-muted'
            }`}
          >
            {t(locale, 'comparison.exportCsv', 'EXPORT CSV')}
          </button>
          <button
            onClick={() => setActiveTab('embed')}
            className={`px-4 py-2 uppercase tracking-wider ${
              activeTab === 'embed' ? 'border-b-2 border-white text-ink font-bold' : 'text-muted'
            }`}
          >
            {t(locale, 'comparison.embedWidget', 'EMBED WIDGET')}
          </button>
        </div>

        {activeTab === 'csv' && (
          <div className="space-y-4">
            <p className="font-serif text-sm text-body">
              Download all detected differences and changes as a CSV or Excel spreadsheet for offline auditing and records.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button onClick={exportCsvReport} className="btn-primary w-full py-3 text-xs">
                <Download className="w-4 h-4 inline mr-2" />
                {t(locale, 'comparison.exportCsv', 'EXPORT CSV')}
              </button>
              <button onClick={exportXlsxReport} className="btn-secondary w-full py-3 text-xs">
                <FileText className="w-4 h-4 inline mr-2" />
                EXPORT EXCEL (.XLSX)
              </button>
            </div>
          </div>
        )}

        {activeTab === 'html' && (
          <div className="space-y-4">
            <p className="font-serif text-sm text-body">
              {t(locale, 'comparison.exportDesc', 'Generate a high-density, printable audit summary report suitable for PDF conversion, compliance documentation, or team sign-off.')}
            </p>

            <button onClick={generatePrintableReport} className="btn-primary w-full py-3">
              <Printer className="w-4 h-4 inline mr-2" />
              {t(locale, 'comparison.generateReport', 'GENERATE PRINTABLE PDF / HTML REPORT')}
            </button>
          </div>
        )}

        {activeTab === 'embed' && (
          <div className="space-y-4">
            <p className="font-serif text-sm text-body">
              {t(locale, 'comparison.embedDesc', 'Embed this interactive comparison widget directly inside your company intranet, dashboard, or website:')}
            </p>

            <pre className="bg-canvas border border-hairline-strong p-4 text-xs font-mono text-link overflow-x-auto whitespace-pre-wrap">
              {embedSnippet}
            </pre>

            <button onClick={copyEmbed} className="btn-secondary w-full py-2 text-xs min-h-[40px]">
              {copiedCode ? <Check className="w-4 h-4 inline mr-2 text-success" /> : <Code className="w-4 h-4 inline mr-2" />}
              {copiedCode ? t(locale, 'comparison.copiedWidget', 'COPIED WIDGET CODE!') : t(locale, 'comparison.copyEmbedCode', 'COPY EMBED CODE')}
            </button>
          </div>
        )}

        <div className="pt-2 flex justify-end">
          <button onClick={onClose} className="btn-secondary text-xs h-9 px-5">
            {t(locale, 'comparison.close', 'CLOSE')}
          </button>
        </div>
      </div>
    </div>
  );
}
