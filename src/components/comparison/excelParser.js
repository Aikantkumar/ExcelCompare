import * as XLSX from 'xlsx';

const ERROR_CODES = ['#NULL!', '#DIV/0!', '#VALUE!', '#REF!', '#NAME?', '#NUM!', '#N/A', '#SPILL!', '#CALC!', '#GETTING_DATA'];

export function isExcelError(text) {
  if (!text) return false;
  const str = String(text).trim().toUpperCase();
  return ERROR_CODES.some(code => str === code || str.startsWith(code + ' '));
}

async function hashVBA(vbaRaw) {
  try {
    const buffer = typeof vbaRaw === 'string' 
      ? new TextEncoder().encode(vbaRaw) 
      : new Uint8Array(vbaRaw);
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    let hash = 0x811c9dc5;
    const bytes = typeof vbaRaw === 'string' ? new TextEncoder().encode(vbaRaw) : new Uint8Array(vbaRaw);
    for (const byte of bytes) {
      hash ^= byte;
      hash = Math.imul(hash, 0x01000193);
    }
    return ('00000000' + (hash >>> 0).toString(16)).slice(-8);
  }
}

/**
 * Parse an Excel file ArrayBuffer into sheets with cells, formulas, and headers
 */
export async function parseExcelFile(file, password) {
  return new Promise((resolve, reject) => {
    if (!file) {
      return reject(new Error('No file provided'));
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
              reject(new Error(payload?.message || 'Worker Excel parse error'));
            }
          };

          worker.onerror = (err) => {
            worker.terminate();
            console.warn('Excel parse worker error, falling back to main thread:', err);
            parseMainThread(buffer, file.name, file.size, resolve, reject, password);
          };

          // Slice buffer copy for zero-copy transfer without detaching main thread buffer
          const bufferForWorker = buffer.slice(0);
          worker.postMessage({ fileData: bufferForWorker, fileName: file.name, password }, [bufferForWorker]);
          return;
        } catch (workerErr) {
          console.warn('Worker instantiation failed, using main thread:', workerErr);
        }
      }

      // Fallback: synchronous parse on main thread
      parseMainThread(buffer, file.name, file.size, resolve, reject, password);
    };

    reader.onerror = (error) => reject(error || new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

function parseMainThread(buffer, fileName, fileSize, resolve, reject, password) {
  try {
    const data = new Uint8Array(buffer);
    const readOptions = {
      type: 'array',
      cellFormulas: true,
      cellStyles: true,
      cellDates: true,
      cellNF: true,
      bookVBA: true,
    };
    if (password) readOptions.password = password;

    const workbook = XLSX.read(data, readOptions);

    if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error('The uploaded file does not contain any valid worksheets.');
    }

    const sheetVisibility = {};
    if (workbook.Workbook && workbook.Workbook.Sheets) {
      workbook.Workbook.Sheets.forEach((sheet, idx) => {
        if (sheet.Hidden != null) {
          sheetVisibility[workbook.SheetNames[idx]] = sheet.Hidden;
        }
      });
    }

    const definedNames = [];
    if (workbook.Workbook && workbook.Workbook.Names) {
      workbook.Workbook.Names.forEach(namedRange => {
        if (namedRange.Name && namedRange.Ref) {
          definedNames.push({
            name: namedRange.Name,
            ref: namedRange.Ref,
            sheetScope: namedRange.Sheet || null,
          });
        }
      });
    }

    let vbaInfo = null;
    if (workbook.vbaraw) {
      hashVBA(workbook.vbaraw).then(hash => {
        vbaInfo = { size: workbook.vbaraw.byteLength || workbook.vbaraw.length, hash };
      }).catch(() => {
        vbaInfo = { size: workbook.vbaraw.byteLength || workbook.vbaraw.length, hash: 'unknown' };
      });
    }

    const resultSheets = {};
    const allNumFmts = {};

    workbook.SheetNames.forEach((sheetName) => {
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) {
        resultSheets[sheetName] = { 
          name: sheetName, 
          rows: [], 
          rowCount: 0, 
          colCount: 0, 
          colWidths: [],
          hidden: sheetVisibility[sheetName] === 1 || sheetVisibility[sheetName] === 2,
          numFmts: {},
        };
        return;
      }

      const ref = worksheet['!ref'];
      if (!ref) {
        resultSheets[sheetName] = { 
          name: sheetName, 
          rows: [], 
          rowCount: 0, 
          colCount: 0, 
          colWidths: [],
          hidden: sheetVisibility[sheetName] === 1 || sheetVisibility[sheetName] === 2,
          numFmts: {},
        };
        return;
      }

      const range = XLSX.utils.decode_range(ref);
      const rows = [];
      const sheetNumFmts = {};

      for (let R = range.s.r; R <= range.e.r; ++R) {
        const row = [];
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          const cell = worksheet[cellAddress];

          if (!cell) {
            row.push({ val: '', rawVal: null, formula: '', type: 'e', address: cellAddress, nf: -1, s: -1 });
          } else {
            let nfIdx = -1;
            if (cell.z && cell.z !== 'General') {
              if (!allNumFmts[cell.z]) {
                allNumFmts[cell.z] = Object.keys(allNumFmts).length;
              }
              nfIdx = allNumFmts[cell.z];
              sheetNumFmts[cellAddress] = nfIdx;
            }

            let styleIdx = -1;
            if (cell.s) {
              const styleKey = JSON.stringify(cell.s);
              if (!allNumFmts['__style__' + styleKey]) {
                allNumFmts['__style__' + styleKey] = Object.keys(allNumFmts).length;
              }
              styleIdx = allNumFmts['__style__' + styleKey];
            }

            row.push({
              val: cell.w !== undefined ? cell.w : (cell.v !== undefined ? String(cell.v) : ''),
              rawVal: cell.v,
              formula: cell.f ? `=${cell.f}` : '',
              type: cell.t || 's',
              address: cellAddress,
              nf: nfIdx,
              s: styleIdx,
            });
          }
        }
        rows.push(row);
      }

      // Extract column widths from worksheet['!cols']
      const colWidths = [];
      if (worksheet['!cols']) {
        worksheet['!cols'].forEach((col, idx) => {
          const widthPx = col.wpx || (col.width ? Math.round(col.width * 7.5 + 5) : 120);
          colWidths[idx] = Math.max(80, Math.min(400, widthPx));
        });
      }
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
        hidden: sheetVisibility[sheetName] === 1 || sheetVisibility[sheetName] === 2,
        numFmts: sheetNumFmts,
      };
    });

    const numFmtList = Object.keys(allNumFmts).filter(k => !k.startsWith('__style__')).sort((a, b) => allNumFmts[a] - allNumFmts[b]);

    resolve({
      fileName,
      fileSize,
      sheetNames: workbook.SheetNames,
      sheets: resultSheets,
      names: definedNames,
      vba: vbaInfo,
      numFmts: numFmtList,
    });
  } catch (err) {
    reject(err instanceof Error ? err : new Error(String(err)));
  }
}


