// Screenshot sets for the phase checkpoints (plan 7.4, 11). Phase 3: the home valley before and after,
// each building, a half-built hall, rituals, words, night lanterns and the opening, in Lanternfall+ at
// phone size. Earlier phases' sets stay in docs/phase1 and docs/phase2 (made with older versions of this
// script).
// Usage: node scripts/shots.cjs [outDir] [filter]   (needs Playwright; software GL is slow, be patient)
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');

const file = 'file://' + path.resolve(__dirname, '../dist/index.html');
const outDir = path.resolve(process.argv[2] || path.join(__dirname, '../test-results/shots'));
const filter = process.argv[3] || '';
fs.mkdirSync(outDir, { recursive: true });

/** Each shot: what to do with the debug handle `mb` before the picture (runs in the page). */
const SHOTS = {
  // Before and after (the Phase 3 gate: "before and after look clearly different").
  'valley-before': `mb.setTime('day'); mb.teleport(1, 0); mb.zoom(1); mb.settle();`,
  'valley-after': `mb.restoreAll(true); mb.setTime('day'); mb.teleport(1, 0); mb.zoom(1); mb.settle();`,
  'valley-before-golden': `mb.setTime('golden'); mb.teleport(-6, 4); mb.zoom(1); mb.settle();`,
  'valley-after-golden': `mb.restoreAll(true); mb.setTime('golden'); mb.teleport(-6, 4); mb.zoom(1); mb.settle();`,
  // The buildings.
  'shelter-timber': `mb.deliver('shelter', 6); mb.setTime('golden'); mb.teleport(9.8, 1.2); mb.closeup(3.0, 7.5, 5.0, 2.2); mb.settle();`,
  'garden': `mb.restoreAll(true); mb.setTime('day'); mb.teleport(-12.4, 13.6); mb.closeup(2.9, 6.6, 5.2, 0.8); mb.settle();`,
  'hall': `mb.restoreAll(true); mb.setTime('day'); mb.teleport(-1.2, -6.6); mb.closeup(3.0, 9.5, 5.5, 2.0); mb.settle();`,
  'hall-half-built': `mb.deliver('shelter', 6); mb.deliver('gravel_garden', 4, 6); mb.deliver('meditation_hall', 9, 5); mb.setTime('day'); mb.teleport(-1.2, -6.6); mb.closeup(3.0, 9.5, 5.5, 2.0); mb.settle();`,
  'tower': `mb.restoreAll(true); mb.setTime('day'); mb.teleport(13.6, -8.2); mb.closeup(2.7, 7.0, 3.6, 2.6); mb.settle();`,
  // Rituals, stillness and words.
  'ring-bell': `mb.restoreAll(true); mb.setTime('day'); mb.teleport(11.9, -10.7); mb.closeup(2.7, 6.5, 3.4, 2.6); mb.settle(); mb.ritual('ring_bell');`,
  'night-lanterns': `mb.restoreAll(true); mb.setTime('night'); mb.teleport(-4.5, -8.3); mb.zoom(1); mb.settle(); mb.ritual('light_lanterns'); setTimeout(() => mb.settle(), 4500);`,
  'sit-hall': `mb.restoreAll(true); mb.setTime('golden'); mb.settle(); mb.sitAt('sit_hall');`,
  'poem': `mb.setTime('day'); mb.teleport(5.2, 14.0); mb.read('poem_gate');`,
  // The opening at the old gate (a fresh save shows it once).
  'opening': `mb.setTime('dawn');`,
};

async function shot(browser, name, js) {
  if (filter && !name.includes(filter)) return;
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  // Every shot but the opening starts from a save that has already seen the opening.
  if (name !== 'opening') await page.addInitScript(() => { try { localStorage.setItem('moss-and-bell/save', JSON.stringify({ v: 4, opened: true, at: { place: '', x: 0, z: 0 } })); } catch { /* fine */ } });
  await page.goto(`${file}?look=lanternfallplus`);
  await page.waitForFunction(() => window.__mb && window.__mb.fps > 0, null, { timeout: 240000 });
  await page.evaluate((js) => { const mb = window.__mb; eval(js); }, js);
  // Let the camera, mist and particles settle (software GL runs at a few fps).
  await page.waitForTimeout(9000);
  const out = path.join(outDir, `${name}.jpg`);
  await page.screenshot({ path: out, type: 'jpeg', quality: 82, timeout: 300000 });
  console.log(`${errors.length ? 'ERR ' : 'ok  '} ${path.relative(process.cwd(), out)}`);
  for (const e of errors) console.log('   ', e);
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const [name, js] of Object.entries(SHOTS)) await shot(browser, name, js);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
