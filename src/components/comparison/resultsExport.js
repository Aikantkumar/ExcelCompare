import * as XLSX from 'xlsx';

let sharedToCsv = null;

export function setSharedToCsv(fn) {
  sharedToCsv = fn;
}

export function toTsv(rows, headers) {
  const headerRow = headers.join('\t');
  const dataRows = rows.map(row =>
    headers.map(h => {
      const val = row[h];
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes('\t') || str.includes('\n') || str.includes('"')) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    }).join('\t')
  );
  return [headerRow, ...dataRows].join('\n');
}

export function toCsv(rows, headers) {
  if (sharedToCsv) return sharedToCsv(rows, headers);
  const headerRow = headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(',');
  const dataRows = rows.map(row =>
    headers.map(h => {
      const val = row[h];
      if (val === null || val === undefined) return '';
      const str = String(val);
      return `"${str.replace(/"/g, '""')}"`;
    }).join(',')
  );
  return [headerRow, ...dataRows].join('\n');
}

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return { success: true };
  } catch (e) {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return { success: true };
    } catch (fallbackErr) {
      return { success: false, error: fallbackErr.message };
    }
  }
}

export function downloadXlsx({ summaryRows, sheets }) {
  const wb = XLSX.utils.book_new();

  if (summaryRows && summaryRows.length > 0) {
    const ws = XLSX.utils.json_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, ws, 'Summary');
  }

  if (sheets) {
    Object.entries(sheets).forEach(([name, rows]) => {
      if (rows && rows.length > 0) {
        const ws = XLSX.utils.json_to_sheet(rows);
        const safeName = name.substring(0, 31).replace(/[\\/*?:[\]]/g, '_');
        XLSX.utils.book_append_sheet(wb, ws, safeName);
      }
    });
  }

  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `comparison-results-${Date.now()}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadCsv(content, filename) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadHtml(content, filename) {
  const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}