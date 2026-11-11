// Screenshot sets for the phase checkpoints (plan 7.4, 11). Phase 4: the first journey — the open trail
// gate, the bamboo grove before and after its wind shrine, the shrine half built and finished, the crane,
// cutting bamboo, the travel map, the tea house (half built, finished, and its ritual) and the grove at
// dusk, in Lanternfall+ at phone size. Earlier phases' sets stay in docs/phase1..3 (made with older
// versions of this script).
// Usage: node scripts/shots.cjs [outDir] [filter]   (needs Playwright; software GL is slow, be patient)
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');

const file = 'file://' + path.resolve(__dirname, '../dist/index.html');
const outDir = path.resolve(process.argv[2] || path.join(__dirname, '../test-results/shots'));
const filter = process.argv[3] || '';
fs.mkdirSync(outDir, { recursive: true });

const HOME_BUILT = `mb.deliver('shelter', 6); mb.deliver('gravel_garden', 4, 6); mb.deliver('meditation_hall', 14, 10); mb.deliver('bell_tower', 10, 8);`;
/**
 * Each shot: the place to be in (travelled to first, by the map), and what to do with the debug handle
 * `mb` before the picture (runs in the page once the place is ready). `pre` runs before travelling.
 */
const SHOTS = {
  'trail-gate': { pre: HOME_BUILT, js: `mb.setTime('golden'); mb.teleport(15.2, -12.2); mb.closeup(3.6, 7.5, 4.6, 1.4); mb.settle();` },
  'grove-arrive': { place: 'bamboo_grove', js: `mb.setTime('day'); mb.teleport(2.2, 16.4); mb.settle();` },
  'grove-before': { place: 'bamboo_grove', js: `mb.setTime('day'); mb.teleport(0.8, -4.5); mb.zoom(1); mb.settle();` },
  'bamboo-cut': { place: 'bamboo_grove', js: `mb.setTime('day'); mb.teleport(4.2, 2.0); mb.closeup(1.6, 5.2, 3.4, 1.4);` },
  'shrine-half': { place: 'bamboo_grove', js: `mb.deliver('wind_shrine', 0, 2, 4); mb.setTime('day'); mb.teleport(2.4, -6.2); mb.closeup(3.0, 7.0, 4.6, 1.4); mb.settle();` },
  'grove-after': { place: 'bamboo_grove', pre: 'mb.restoreAll(true);', js: `mb.setTime('day'); mb.teleport(0.8, -4.5); mb.zoom(1); mb.settle();` },
  'shrine': { place: 'bamboo_grove', pre: 'mb.restoreAll(true);', js: `mb.setTime('golden'); mb.teleport(2.4, -6.2); mb.closeup(3.0, 7.0, 4.6, 1.4); mb.settle();` },
  'crane': { place: 'bamboo_grove', pre: 'mb.restoreAll(true);', js: `mb.setTime('day'); mb.teleport(-5.2, -1.2); mb.closeup(3.6, 6.0, 3.6, 0.6); mb.settle();` },
  'grove-dusk': { place: 'bamboo_grove', pre: 'mb.restoreAll(true);', js: `mb.setTime('dusk'); mb.teleport(-0.6, 3.0); mb.zoom(1); mb.settle();` },
  'map': { pre: HOME_BUILT + ` mb.discover('bamboo_grove');`, js: `mb.setTime('day'); mb.teleport(14.7, -14.4); mb.settle(); mb.openMap();` },
  'teahouse-half': { pre: HOME_BUILT + ` mb.deliver('wind_shrine', 0, 4, 8); mb.deliver('tea_house', 4, 0, 3);`, js: `mb.setTime('day'); mb.teleport(-16.0, 13.6); mb.closeup(4.0, 7.5, 4.8, 1.2); mb.settle();` },
  // Pacing pass (2026-11-11): parts cut into pieces, caught half assembled.
  'pieces-shelter': { pre: '', js: `mb.deliverUnits('shelter', 17); mb.setTime('day'); mb.teleport(9.5, 0.5); mb.closeup(3.2, 6.4, 4.2, 1.2); mb.settle();` },
  'pieces-hall': { pre: `mb.deliver('shelter', 6); mb.deliver('gravel_garden', 4, 6); mb.deliverUnits('meditation_hall', 33, 20);`, js: `mb.setTime('day'); mb.teleport(-1.8, -6.4); mb.closeup(3.3, 8.5, 5.2, 1.4); mb.settle();` },
  'pieces-teahouse': { pre: HOME_BUILT + ` mb.deliver('wind_shrine', 0, 4, 8); mb.deliverUnits('tea_house', 15, 0, 8);`, js: `mb.setTime('day'); mb.teleport(-16.0, 13.6); mb.closeup(4.0, 7.5, 4.8, 1.2); mb.settle();` },
  'teahouse': { pre: 'mb.restoreAll(true);', js: `mb.setTime('golden'); mb.teleport(-16.0, 13.6); mb.closeup(4.0, 7.5, 4.8, 1.2); mb.settle();` },
  'tea-ritual': { pre: 'mb.restoreAll(true);', js: `mb.setTime('day'); mb.teleport(-17.75, 12.47); mb.settle(); mb.ritual('make_tea'); mb.closeup(3.2, 5.0, 3.0, 0.8);` },
};

async function shot(browser, name, js) {
  if (filter && !name.includes(filter)) return;
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  // Every shot but the opening starts from a save that has already seen the opening.
  // Every shot starts from a save that has seen the opening and knows the grove (the map works).
  await page.addInitScript(() => { try { localStorage.setItem('moss-and-bell/save', JSON.stringify({ v: 6, opened: true, places: ['home_valley', 'bamboo_grove'], at: { place: '', x: 0, z: 0 } })); } catch { /* fine */ } });
  await page.goto(`${file}?look=lanternfallplus`);
  await page.waitForFunction(() => window.__mb && window.__mb.fps > 0, null, { timeout: 240000 });
  if (js.pre) await page.evaluate((code) => { const mb = window.__mb; eval(code); }, js.pre);
  if (js.place) {
    await page.evaluate((id) => window.__mb.travel(id), js.place);
    await page.waitForFunction((id) => window.__mb.place === id && !window.__mb.travelling, js.place, { timeout: 300000, polling: 500 });
  }
  await page.evaluate((code) => { const mb = window.__mb; eval(code); }, js.js);
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
