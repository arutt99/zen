// Screenshot sets for the phase checkpoints (plan 7.4, 11). Phase 5: art decision point A7 — every candidate
// season palette (Classic, Gentle, Bold) in all four seasons in both places, from the same views, in
// Lanternfall+ at phone size; plus decorating, building styles, the collection book and seasonal finds.
// Earlier phases' sets stay in docs/phase1..4 (made with older versions of this script).
// Usage: node scripts/shots.cjs [outDir] [filter]   (needs Playwright; software GL is slow, be patient)
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');

const file = 'file://' + path.resolve(__dirname, '../dist/index.html');
const outDir = path.resolve(process.argv[2] || path.join(__dirname, '../test-results/shots'));
const filter = process.argv[3] || '';
fs.mkdirSync(outDir, { recursive: true });

const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
const PALETTES = ['classic', 'gentle', 'bold'];
const VIEWS = {
  home: { js: `mb.setTime('day'); mb.teleport(3, 3); mb.zoom(1); mb.settle();` },
  grove: { place: 'bamboo_grove', js: `mb.setTime('day'); mb.teleport(0.8, -4.5); mb.zoom(1); mb.settle();` },
};
/**
 * A series: one page, one view, several pictures (seasons), so the place is built once. `pre` runs before
 * travelling, `js` once there, and `each(season)` before each picture.
 */
const SERIES = [];
for (const pal of PALETTES) for (const [view, v] of Object.entries(VIEWS)) {
  SERIES.push({ name: `a7-${pal}-${view}`, place: v.place, pre: `mb.restoreAll(true); mb.setPalette('${pal}');`, js: v.js, shots: SEASONS.map((s) => ({ name: `a7-${pal}-${view}-${s}`, js: `mb.setSeason('${s}'); ${v.js}` })) });
}
const HOME_ALL = `mb.restoreAll(true); mb.setPalette('classic');`;
SERIES.push(
  { name: 'dusk', pre: HOME_ALL, js: '', shots: [
    { name: 'autumn-dusk', js: `mb.setSeason('autumn'); mb.setTime('dusk'); mb.teleport(-1.5, -4.5); mb.zoom(1); mb.settle();` },
    { name: 'winter-night', js: `mb.setSeason('winter'); mb.setTime('night'); mb.teleport(-1.5, -4.5); mb.settle();` },
  ] },
  { name: 'finds', pre: HOME_ALL, js: '', shots: [
    { name: 'find-blossom', js: `mb.setSeason('spring'); mb.setTime('day'); mb.teleport(-14.2, -2.2); mb.closeup(3.6, 4.6, 3.2, 0.4); mb.settle();` },
    { name: 'find-leaf', js: `mb.setSeason('autumn'); mb.setTime('day'); mb.teleport(16.6, 8.6); mb.closeup(2.4, 4.6, 3.2, 0.4); mb.settle();` },
    { name: 'find-card', js: `mb.takeFind('find_leaf');` },
    { name: 'book', js: `mb.takeFind('find_blossom'); mb.read('poem_pond'); mb.read('poem_gate'); mb.read(null); mb.openBook(true);` },
  ] },
  { name: 'decorate', pre: HOME_ALL + ` mb.decorate('stone_lantern', 5.0, 8.8, 0.3); mb.decorate('cherry', 9.5, 9.6, 1.0); mb.decorate('flower_bed', 4.0, 10.6, 0); mb.decorate('bench', 4.2, 8.2, 3.6); mb.decorate('mossy_stone', 12.5, 9.8, 0.8);`, js: '', shots: [
    { name: 'decorated', js: `mb.setSeason('spring'); mb.setTime('day'); mb.teleport(6.8, 7.0); mb.closeup(0.4, 8.0, 5.6, 0.6); mb.settle();` },
    { name: 'decorate-mode', js: `mb.decorMode(true, 'maple'); mb.teleport(9.2, 7.4); mb.settle();` },
  ] },
  { name: 'styles', pre: HOME_ALL + ` mb.setStyle('meditation_hall', 'temple'); mb.setStyle('shelter', 'temple');`, js: '', shots: [
    { name: 'style-hall-temple', js: `mb.setSeason('spring'); mb.setTime('day'); mb.teleport(-1.8, -6.4); mb.closeup(3.3, 8.5, 5.2, 1.4); mb.settle();` },
    { name: 'style-hall-temple-winter', js: `mb.setSeason('winter'); mb.setTime('day'); mb.teleport(-1.8, -6.4); mb.closeup(3.3, 8.5, 5.2, 1.4); mb.settle();` },
  ] },
);

async function series(browser, ser) {
  const shots = ser.shots.filter((x) => !filter || x.name.includes(filter));
  if (!shots.length) return;
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
  // Every shot starts from a save that has seen the opening and knows the grove (the map works).
  await page.addInitScript(() => { try { localStorage.setItem('moss-and-bell/save', JSON.stringify({ v: 7, opened: true, places: ['home_valley', 'bamboo_grove'], at: { place: '', x: 0, z: 0 } })); } catch { /* fine */ } });
  await page.goto(`${file}?look=lanternfallplus`);
  await page.waitForFunction(() => window.__mb && window.__mb.fps > 0, null, { timeout: 240000 });
  if (ser.pre) await page.evaluate((code) => { const mb = window.__mb; eval(code); }, ser.pre);
  if (ser.place) {
    await page.evaluate((id) => window.__mb.travel(id), ser.place);
    await page.waitForFunction((id) => window.__mb.place === id && !window.__mb.travelling, ser.place, { timeout: 300000, polling: 500 });
  }
  if (ser.js) await page.evaluate((code) => { const mb = window.__mb; eval(code); }, ser.js);
  for (const x of shots) {
    await page.evaluate((code) => { const mb = window.__mb; eval(code); }, x.js);
    // Let the camera, mist and particles settle (software GL runs at a few fps).
    await page.waitForTimeout(9000);
    const out = path.join(outDir, `${x.name}.jpg`);
    await page.screenshot({ path: out, type: 'jpeg', quality: 80, timeout: 300000 });
    console.log(`${errors.length ? 'ERR ' : 'ok  '} ${path.relative(process.cwd(), out)}`);
    for (const e of errors.splice(0)) console.log('   ', e);
  }
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const ser of SERIES) await series(browser, ser);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
