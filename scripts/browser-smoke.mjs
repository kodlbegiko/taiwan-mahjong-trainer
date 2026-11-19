import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const root = process.env.BASE_URL ?? 'http://127.0.0.1:4173';
const key = 'tw-mahjong-trainer:session:v1';
await mkdir('artifacts/browser-smoke', { recursive: true });
const browser = await chromium.launch({ headless: true });
async function runScenario(name, viewport, mobile) {
  const context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile });
  const page = await context.newPage();
  const uncaught = [];
  page.on('pageerror', err => uncaught.push(err.message));
  await page.goto(root, { waitUntil: 'networkidle' });
  const hand = page.locator('#hand button[data-tile]');
  await hand.first().waitFor({ timeout: 30000 });
  assert.equal(await hand.count(), 17, `${name}: initial hand must contain 17 physical tiles`);
  assert.equal(await page.locator('#stat-total').innerText(), '0');

  if (mobile) {
    const touch = await hand.evaluateAll(nodes => nodes.map(el => ({ width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height })));
    assert.ok(touch.every(b => b.width >= 40 && b.height >= 44), `${name}: tile hit targets too small`);
    const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    assert.ok(documentWidth <= viewport.width + 2, `${name}: global horizontal overflow ${documentWidth}/${viewport.width}`);
  }

  await page.screenshot({ path: `artifacts/browser-smoke/${name}-hand.png`, fullPage: true });
  await hand.first().click();
  await page.locator('#answer').waitFor({ state: 'visible' });
  assert.ok((await page.locator('#rankings tr').count()) > 0, `${name}: missing alternatives`);
  for (const target of ['#chosen-shanten','#chosen-kinds','#chosen-copies','#best-shanten','#best-kinds','#best-copies']) {
    assert.match(await page.locator(target).innerText(), /^\d+$/, `${name}: missing numeric data at ${target}`);
  }
  assert.equal(await page.locator('#stat-total').innerText(), '1');
  const record = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
  assert.equal(record.length, 1);
  assert.ok(['perfect','acceptable','improve'].includes(record[0].grade));
  await page.screenshot({ path: `artifacts/browser-smoke/${name}-answer.png`, fullPage: true });
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('#hand button').first().waitFor();
  assert.equal(await page.locator('#stat-total').innerText(), '1', `${name}: v1 history did not persist across reload`);

  await page.locator('#hand button').first().focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.evaluate(() => [...document.querySelectorAll('#hand button')].indexOf(document.activeElement)), 1, `${name}: keyboard arrow not moving focus`);
  await page.keyboard.press('Enter');
  await page.locator('#answer').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#stat-total').innerText(), '2');
  await page.locator('#next-bottom').click();
  assert.equal(await page.locator('#hand button').count(), 17);
  assert.equal(await page.locator('#answer').isHidden(), true);
  assert.equal(await page.locator('#stat-total').innerText(), '2');
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.locator('#stat-total').innerText(), '2');

  // Verify a legacy V0.1 record loads without fabricating hand/answer details.
  await page.evaluate(([key, fixture]) => localStorage.setItem(key, JSON.stringify(fixture)), [key, [
    { grade: 'perfect', seconds: 1.2, difficulty: 'beginner', date: '2026-01-01T00:00:00.000Z' },
  ]]);
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.locator('#stat-total').innerText(), '1', `${name}: legacy progress not loaded`);
  assert.deepEqual(uncaught, [], `${name}: browser page errors`);
  console.log(`PASS ${name}: 17 tiles, pick, grade, alternatives, next, keyboard, v1 persistence and legacy import`);
  await context.close();
}
try {
  await runScenario('desktop-1440', { width: 1440, height: 900 }, false);
  await runScenario('mobile-390', { width: 390, height: 844 }, true);
} finally {
  await browser.close();
}
