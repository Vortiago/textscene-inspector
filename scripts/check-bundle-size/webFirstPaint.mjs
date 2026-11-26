import { gzipSync } from 'node:zlib';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT, formatKb } from './paths.mjs';
import { CHUNK_GRAPH_FILE } from '../../apps/textscene-web/scripts/chunkGraph.mjs';

const WEB_DIST = join(REPO_ROOT, 'apps/textscene-web/dist');

// Growth inside the ceiling is invisible in a PASS line, so the report reads it against the last measure.
const MEASURED_GZ = 1_324_801;
// A change that outgrows it, with no shrink found, raises it by its measured growth (ADR-0090).
const BUDGET_GZ = 1_324_801;

// Modules no dynamic import() reaches itself that must stay out of a first paint: the tables
// behind the area light's LTC textures and the noise jobs' `fastnoise-lite`.
const LAZY_LEAF_RE = /\/ltcTable\.generated\.js$|\/node_modules\/fastnoise-lite\//;

/** The chunks a first paint loads: each entry and its static imports. */
export function firstPaintChunks({ chunks }) {
  const byName = new Map(chunks.map((chunk) => [chunk.fileName, chunk]));
  const loaded = new Set(chunks.filter((chunk) => chunk.isEntry).map((chunk) => chunk.fileName));
  for (const fileName of loaded) for (const imported of byName.get(fileName).imports) loaded.add(imported);
  return [...loaded].map((fileName) => byName.get(fileName));
}

/** The modules of `paintChunks` that load only on demand: each dynamic import() target and each lazy leaf. */
export function findEagerLazyOnlyModules(graph, paintChunks) {
  const targets = new Set(graph.dynamicTargets);
  return paintChunks.flatMap(({ modules }) =>
    modules.filter((id) => targets.has(id) || LAZY_LEAF_RE.test(id))
  );
}

/** @returns {'ok' | 'over-budget' | 'missing-build' | 'eager-lazy-only'} */
export function checkWebFirstPaint() {
  const graphPath = join(WEB_DIST, CHUNK_GRAPH_FILE);
  if (!existsSync(graphPath)) {
    console.error(`\n[bundle-size] chunk graph not found: ${graphPath}`);
    console.error('[bundle-size] run `pnpm --filter @textscene/web-previewer build` first');
    return 'missing-build';
  }
  const graph = JSON.parse(readFileSync(graphPath, 'utf8'));
  const paintChunks = firstPaintChunks(graph);

  const eager = findEagerLazyOnlyModules(graph, paintChunks);
  if (eager.length > 0) {
    console.error(
      `[bundle-size] FAIL: ${eager.length} module(s) loaded only on demand are in the first paint:`
    );
    for (const id of eager) console.error(`  ${id}`);
    return 'eager-lazy-only';
  }

  const totalGz = paintChunks.reduce(
    (sum, { fileName }) => sum + gzipSync(readFileSync(join(WEB_DIST, fileName))).length,
    0
  );
  const sinceMeasured = totalGz - MEASURED_GZ;
  console.log(`\n=== Web previewer first paint (${paintChunks.length} scripts) ===`);
  console.log(`Gzipped:          ${formatKb(totalGz)}  (${totalGz} B)`);
  console.log(`Last measured:    ${formatKb(MEASURED_GZ)}  (${MEASURED_GZ} B)`);
  console.log(
    `Growth since:     ${sinceMeasured >= 0 ? '+' : ''}${formatKb(sinceMeasured)}  (${sinceMeasured} B)`
  );
  console.log(`Budget absolute:  ${formatKb(BUDGET_GZ)}  (${BUDGET_GZ} B)`);
  if (totalGz > BUDGET_GZ) {
    console.error(`[bundle-size] FAIL: the first paint is ${formatKb(totalGz - BUDGET_GZ)} OVER the budget.`);
    return 'over-budget';
  }
  console.log(`[bundle-size] PASS: ${formatKb(BUDGET_GZ - totalGz)} headroom under budget.`);
  return 'ok';
}
