import * as XLSX from 'xlsx';

/**
 * Parse an Excel file ArrayBuffer into sheets with cells, formulas, and headers
 */
export async function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      return reject(new Error('No file provided'));
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
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
          if (!worksheet) {
            resultSheets[sheetName] = { name: sheetName, rows: [], rowCount: 0, colCount: 0 };
            return;
          }

          const ref = worksheet['!ref'];
          if (!ref) {
            resultSheets[sheetName] = { name: sheetName, rows: [], rowCount: 0, colCount: 0 };
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

          resultSheets[sheetName] = {
            name: sheetName,
            rows: rows,
            rowCount: rows.length,
            colCount: rows[0] ? rows[0].length : 0,
          };
        });

        resolve({
          fileName: file.name,
          fileSize: file.size,
          sheetNames: workbook.SheetNames,
          sheets: resultSheets,
        });
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    };

    reader.onerror = (error) => reject(error || new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Sample datasets for instant interactive testing
 */
export const SAMPLE_DATASETS = {
  financial: {
    name: 'Quarterly Financials (Q3 vs Q4)',
    fileA: {
      fileName: 'Financials_Q3.xlsx',
      sheetNames: ['Income Statement'],
      sheets: {
        'Income Statement': {
          name: 'Income Statement',
          rowCount: 7,
          colCount: 5,
          rows: [
            [{ val: 'Account Code' }, { val: 'Line Item' }, { val: 'Q3 Budget' }, { val: 'Q3 Actual' }, { val: 'Variance Formula' }],
            [{ val: '1001' }, { val: 'Software Revenue' }, { val: '120,000' }, { val: '145,000' }, { val: '=D2-C2', formula: '=D2-C2' }],
            [{ val: '1002' }, { val: 'Consulting Services' }, { val: '45,000' }, { val: '42,000' }, { val: '=D3-C3', formula: '=D3-C3' }],
            [{ val: '2001' }, { val: 'Salaries & Benefits' }, { val: '80,000' }, { val: '85,000' }, { val: '=D4-C4', formula: '=D4-C4' }],
            [{ val: '2002' }, { val: 'Cloud Infrastructure' }, { val: '15,000' }, { val: '18,500' }, { val: '=D5-C5', formula: '=D5-C5' }],
            [{ val: '2003' }, { val: 'Office Supplies' }, { val: '3,000' }, { val: '2,800' }, { val: '=D6-C6', formula: '=D6-C6' }],
            [{ val: '9000' }, { val: 'Net Profit' }, { val: '67,000' }, { val: '80,700' }, { val: '=SUM(D2:D6)-SUM(C2:C6)', formula: '=SUM(D2:D6)-SUM(C2:C6)' }],
          ]
        }
      }
    },
    fileB: {
      fileName: 'Financials_Q4_Revised.xlsx',
      sheetNames: ['Income Statement'],
      sheets: {
        'Income Statement': {
          name: 'Income Statement',
          rowCount: 8,
          colCount: 5,
          rows: [
            [{ val: 'Account Code' }, { val: 'Line Item' }, { val: 'Q4 Budget' }, { val: 'Q4 Actual' }, { val: 'Variance Formula' }],
            [{ val: '1001' }, { val: 'Software Revenue' }, { val: '120,000' }, { val: '158,000' }, { val: '=D2-C2', formula: '=D2-C2' }],
            [{ val: '1002' }, { val: 'Consulting Services' }, { val: '45,000' }, { val: '48,500' }, { val: '=D3-C3', formula: '=D3-C3' }],
            [{ val: '1003' }, { val: 'Enterprise Subscriptions' }, { val: '25,000' }, { val: '31,000' }, { val: '=D4-C4', formula: '=D4-C4' }], // Added row!
            [{ val: '2001' }, { val: 'Salaries & Benefits' }, { val: '80,000' }, { val: '92,000' }, { val: '=D5-C5', formula: '=D5-C5' }],
            [{ val: '2002' }, { val: 'Cloud Infrastructure' }, { val: '15,000' }, { val: '22,100' }, { val: '=D6-C6*1.05', formula: '=D6-C6*1.05' }], // Formula modified!
            [{ val: '2003' }, { val: 'Office Supplies' }, { val: '3,000' }, { val: '2,800' }, { val: '=D7-C7', formula: '=D7-C7' }],
            [{ val: '9000' }, { val: 'Net Profit' }, { val: '92,000' }, { val: '120,600' }, { val: '=SUM(D2:D7)-SUM(C2:C7)', formula: '=SUM(D2:D7)-SUM(C2:C7)' }],
          ]
        }
      }
    }
  },
  register: {
    name: 'Project Register (v1 vs v2)',
    fileA: {
      fileName: 'register-v1.xlsx',
      sheetNames: ['Register'],
      sheets: {
        'Register': {
          name: 'Register',
          rowCount: 6,
          colCount: 8,
          rows: [
            [{ val: 'Item ID' }, { val: 'Workstream' }, { val: 'Owner' }, { val: 'Priority' }, { val: 'Status' }, { val: 'Start date' }, { val: 'Target date' }, { val: 'Budget' }],
            [{ val: 'HZ-001' }, { val: 'Facilities' }, { val: 'Avery Singh' }, { val: 'High' }, { val: 'Complete' }, { val: '2026-07-06' }, { val: '2026-07-17' }, { val: '$18,050.00' }],
            [{ val: 'HZ-002' }, { val: 'Procurement' }, { val: 'Leah Morgan' }, { val: 'Medium' }, { val: 'In Progress' }, { val: '2026-07-06' }, { val: '2026-08-07' }, { val: '$72,000.00' }],
            [{ val: 'HZ-003' }, { val: 'Communications' }, { val: 'Maya Chen' }, { val: 'High' }, { val: 'In-Review' }, { val: '2026-07-08' }, { val: '7/24/2026' }, { val: '$9,500.00' }],
            [{ val: 'HZ-004' }, { val: 'Data' }, { val: 'Noah Williams' }, { val: 'Medium' }, { val: 'Complete' }, { val: '2026-07-01' }, { val: '2026-07-15' }, { val: '$14,000.00' }],
            [{ val: 'HZ-005' }, { val: 'Engineering' }, { val: 'Liam Vance' }, { val: 'Low' }, { val: 'Pending' }, { val: '2026-07-10' }, { val: '2026-08-20' }, { val: '$32,500.00' }],
          ]
        }
      }
    },
    fileB: {
      fileName: 'register-v2.xlsx',
      sheetNames: ['Register'],
      sheets: {
        'Register': {
          name: 'Register',
          rowCount: 6,
          colCount: 8,
          rows: [
            [{ val: 'Item ID' }, { val: 'Workstream' }, { val: 'Owner' }, { val: 'Priority' }, { val: 'Status' }, { val: 'Start date' }, { val: 'Target date' }, { val: 'Budget' }],
            [{ val: 'HZ-001' }, { val: 'Facilities' }, { val: 'Elena Ford' }, { val: 'High' }, { val: 'Complete' }, { val: '2026-07-06' }, { val: '2026-07-17' }, { val: '$18,120.00' }],
            [{ val: 'HZ-002' }, { val: 'Finance' }, { val: 'Leah Morgan' }, { val: 'High' }, { val: 'In Progress' }, { val: '2026-07-06' }, { val: '2026-08-07' }, { val: '$72,000.00' }],
            [{ val: 'HZ-003' }, { val: 'Communications' }, { val: 'Maya Chen' }, { val: 'High' }, { val: 'Complete' }, { val: '2026-07-08' }, { val: '07-24' }, { val: '$9,500.00' }],
            [{ val: 'HZ-004' }, { val: 'Data' }, { val: 'Noah Williams' }, { val: 'Medium' }, { val: 'Complete' }, { val: '2026-07-01' }, { val: '2026-07-15' }, { val: '$14,000.00' }],
            [{ val: 'HZ-005' }, { val: 'Engineering' }, { val: 'Liam Vance' }, { val: 'Medium' }, { val: 'In Progress' }, { val: '2026-07-10' }, { val: '2026-08-20' }, { val: '$35,000.00' }],
          ]
        }
      }
    }
  },
  inventory: {
    name: 'Inventory Audit (SKU Key Matching)',
    fileA: {
      fileName: 'Warehouse_Stock_A.csv',
      sheetNames: ['Stock'],
      sheets: {
        'Stock': {
          name: 'Stock',
          rowCount: 6,
          colCount: 4,
          rows: [
            [{ val: 'SKU' }, { val: 'Product Name' }, { val: 'Qty' }, { val: 'Unit Price' }],
            [{ val: 'SKU-001' }, { val: 'Titanium Laptop Arm' }, { val: '150' }, { val: '$240.00' }],
            [{ val: 'SKU-002' }, { val: 'Ergonomic Desk Mat' }, { val: '500' }, { val: '$35.00' }],
            [{ val: 'SKU-003' }, { val: 'OLED Dual Monitor' }, { val: '85' }, { val: '$650.00' }],
            [{ val: 'SKU-004' }, { val: 'Wireless Mechanical Keypad' }, { val: '300' }, { val: '$110.00' }],
            [{ val: 'SKU-005' }, { val: 'USB-C Thunderbolt Hub' }, { val: '210' }, { val: '$85.00' }],
          ]
        }
      }
    },
    fileB: {
      fileName: 'Physical_Audit_Count.csv',
      sheetNames: ['Stock'],
      sheets: {
        'Stock': {
          name: 'Stock',
          rowCount: 6,
          colCount: 4,
          rows: [
            [{ val: 'SKU' }, { val: 'Product Name' }, { val: 'Qty' }, { val: 'Unit Price' }],
            [{ val: 'SKU-001' }, { val: 'Titanium Laptop Arm' }, { val: '150' }, { val: '$240.00' }],
            [{ val: 'SKU-002' }, { val: 'Ergonomic Desk Mat' }, { val: '480' }, { val: '$35.00' }], // Mismatch Qty
            [{ val: 'SKU-003' }, { val: 'OLED Dual Monitor' }, { val: '85' }, { val: '$680.00' }], // Mismatch Price
            [{ val: 'SKU-005' }, { val: 'USB-C Thunderbolt Hub' }, { val: '210' }, { val: '$85.00' }],
            [{ val: 'SKU-006' }, { val: 'Smart Noise-Canceling Mic' }, { val: '95' }, { val: '$190.00' }], // New SKU!
          ]
        }
      }
    }
  }
};
