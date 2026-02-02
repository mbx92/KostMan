import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the Excel file
const excelPath = path.join(__dirname, '..', 'docs', 'clean.xlsx');
const workbook = XLSX.readFile(excelPath);

console.log('=== EXCEL FILE ANALYSIS ===\n');
console.log('Sheet Names:', workbook.SheetNames);
console.log('\n');

// Analyze each sheet
workbook.SheetNames.forEach(sheetName => {
    console.log(`\n=== Sheet: ${sheetName} ===`);
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    console.log(`Total Rows: ${data.length}`);

    if (data.length > 0) {
        const headers = data[0];
        console.log(`\nHeaders (${headers.length} columns):`);
        headers.forEach((header, idx) => {
            console.log(`  ${idx + 1}. ${header}`);
        });

        console.log('\nFirst 5 data rows:');
        const sampleData = data.slice(1, 6);
        sampleData.forEach((row, idx) => {
            console.log(`\nRow ${idx + 1}:`);
            headers.forEach((header, colIdx) => {
                const value = row[colIdx];
                if (value !== undefined && value !== null && value !== '') {
                    console.log(`  ${header}: ${value}`);
                }
            });
        });

        // Show all data in JSON format for analysis
        console.log('\n=== Full Data (JSON) ===');
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        console.log(JSON.stringify(jsonData, null, 2));
    }
});
