import { gzipSync } from 'node:zlib';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from './paths.mjs';
import { reportGzipBudget } from './gzipBudget.mjs';
import { CHUNK_GRAPH_FILE } from '../../apps/textscene-web/scripts/chunkGraph.mjs';

export const WEB_DIST = join(REPO_ROOT, 'apps/textscene-web/dist');

// A change that outgrows a ceiling, with no shrink found, raises it by its growth (ADR-0090).
const CEILINGS = {
  // None: the dev first paint holds the fixture manifest, which grows with each fixture.
  dev: null,
  public: { measured: 1_301_249, budget: 1_301_249 },
};

/** The chunks a first paint loads: each entry and its static imports. */
export function firstPaintChunks({ chunks }) {
  const byName = new Map(chunks.map((chunk) => [chunk.fileName, chunk]));
  const loaded = new Set(chunks.filter((chunk) => chunk.isEntry).map((chunk) => chunk.fileName));
  for (const fileName of loaded) for (const imported of byName.get(fileName).imports) loaded.add(imported);
  return [...loaded].map((fileName) => byName.get(fileName));
}

/** Every module the entry modules reach through static imports alone. */
export function staticClosure({ entryModules, staticImports }) {
  const reached = new Set(entryModules);
  for (const id of reached) for (const imported of staticImports[id] ?? []) reached.add(imported);
  return reached;
}

// A virtual module that no import names, such as `\0rolldown/runtime.js`, is the bundler's own runtime.
const isBundlerRuntime = (id) => id.startsWith('\0');

/** The modules of `paintChunks` that load only on demand: an import() target, or one no import reaches. */
export function findEagerLazyOnlyModules(graph, paintChunks) {
  const targets = new Set(graph.dynamicTargets);
  const reached = staticClosure(graph);
  const isLazyOnly = (id) => targets.has(id) || !(reached.has(id) || isBundlerRuntime(id));
  return paintChunks.flatMap(({ modules }) => modules.filter(isLazyOnly));
}

/**
 * @param {string} dist the web previewer's build output
 * @returns {'ok' | 'over-budget' | 'missing-build' | 'unknown-edition' | 'eager-lazy-only'}
 */
export function checkWebFirstPaint(dist = WEB_DIST) {
  const graphPath = join(dist, CHUNK_GRAPH_FILE);
  if (!existsSync(graphPath)) {
    console.error(`\n[bundle-size] chunk graph not found: ${graphPath}`);
    console.error('[bundle-size] run `pnpm --filter @textscene/web-previewer build` first');
    return 'missing-build';
  }
  const graph = JSON.parse(readFileSync(graphPath, 'utf8'));
  if (!Object.hasOwn(CEILINGS, graph.edition)) {
    console.error(
      `[bundle-size] FAIL: expected a site edition of ${Object.keys(CEILINGS)}, got ${graph.edition}`
    );
    return 'unknown-edition';
  }
  const paintChunks = firstPaintChunks(graph);

  const eager = findEagerLazyOnlyModules(graph, paintChunks);
  if (eager.length > 0) {
    console.error(
      `[bundle-size] FAIL: ${eager.length} module(s) loaded only on demand are in the first paint:`
    );
    for (const id of eager) console.error(`  ${id}`);
    return 'eager-lazy-only';
  }

  const ceiling = CEILINGS[graph.edition];
  if (!ceiling) {
    console.log(`[bundle-size] PASS: the ${graph.edition} first paint loads nothing only on demand.`);
    return 'ok';
  }
  const gz = paintChunks.reduce(
    (sum, { fileName }) => sum + gzipSync(readFileSync(join(dist, fileName))).length,
    0
  );
  const title = `Web previewer first paint, ${graph.edition} edition (${paintChunks.length} scripts)`;
  return reportGzipBudget(title, { gz }, ceiling, true) ? 'over-budget' : 'ok';
}
