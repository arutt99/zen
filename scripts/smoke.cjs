// Browser smoke test: loads dist/index.html at phone and laptop sizes, checks it boots without
// errors, the canvas is not blank, keyboard and touch move the caretaker, and saves a screenshot.
// Needs Playwright (`npm i -D playwright` locally; preinstalled in some CI images).
const path = require('node:path');
const fs = require('node:fs');
const { chromium, devices } = require('playwright');

const file = 'file://' + path.resolve(__dirname, '../dist/index.html');
const outDir = path.resolve(__dirname, '../test-results');
fs.mkdirSync(outDir, { recursive: true });

async function run(name, contextOpts, drive) {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext(contextOpts);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(file);
  await page.waitForFunction(() => window.__mb && window.__mb.fps > 0, null, { timeout: 30000 });
  const start = await page.evaluate(() => window.__mb.pos);
  await drive(page);
  const end = await page.evaluate(() => window.__mb.pos);
  const moved = Math.hypot(end.x - start.x, end.z - start.z);
  // Non-blank check: sample the composited screenshot for colour variety.
  const shot = path.join(outDir, `smoke-${name}.png`);
  await page.screenshot({ path: shot });
  const variety = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const g = document.createElement('canvas');
    g.width = 32; g.height = 18;
    const x = g.getContext('2d');
    x.drawImage(img, 0, 0, 32, 18);
    const d = x.getImageData(0, 0, 32, 18).data;
    const set = new Set();
    for (let i = 0; i < d.length; i += 4) set.add(`${d[i] >> 4},${d[i + 1] >> 4},${d[i + 2] >> 4}`);
    return set.size;
  }, fs.readFileSync(shot).toString('base64'));
  const info = await page.evaluate(() => ({ fps: window.__mb.fps, tier: window.__mb.tier }));
  await browser.close();
  const ok = errors.length === 0 && moved > 0.5 && variety > 12;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}: moved ${moved.toFixed(2)} m, ${variety} colour buckets, tier ${info.tier}, ${info.fps} fps (software GL), screenshot ${path.relative(process.cwd(), shot)}`);
  for (const e of errors) console.log('   error:', e);
  return ok;
}

(async () => {
  const laptop = await run('laptop', { viewport: { width: 1366, height: 768 } }, async (page) => {
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(800);
    await page.keyboard.up('KeyD');
  });
  const phone = await run('phone', { ...devices['iPhone 13 landscape'] }, async (page) => {
    // Drag a floating joystick on the left of the screen with a synthetic touch pointer.
    await page.evaluate(async () => {
      const el = document.getElementById('game');
      const fire = (type, x, y) => el.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: 'touch', clientX: x, clientY: y, bubbles: true }));
      fire('pointerdown', 150, 250);
      for (let i = 1; i <= 10; i++) { fire('pointermove', 150 + i * 6, 250); await new Promise((r) => setTimeout(r, 16)); }
      await new Promise((r) => setTimeout(r, 800));
      window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, pointerType: 'touch', clientX: 210, clientY: 250 }));
    });
  });
  process.exit(laptop && phone ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
