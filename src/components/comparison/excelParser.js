import * as XLSX from 'xlsx';

/**
 * Parse an Excel file ArrayBuffer into sheets with cells, formulas, and headers
 */
export async function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      return reject(new Error('NO_FILE_PROVIDED'));
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      const buffer = e.target.result;

      // Try worker parsing first if Web Workers are supported
      if (typeof Worker !== 'undefined') {
        try {
          const worker = new Worker(
            new URL('./excelParseWorker.js', import.meta.url),
            { type: 'module' }
          );

          worker.onmessage = (evt) => {
            const { type, payload } = evt.data;
            worker.terminate();
            if (type === 'PARSED') {
              resolve(payload);
            } else {
              reject(new Error(payload?.message || 'WORKER_PARSE_ERROR'));
            }
          };

          worker.onerror = (err) => {
            worker.terminate();
            console.warn('Excel parse worker error, falling back to main thread:', err);
            parseMainThread(buffer, file.name, file.size, resolve, reject);
          };

          // Slice buffer copy for zero-copy transfer without detaching main thread buffer
          const bufferForWorker = buffer.slice(0);
          worker.postMessage({ fileData: bufferForWorker, fileName: file.name }, [bufferForWorker]);
          return;
        } catch (workerErr) {
          console.warn('Worker instantiation failed, using main thread:', workerErr);
        }
      }

      // Fallback: synchronous parse on main thread
      parseMainThread(buffer, file.name, file.size, resolve, reject);
    };

    reader.onerror = (error) => reject(error || new Error('FAILED_TO_READ_FILE'));
    reader.readAsArrayBuffer(file);
  });
}

function parseMainThread(buffer, fileName, fileSize, resolve, reject) {
  try {
    const data = new Uint8Array(buffer);
    const workbook = XLSX.read(data, {
      type: 'array',
      cellFormulas: true,
      cellStyles: true,
      cellDates: true,
      cellNF: true,
    });

    if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error('NO_VALID_SHEETS');
    }

    const resultSheets = {};

    workbook.SheetNames.forEach((sheetName) => {
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) {
        resultSheets[sheetName] = { name: sheetName, rows: [], rowCount: 0, colCount: 0, colWidths: [] };
        return;
      }

      const ref = worksheet['!ref'];
      if (!ref) {
        resultSheets[sheetName] = { name: sheetName, rows: [], rowCount: 0, colCount: 0, colWidths: [] };
        return;
      }

      const range = XLSX.utils.decode_range(ref);
      const rows = [];

      for (let R = range.s.r; R <= range.e.r; ++R) {
        const row = [];
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          const cell = worksheet[cellAddress];

          if (!cell) {
            row.push({ val: '', formula: '', type: 'e', address: cellAddress });
          } else {
            row.push({
              val: cell.w !== undefined ? cell.w : (cell.v !== undefined ? String(cell.v) : ''),
              rawVal: cell.v,
              formula: cell.f ? `=${cell.f}` : '',
              type: cell.t || 's',
              address: cellAddress,
            });
          }
        }
        rows.push(row);
      }

      // Extract column widths from worksheet['!cols']
      const colWidths = [];
      if (worksheet['!cols']) {
        worksheet['!cols'].forEach((col, idx) => {
          // XLSX stores width in character units; convert to pixels (approx 7.5px per char + padding)
          const widthPx = col.wpx || (col.width ? Math.round(col.width * 7.5 + 5) : 120);
          colWidths[idx] = Math.max(80, Math.min(400, widthPx)); // Clamp between 80-400px
        });
      }
      // Fill missing column widths with default
      const maxCols = rows[0] ? rows[0].length : 0;
      for (let i = 0; i < maxCols; i++) {
        if (!colWidths[i]) colWidths[i] = 120;
      }

      resultSheets[sheetName] = {
        name: sheetName,
        rows: rows,
        rowCount: rows.length,
        colCount: rows[0] ? rows[0].length : 0,
        colWidths: colWidths,
      };
    });

    resolve({
      fileName,
      fileSize,
      sheetNames: workbook.SheetNames,
      sheets: resultSheets,
    });
  } catch (err) {
    reject(err instanceof Error ? err : new Error(String(err)));
  }
}


