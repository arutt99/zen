// Builds the game into one self-contained offline file: dist/index.html.
// The manifest and icon are inlined as data URLs so the single file is installable.
import * as esbuild from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const watch = process.argv.includes('--watch');
const dev = watch || process.argv.includes('--dev');

const dataUrl = (mime, text) => `data:${mime};base64,${Buffer.from(text).toString('base64')}`;

async function assemble(js) {
  const html = await readFile(path.join(root, 'public/index.html'), 'utf8');
  const icon = await readFile(path.join(root, 'public/icon.svg'), 'utf8');
  const iconUrl = dataUrl('image/svg+xml', icon);
  const manifest = JSON.parse(await readFile(path.join(root, 'public/manifest.webmanifest'), 'utf8'));
  manifest.icons = manifest.icons.map((i) => ({ ...i, src: iconUrl }));
  const manifestUrl = dataUrl('application/manifest+json', JSON.stringify(manifest));
  // Escape a closing script tag inside the bundle so the inline script cannot end early.
  const safeJs = js.replace(/<\/script/gi, '<\\/script');
  const out = html
    .replace('<!--MANIFEST-->', `<link rel="manifest" href="${manifestUrl}">`)
    .replace('<!--ICON-->', `<link rel="icon" href="${iconUrl}"><link rel="apple-touch-icon" href="${iconUrl}">`)
    .replace('<script>/*BUNDLE*/</script>', () => `<script>${safeJs}</script>`);
  await mkdir(path.join(root, 'dist'), { recursive: true });
  await writeFile(path.join(root, 'dist/index.html'), out);
  return out.length;
}

const options = {
  entryPoints: [path.join(root, 'src/main.ts')],
  bundle: true,
  format: 'iife',
  target: ['es2020', 'safari15'],
  minify: !dev,
  sourcemap: dev ? 'inline' : false,
  write: false,
  define: { __DEV__: String(dev) },
  logLevel: 'warning',
};

if (watch) {
  const ctx = await esbuild.context({
    ...options,
    plugins: [{
      name: 'assemble',
      setup(b) {
        b.onEnd(async (r) => {
          if (r.errors.length) return;
          const size = await assemble(r.outputFiles[0].text);
          console.log(`[build] dist/index.html ${(size / 1024).toFixed(0)} KB`);
        });
      },
    }],
  });
  await ctx.watch();
  console.log('[build] watching src/ ...');
} else {
  const result = await esbuild.build(options);
  const size = await assemble(result.outputFiles[0].text);
  console.log(`[build] dist/index.html ${(size / 1024).toFixed(0)} KB`);
}
