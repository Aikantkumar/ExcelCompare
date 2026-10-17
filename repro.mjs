import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();

const errors = [];
page.on('console', msg => {
  if (msg.type() === 'error') {
    errors.push(msg.text());
    console.log('CONSOLE ERROR:', msg.text());
  }
});
page.on('pageerror', err => {
  errors.push(err.message);
  console.log('PAGE ERROR:', err.message);
});

await page.goto('http://localhost:4322/compare', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

// Load REGISTER sample
const registerBtn = page.getByRole('button', { name: /REGISTER V1\/V2/ });
await registerBtn.click();
await page.waitForTimeout(3000);
console.log('Loaded register sample');

// Try toggling collapseUnchangedBlocks
const collapseBtn = page.getByRole('button', { name: /Collapse unchanged blocks/ });
if (await collapseBtn.isVisible()) {
  await collapseBtn.click();
  await page.waitForTimeout(2000);
  console.log('Toggled collapse unchanged blocks');
}

// Try toggling hideUnchangedColumns
const hideColsBtn = page.getByRole('button', { name: /Hide unchanged columns/ });
if (await hideColsBtn.isVisible()) {
  await hideColsBtn.click();
  await page.waitForTimeout(2000);
  console.log('Toggled hide unchanged columns');
}

// Try toggling hideUnchangedRows
const hideRowsBtn = page.getByRole('button', { name: /Hide unchanged rows/ });
if (await hideRowsBtn.isVisible()) {
  await hideRowsBtn.click();
  await page.waitForTimeout(2000);
  console.log('Toggled hide unchanged rows');
}

// Try loading FINANCIAL sample
const financialBtn = page.getByRole('button', { name: /FINANCIAL Q3\/Q4/ });
await financialBtn.click();
await page.waitForTimeout(3000);
console.log('Loaded financial sample');

// Try loading INVENTORY sample
const inventoryBtn = page.getByRole('button', { name: /INVENTORY SKU/ });
await inventoryBtn.click();
await page.waitForTimeout(3000);
console.log('Loaded inventory sample');

console.log('\nErrors captured:', errors.length);
for (const e of errors) {
  console.log('  -', e);
}

await browser.close();
