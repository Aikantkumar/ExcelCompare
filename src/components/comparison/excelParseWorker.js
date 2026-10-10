import * as XLSX from 'xlsx';

self.onmessage = (e) => {
  const { fileData, fileName } = e.data;
  try {
    const data = new Uint8Array(fileData);
    const workbook = XLSX.read(data, {
      type: 'array',
      cellFormulas: true,
      cellStyles: true,
      cellDates: true,
      cellNF: true,
    });

    if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error('The uploaded file does not contain any valid worksheets.');
    }

    const resultSheets = {};

    workbook.SheetNames.forEach((sheetName) => {
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet || !worksheet['!ref']) {
        resultSheets[sheetName] = { name: sheetName, rows: [], rowCount: 0, colCount: 0, colWidths: [] };
        return;
      }

      const range = XLSX.utils.decode_range(worksheet['!ref']);
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
        rows,
        rowCount: rows.length,
        colCount: rows[0] ? rows[0].length : 0,
        colWidths: colWidths,
      };
    });

    self.postMessage({
      type: 'PARSED',
      payload: {
        fileName,
        sheetNames: workbook.SheetNames,
        sheets: resultSheets,
      },
    });
  } catch (err) {
    self.postMessage({
      type: 'ERROR',
      payload: { message: err.message || 'Error parsing Excel file' },
    });
  }
};
