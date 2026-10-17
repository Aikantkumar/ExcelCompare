import { test, expect } from '@playwright/test';

const PAGES = ['/', '/compare', '/compare-columns', '/reconcile', '/batch', '/features', '/help', '/faq', '/privacy'];
const VIEWPORTS: { width: number; height: number; label: string }[] = [
  { width: 320, height: 568, label: '320x568' },
  { width: 360, height: 800, label: '360x800' },
  { width: 390, height: 844, label: '390x844' },
  { width: 768, height: 1024, label: '768x1024' },
  { width: 1024, height: 768, label: '1024x768' },
  { width: 1440, height: 900, label: '1440x900' },
];

const BASE = process.env.BASE_URL || 'http://localhost:4321';

function overflowCheck(page: any) {
  return page.evaluate(() => {
    const w = window.innerWidth;
    const sw = document.documentElement.scrollWidth;
    const offenders: any[] = [];
    const seen = new Set<string>();
    for (const el of Array.from(document.querySelectorAll('*'))) {
      const r = el.getBoundingClientRect();
      if (r.width > w + 1) {
        const key = `${el.tagName}.${el.className}|${Math.round(r.left)}|${Math.round(r.top)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        offenders.push({
          tag: el.tagName,
          class: el.className || '',
          width: Math.round(r.width),
          left: Math.round(r.left),
          right: Math.round(r.right),
          top: Math.round(r.top),
        });
      }
    }
    return { scrollWidth: sw, innerWidth: w, ok: sw <= w, offenders: offenders.slice(0, 20) };
  });
}

async function checkWorkspace(page: any, label: string) {
  const res = await overflowCheck(page);
  console.log(`\n[${label}] page overflow ok=${res.ok} scrollWidth=${res.scrollWidth} innerWidth=${res.innerWidth}`);
  for (const o of res.offenders) {
    console.log(`   WIDER: ${o.tag} class="${o.class}" w=${o.width} l=${o.left} r=${o.right} t=${o.top}`);
  }
  expect(res.ok).toBe(true);

  const pills = ['Stacked', 'Overlapped', 'Both Files', 'Original (Top)', 'Changed (Bottom)'];
  for (const p of pills) {
    const loc = page.getByRole('button', { name: new RegExp(p) });
    await expect(loc).toBeVisible();
    const box = await loc.boundingBox();
    console.log(`   pill '${p}':`, box ? `x=${Math.round(box.x)} w=${Math.round(box.w)} h=${Math.round(box.h)}` : 'NULL');
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.w).toBeLessThanOrEqual(362);
  }
  for (const name of ['Export', 'Share']) {
    const loc = page.getByRole('button', { name });
    await expect(loc).toBeVisible();
  }

  await expect(page.getByText('Tools & Options')).toHaveCount(0);
  await expect(page.getByText('Changes Audit')).toHaveCount(0);

  const tableContainer = page.locator('.overflow-auto.relative').first();
  await expect(tableContainer).toBeVisible();
  const tcBox = await tableContainer.boundingBox();
  console.log(`   table container: x=${Math.round(tcBox!.x)} w=${Math.round(tcBox!.w)}`);
  expect(tcBox!.w).toBeGreaterThan(300);

  const header = tableContainer.locator('.sticky.top-0').first();
  const firstRow = tableContainer.locator('tbody tr').first();
  const hBox = await header.boundingBox();
  const rBox = await firstRow.boundingBox();
  console.log(`   header bottom=${hBox ? Math.round(hBox.y + hBox.height) : -1} first row top=${rBox ? Math.round(rBox.y) : -1}`);
  if (hBox && rBox) expect(rBox.y).toBeGreaterThanOrEqual(hBox.y + hBox.height - 2);

  const styles = await tableContainer.evaluate((el: HTMLElement) => {
    const cs = getComputedStyle(el);
    return { overflowY: cs.overflowY, overscrollY: cs.overscrollBehaviorY, touch: cs.touchAction };
  });
  console.log(`   container styles:`, JSON.stringify(styles));
  expect(styles.overscrollY).toBe('auto');

  const docScroll = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight);
  console.log(`   page scrollable: ${docScroll}`);

  const showTools = page.getByRole('button', { name: /SHOW TOOLS/ });
  await expect(showTools).toBeVisible();
  await showTools.click();
  await page.waitForTimeout(500);
  await expect(page.getByText('Tools & Options')).toHaveCount(1);
  const drawer = page.getByRole('dialog').filter({ hasText: 'Tools & Options' });
  await expect(drawer).toBeVisible();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await expect(page.getByText('Tools & Options')).toHaveCount(0);

  const showAudit = page.getByRole('button', { name: /SHOW AUDIT/ });
  await expect(showAudit).toBeVisible();
  await showAudit.click();
  await page.waitForTimeout(500);
  await expect(page.getByText('Changes Audit')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await expect(page.getByText('Changes Audit')).toHaveCount(0);
}

test.describe('responsive', () => {
    for (const pageName of PAGES) {
    for (const vp of VIEWPORTS) {
      test(`${pageName} @ ${vp.label} has no page-level horizontal overflow`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(`${BASE}${pageName}`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1000);
        const dir = process.env.REPORT_DIR || 'after';
        await page.screenshot({ path: `responsive-report/${dir}/${pageName.replace(/\//g, '_')}-${vp.label}.png`, fullPage: true });
        const res = await overflowCheck(page);
        console.log(`\n[OVERFLOW] ${pageName} ${vp.label}: ok=${res.ok} scrollWidth=${res.scrollWidth} innerWidth=${res.innerWidth}`);
        for (const o of res.offenders) {
          console.log(`   WIDER: ${o.tag} class="${o.class}" w=${o.width} l=${o.left} r=${o.right} t=${o.top}`);
        }
        expect(res.ok).toBe(true);
      });
    }
  }

  test('/compare @ 360x800 workspace checks after REGISTER V1/V2', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(`${BASE}/compare`, { waitUntil: 'networkidle' });

    const register = page.getByRole('button', { name: /REGISTER V1\/V2/ });
    await expect(register).toBeVisible();
    await register.click();
    await page.waitForTimeout(1500);

    await checkWorkspace(page, 'COMPARE@360 AFTER REGISTER');
  });

  test('/compare @ 360x800 FINANCIAL & INVENTORY samples', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(`${BASE}/compare`, { waitUntil: 'networkidle' });
    for (const name of ['FINANCIAL Q3/Q4', 'INVENTORY SKU']) {
      const btn = page.getByRole('button', { name });
      await expect(btn).toBeVisible();
      await btn.click();
      await page.waitForTimeout(1200);
      const res = await overflowCheck(page);
      console.log(`\n[COMPARE@360 ${name}] page overflow ok=${res.ok}`);
      for (const o of res.offenders) console.log(`   WIDER: ${o.tag} class="${o.class}" w=${o.width} l=${o.left} r=${o.right}`);
      expect(res.ok).toBe(true);
      await expect(page.getByRole('button', { name: /Stacked/ })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Export' })).toBeVisible();
    }
  });

  test('/compare-columns @ 360x800 toolbar wraps, nothing clipped', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(`${BASE}/compare-columns`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const res = await overflowCheck(page);
    console.log(`\n[COLUMNS@360] page overflow ok=${res.ok}`);
    for (const o of res.offenders) console.log(`   WIDER: ${o.tag} class="${o.class}" w=${o.width} l=${o.left} r=${o.right}`);
    expect(res.ok).toBe(true);
    await expect(page.getByRole('button', { name: /Export/ }).first()).toBeVisible();
  });

  test('/reconcile @ 360x800 toolbar wraps & export button fits', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(`${BASE}/reconcile`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const res = await overflowCheck(page);
    console.log(`\n[RECONCILE@360] page overflow ok=${res.ok}`);
    for (const o of res.offenders) console.log(`   WIDER: ${o.tag} class="${o.class}" w=${o.width} l=${o.left} r=${o.right}`);
    expect(res.ok).toBe(true);
    const exportBtn = page.getByRole('button', { name: /EXPORT/ });
    await expect(exportBtn).toBeVisible();
    const box = await exportBtn.boundingBox();
    expect((box?.x ?? 0) + (box?.w ?? 0)).toBeLessThanOrEqual(362);
  });

  test('/batch @ 360x800 button rows wrap', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(`${BASE}/batch`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const res = await overflowCheck(page);
    console.log(`\n[BATCH@360] page overflow ok=${res.ok}`);
    for (const o of res.offenders) console.log(`   WIDER: ${o.tag} class="${o.class}" w=${o.width} l=${o.left} r=${o.right}`);
    expect(res.ok).toBe(true);
  });

  test('full view on mobile scrolls vertically', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(`${BASE}/compare`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const full = page.getByRole('button', { name: /FULL VIEW/ });
    await expect(full).toBeVisible();
    await full.click();
    await page.waitForTimeout(500);
    const view = page.locator('.h-\\[100dvh\\]').first();
    await expect(view).toBeVisible();
    const css = await view.evaluate((el: HTMLElement) => getComputedStyle(el).overflowY);
    console.log(`\n[FULLVIEW@360] overflowY=${css}`);
    expect(css).toBe('auto');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });
});
