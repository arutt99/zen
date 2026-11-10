// Browser smoke test: loads dist/index.html at phone and laptop sizes, checks it boots without
// errors, the canvas is not blank, keyboard and touch move the caretaker, and saves a screenshot.
// Needs Playwright (`npm i -D playwright` locally; preinstalled in some CI images).
const path = require('node:path');
const fs = require('node:fs');
const { chromium, devices } = require('playwright');

const file = 'file://' + path.resolve(__dirname, '../dist/index.html');
const outDir = path.resolve(__dirname, '../test-results');
fs.mkdirSync(outDir, { recursive: true });

async function run(name, contextOpts, drive, { needMove = true } = {}) {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext(contextOpts);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(file);
  // Software GL in CI containers can run at a few fps, so give it time.
  await page.waitForFunction(() => window.__mb && window.__mb.fps > 0, null, { timeout: 90000 });
  // Let shader compilation and the first frames settle before driving.
  await page.waitForTimeout(3000);
  const start = await page.evaluate(() => window.__mb.pos);
  // Track the caretaker's top speed during the drive: at ~1 fps (software GL, laptop size) the distance
  // walked is tiny, but speed shows the input reached the movement code.
  await page.evaluate(() => { window.__topSpeed = 0; setInterval(() => { window.__topSpeed = Math.max(window.__topSpeed, window.__mb.speed); }, 50); });
  await drive(page);
  const topSpeed = await page.evaluate(() => window.__topSpeed);
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
  const ok = errors.length === 0 && (!needMove || (moved > 0.5 && topSpeed > 1)) && variety > 12;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}: moved ${moved.toFixed(2)} m (top speed ${topSpeed.toFixed(1)} m/s), ${variety} colour buckets, tier ${info.tier}, ${info.fps} fps (software GL), screenshot ${path.relative(process.cwd(), shot)}`);
  for (const e of errors) console.log('   error:', e);
  return ok;
}

(async () => {
  // Software GL renders a 1280x720 frame in a second or more, too slow for input to show up in time,
  // so the laptop run checks layout and rendering, and keyboard movement is checked in a small window.
  const laptop = await run('laptop', { viewport: { width: 1280, height: 720 } }, async (page) => {
    await page.waitForTimeout(3000);
  }, { needMove: false });
  const keyboard = await run('keyboard', { viewport: { width: 640, height: 360 } }, async (page) => {
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(4000);
    await page.keyboard.up('KeyD');
  });
  const phone = await run('phone', { ...devices['iPhone 13 landscape'] }, async (page) => {
    // Drag a floating joystick on the left of the screen with a synthetic touch pointer.
    await page.evaluate(async () => {
      const el = document.getElementById('game');
      const fire = (type, x, y) => el.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: 'touch', clientX: x, clientY: y, bubbles: true }));
      fire('pointerdown', 150, 250);
      for (let i = 1; i <= 10; i++) { fire('pointermove', 150 + i * 6, 250); await new Promise((r) => setTimeout(r, 16)); }
      await new Promise((r) => setTimeout(r, 3000));
      window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, pointerType: 'touch', clientX: 210, clientY: 250 }));
    });
  });
  process.exit(laptop && keyboard && phone ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
