/**
 * Bundle-composition report (Phase 5 tooling): groups each emitted chunk's
 * sourcemap sourcesContent bytes by package, so budget regressions name
 * their culprit. Run via `bun run analyze` (builds with sourcemaps first).
 *
 * Numbers are PRE-minification source sizes — an inclusion/ranking signal,
 * not gz truth; always re-measure the real budget with `bun run build`.
 * This is the tool that caught drei Environment's ~196 KB of dead loader
 * paths (EXRLoader+fflate, RGBELoader, gainmap-js) in the stage chunk.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'dist/assets';
const DETAIL_PACKAGES = [
  'three',
  '@react-three/drei',
  'three-stdlib',
  'postprocessing',
  'maath',
  '@monogrid/gainmap-js',
];
const MIN_REPORTED_BYTES = 4096;

for (const file of readdirSync(dir).filter((f) => f.endsWith('.js.map'))) {
  const map = JSON.parse(readFileSync(join(dir, file), 'utf8'));
  const byPackage = new Map();
  map.sources.forEach((source, i) => {
    const content = map.sourcesContent?.[i] ?? '';
    const normalized = source.replace(/\\/g, '/');
    let key;
    if (normalized.includes('node_modules/')) {
      const inside = normalized.split('node_modules/').pop();
      const parts = inside.split('/');
      key = inside.startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0];
      if (DETAIL_PACKAGES.includes(key)) {
        key = `${key} :: ${parts.slice(1, 4).join('/')}`;
      }
    } else {
      key = `(app) ${normalized.split('/').slice(-2).join('/')}`;
    }
    byPackage.set(key, (byPackage.get(key) ?? 0) + content.length);
  });
  const total = [...byPackage.values()].reduce((a, b) => a + b, 0);
  console.log(`\n=== ${file} — ${(total / 1024).toFixed(0)} KB source total ===`);
  [...byPackage.entries()]
    .sort((a, b) => b[1] - a[1])
    .filter(([, size]) => size > MIN_REPORTED_BYTES)
    .forEach(([key, size]) =>
      console.log(`${(size / 1024).toFixed(1).padStart(8)} KB  ${key}`),
    );
}
