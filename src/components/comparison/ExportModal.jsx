import React, { useState } from 'react';
import { Download, FileText, Code, Share2, Check, Printer } from 'lucide-react';

export default function ExportModal({ isOpen, onClose, diffData, sheetName, fileAName, fileBName }) {
  const [activeTab, setActiveTab] = useState('html'); // 'html' | 'pdf' | 'embed' | 'csv'
  const [copiedCode, setCopiedCode] = useState(false);

  if (!isOpen) return null;

  const stats = diffData?.stats || {};

  const generatePrintableReport = () => {
    const printWindow = window.open('', '_blank');
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>CompareExcel Diff Audit Report - ${fileAName} vs ${fileBName}</title>
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
          <h1>COMPAREEXCEL AUDIT REPORT</h1>
          <div class="meta">
            LEFT FILE: ${fileAName || 'File A'}<br/>
            RIGHT FILE: ${fileBName || 'File B'}<br/>
            SHEET: ${sheetName || 'Sheet 1'}<br/>
            GENERATED: ${new Date().toLocaleString()}
          </div>

          <div class="stats">
            <div class="stat-box">TOTAL ROWS: ${stats.totalRows || 0}</div>
            <div class="stat-box">MODIFIED: ${stats.totalModified || 0}</div>
            <div class="stat-box">ADDED: ${stats.totalAdded || 0}</div>
            <div class="stat-box">DELETED: ${stats.totalDeleted || 0}</div>
          </div>

          <h2>DIFFERENCE LIST</h2>
          <table>
            <thead>
              <tr>
                <th>ROW #</th>
                <th>CHANGE TYPE</th>
                <th>ORIGINAL (LEFT FILE)</th>
                <th>MODIFIED (RIGHT FILE)</th>
              </tr>
            </thead>
            <tbody>
              ${(diffData?.rows || [])
                .filter((r) => r.type !== 'SAME')
                .map(
                  (r) => `
                <tr class="${r.type.toLowerCase()}">
                  <td>${r.indexA !== null ? r.indexA + 1 : '-'}/${r.indexB !== null ? r.indexB + 1 : '-'}</td>
                  <td><strong>${r.type}</strong></td>
                  <td>${r.cellsA.map((c) => c.val).join(' | ')}</td>
                  <td>${r.cellsB.map((c) => c.val).join(' | ')}</td>
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

  const embedSnippet = `<compare-excel \n  file-a="${fileAName || 'original.xlsx'}" \n  file-b="${fileBName || 'revised.xlsx'}" \n  theme="dark">\n</compare-excel>\n<script src="https://compareexcel.com/widget.js" async></script>`;

  const copyEmbed = () => {
    navigator.clipboard.writeText(embedSnippet);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 [padding-bottom:env(safe-area-inset-bottom)] [padding-top:env(safe-area-inset-top)]" data-export-modal>
      <div className="bg-[#141414] border border-[#262626] p-4 sm:p-6 max-w-xl w-full max-h-[90vh] overflow-y-auto space-y-6">
        <div className="flex justify-between items-center border-b border-[#262626] pb-4 sm:pb-3">
          <h3 className="text-title-md text-white flex items-center gap-2">
            <Download className="w-5 h-5 text-[#c3d9f3]" />
            EXPORT & SHARE COMPARISON REPORT
          </h3>
          <button onClick={onClose} className="p-2 text-[#999999] hover:text-white" aria-label="Close export modal">✕</button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-[#262626] text-xs font-mono">
          <button
            onClick={() => setActiveTab('html')}
            className={`px-4 py-2 uppercase tracking-wider ${
              activeTab === 'html' ? 'border-b-2 border-white text-white font-bold' : 'text-[#999999]'
            }`}
          >
            HTML / PRINT PDF
          </button>
          <button
            onClick={() => setActiveTab('embed')}
            className={`px-4 py-2 uppercase tracking-wider ${
              activeTab === 'embed' ? 'border-b-2 border-white text-white font-bold' : 'text-[#999999]'
            }`}
          >
            EMBED WIDGET
          </button>
        </div>

        {activeTab === 'html' && (
          <div className="space-y-4">
            <p className="font-serif text-sm text-[#cccccc]">
              Generate a high-density, printable audit summary report suitable for PDF conversion, compliance documentation, or team sign-off.
            </p>

            <button onClick={generatePrintableReport} className="btn-primary w-full py-3">
              <Printer className="w-4 h-4 inline mr-2" />
              GENERATE PRINTABLE PDF / HTML REPORT
            </button>
          </div>
        )}

        {activeTab === 'embed' && (
          <div className="space-y-4">
            <p className="font-serif text-sm text-[#cccccc]">
              Embed this interactive comparison widget directly inside your company intranet, dashboard, or website:
            </p>

            <pre className="bg-[#000000] border border-[#3a3a3a] p-4 text-xs font-mono text-[#c3d9f3] overflow-x-auto whitespace-pre-wrap">
              {embedSnippet}
            </pre>

            <button onClick={copyEmbed} className="btn-secondary w-full py-2 text-xs min-h-[40px]">
              {copiedCode ? <Check className="w-4 h-4 inline mr-2 text-[#5fa657]" /> : <Code className="w-4 h-4 inline mr-2" />}
              {copiedCode ? 'COPIED WIDGET CODE!' : 'COPY EMBED CODE'}
            </button>
          </div>
        )}

        <div className="pt-2 flex justify-end">
          <button onClick={onClose} className="btn-secondary text-xs h-9 px-5">
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}
