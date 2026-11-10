// Screenshot sets for art checkpoints (plan 7.4): the same views in every look preset, at phone size,
// by day and at dusk, plus the caretaker styles (A4) and building kit styles (A5).
// Usage: node scripts/shots.cjs [outDir] [filter]   (needs Playwright; software GL is slow, be patient)
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');

const file = 'file://' + path.resolve(__dirname, '../dist/index.html');
const outDir = path.resolve(process.argv[2] || path.join(__dirname, '../test-results/shots'));
const filter = process.argv[3] || '';
fs.mkdirSync(outDir, { recursive: true });

/** One view: where the caretaker stands, zoom, time, character, kit, how much of the shelter is built. */
const VIEWS = {
  shelter: { at: [8.4, 0.2], zoom: 0, built: 4 },
  pond: { at: [-6.5, 5.2], zoom: 0, built: 6 },
  wide: { at: [2, 3], zoom: 1, built: 6 },
  close: { at: [-5.6, 6.6], zoom: 0, built: 6, closeup: [0.5, 4.6, 2.9] },
  site: { at: [8.6, -0.4], zoom: 0, built: 6, closeup: [2.6, 5.6, 2.3, 1.5] },
  sitePartial: { at: [8.6, -0.4], zoom: 0, built: 4, closeup: [2.6, 5.6, 2.3, 1.5] },
};

async function shot(browser, name, { look, time, character = 'chibi', kit = 'temple', view = 'shelter', heading }) {
  if (filter && !name.includes(filter)) return;
  const v = VIEWS[view];
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${file}?look=${look}`);
  await page.waitForFunction(() => window.__mb && window.__mb.fps > 0, null, { timeout: 180000 });
  await page.evaluate(({ v, time, character, kit }) => {
    const mb = window.__mb;
    mb.setCharacter(character);
    mb.setKit(kit);
    mb.deliver('shelter', v.built);
    mb.setTime(time);
    mb.teleport(v.at[0], v.at[1]);
    if (v.zoom) mb.zoom(1);
    if (v.closeup) mb.closeup(...v.closeup);
  }, { v, time, character, kit });
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
  for (const look of ['painted', 'paintedplus', 'lanternfall', 'lanternfallplus', 'woodblock']) {
    for (const time of ['day', 'dusk']) await shot(browser, `look-${look}-${time}`, { look, time });
    await shot(browser, `look-${look}-pond`, { look, time: 'day', view: 'pond' });
  }
  for (const time of ['dawn', 'golden', 'night']) await shot(browser, `time-painted-${time}`, { look: 'painted', time, view: 'wide' });
  // Painted+ (owner request 2026-11-10): the same close views as Painted, side by side.
  for (const look of ['painted', 'paintedplus', 'lanternfall', 'lanternfallplus']) {
    await shot(browser, `plus-${look}-wide`, { look, time: 'day', view: 'wide' });
    await shot(browser, `plus-${look}-close`, { look, time: 'day', view: 'close' });
    await shot(browser, `plus-${look}-kit`, { look, time: 'day', kit: 'temple', view: 'site' });
    await shot(browser, `plus-${look}-kit-partial`, { look, time: 'day', kit: 'temple', view: 'sitePartial' });
    await shot(browser, `plus-${look}-golden`, { look, time: 'golden', view: 'shelter' });
    await shot(browser, `plus-${look}-night`, { look, time: 'night', kit: 'temple', view: 'site' });
  }
  for (const character of ['chibi', 'storybook']) {
    await shot(browser, `caretaker-${character}`, { look: 'painted', time: 'day', character, view: 'close' });
    await shot(browser, `caretaker-${character}-lanternfall`, { look: 'lanternfall', time: 'day', character, view: 'close' });
  }
  for (const kit of ['temple', 'timber']) {
    await shot(browser, `kit-${kit}-partial`, { look: 'painted', time: 'day', kit, view: 'sitePartial' });
    await shot(browser, `kit-${kit}-done`, { look: 'painted', time: 'day', kit, view: 'site' });
    await shot(browser, `kit-${kit}-night`, { look: 'painted', time: 'night', kit, view: 'site' });
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
