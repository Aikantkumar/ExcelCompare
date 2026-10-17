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
await page.waitForTimeout(3000);

console.log('Initial page loaded');

// Load REGISTER sample
const registerBtn = page.getByRole('button', { name: /REGISTER V1\/V2/ });
await registerBtn.click();
await page.waitForTimeout(3000);
console.log('Register sample loaded');

// Check if error banner is visible
const errorBanner = page.locator('.bg-\\[\\#3b1219\\]').filter({ hasText: /ERROR RENDERING/ });
if (await errorBanner.isVisible()) {
  console.log('ERROR BANNER IS VISIBLE');
  const errorText = await errorBanner.textContent();
  console.log('Error text:', errorText);
} else {
  console.log('No error banner');
}

console.log('\nErrors captured:', errors.length);
for (const e of errors) {
  console.log('  -', e);
}

await browser.close();
