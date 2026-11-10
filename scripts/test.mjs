// Bundles every tests/*.test.ts with esbuild and runs them with node's built-in test runner.
import * as esbuild from 'esbuild';
import { readdir, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outdir = path.join(root, '.test-build');
const files = (await readdir(path.join(root, 'tests'))).filter((f) => f.endsWith('.test.ts'));
await rm(outdir, { recursive: true, force: true });
await esbuild.build({
  entryPoints: files.map((f) => path.join(root, 'tests', f)),
  outdir, bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' },
  define: { __DEV__: 'true' }, logLevel: 'warning',
});
const outs = files.map((f) => path.join(outdir, f.replace(/\.ts$/, '.mjs')));
const r = spawnSync(process.execPath, ['--test', ...outs], { stdio: 'inherit' });
process.exit(r.status ?? 1);
