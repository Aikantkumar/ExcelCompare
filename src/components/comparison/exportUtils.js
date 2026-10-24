/**
 * Shared CSV / XLSX export utilities for CompareExcel.
 *
 * Schema rule: CSV and XLSX headers and type codes are stable ENGLISH constants
 * and are NOT translated, so downstream tools keep working. Only the UI labels
 * go through t().
 */

import * as XLSX from 'xlsx';

const INJECTION_PREFIXES = ['=', '+', '@'];
const INJECTION_START_CHARS = ['\t', '\r'];

/**
 * Always return a string. Quote when the value contains a comma, double quote,
 * CR or LF. Double any inner quotes. null and undefined become "". Keep numeric
 * 0 as "0".
 */
export function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  const needsQuotes = /[",\r\n]/.test(str);
  const escaped = str.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

/**
 * Prevent spreadsheet formula injection. Prefix a single quote when a string
 * starts with =, +, @, TAB or CR, or starts with "-" followed by a non-digit
 * and non-dot. Apply this only in CSV output. Do not apply it to .xlsx, where
 * cells are typed as strings.
 */
export function sanitizeForCsv(value) {
  if (typeof value !== 'string') return value;
  if (value.length === 0) return value;
  const first = value[0];
  const second = value[1];
  if (INJECTION_PREFIXES.includes(first)) return `'${value}`;
  if (INJECTION_START_CHARS.includes(first)) return `'${value}`;
  if (first === '-' && second !== undefined && !/[\d.]/.test(second)) {
    return `'${value}`;
  }
  return value;
}

/**
 * Build CSV text with CRLF line endings and a UTF-8 BOM so Excel reads Unicode
 * correctly. Built with an array join, not repeated string concatenation, so
 * 100k rows stay fast.
 *
 * columns = [{key, header}]. rows = array of objects keyed by column key.
 */
export function toCsv(columns, rows) {
  const out = [];

  const headerRow = columns.map((c) => csvEscape(c.header)).join(',');
  out.push(headerRow);

  for (const row of rows) {
    const cells = columns.map((c) => {
      let val = row[c.key] === undefined ? '' : row[c.key];
      val = sanitizeForCsv(val);
      return csvEscape(val);
    });
    out.push(cells.join(','));
  }

  return '\uFEFF' + out.join('\r\n') + '\r\n';
}

/**
 * Download a blob using URL.createObjectURL + a temporary <a>. Never data: URIs
 * ("#" truncates them and they have size limits).
 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Format: compareexcel_<mode>[_<part>]_<left>_vs_<right>_<YYYYMMDD-HHmmss>.<ext>
 * Strip file extensions from left and right, replace characters outside
 * [A-Za-z0-9._-] with "_", and cap each name at 40 chars.
 */
const nowTimestamp = () => {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
};

const cleanName = (name) => {
  let base = String(name ?? '');
  const dot = base.lastIndexOf('.');
  if (dot > 0 && dot < base.length - 1) base = base.slice(0, dot);
  base = base.replace(/[^A-Za-z0-9._-]/g, '_');
  return base.slice(0, 40);
};

export function buildFilename({ mode, left, right, part, ext }) {
  const ts = nowTimestamp();
  const cleanLeft = cleanName(left);
  const cleanRight = cleanName(right);
  const partSegment = part ? `_${part}` : '';
  return `compareexcel_${mode}${partSegment}_${cleanLeft}_vs_${cleanRight}_${ts}.${ext}`;
};

/**
 * SheetJS (xlsx) workbook from [{name, columns, rows}].
 * Freeze the header row, add an auto-filter, set column widths from content
 * (min 10, max 60), and write every cell as a string type (t:'s') so IDs like
 * 00123 are not converted to numbers.
 * Sheet names are max 31 chars with no [ ] : * ? / \ .
 */
export function buildWorkbook(sheets) {
  const wb = XLSX.utils.book_new();

  for (const sheet of sheets) {
    const name = sanitizeSheetName(sheet.name);
    const columns = sheet.columns || [];
    const rows = sheet.rows || [];

    const data = [];
    data.push(columns.map((c) => c.header));

    for (const row of rows) {
      data.push(columns.map((c) => {
        let val = row[c.key] === undefined ? '' : row[c.key];
        if (val === null || val === undefined) val = '';
        return String(val);
      }));
    }

    const ws = XLSX.utils.aoa_to_sheet(data);

    // Every cell as a string type so IDs like 00123 stay as text.
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let R = range.s.r; R <= range.e.r; R++) {
      for (let C = range.s.c; C <= range.e.c; C++) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = ws[addr];
        if (cell) {
          cell.t = 's';
          cell.v = cell.v === undefined ? '' : String(cell.v);
          cell.z = '@';
        }
      }
    }

    // Freeze header row.
    if (rows.length > 0) {
      ws['!freeze'] = { y: 1 };
    }

    // Auto-filter over the whole data range.
    ws['!autofilter'] = { ref: ws['!ref'] || 'A1' };

    // Column widths from content (min 10, max 60).
    const widths = columns.map((_, cIdx) => {
      let maxLen = String(columns[cIdx]?.header || '').length;
      for (const row of rows) {
        const v = row[columns[cIdx]?.key];
        if (v !== null && v !== undefined) maxLen = Math.max(maxLen, String(v).length);
      }
      return Math.min(60, Math.max(10, maxLen + 2));
    });
    ws['!cols'] = widths.map((w) => ({ wch: w }));

    XLSX.utils.book_append_sheet(wb, ws, name);
  }

  return wb;
}

const INVALID_SHEET_CHARS = /[\[\]:*?\/\\]/g;

function sanitizeSheetName(name) {
  let safe = String(name ?? 'Sheet').replace(INVALID_SHEET_CHARS, '_');
  if (!safe) safe = 'Sheet';
  return safe.slice(0, 31);
}
