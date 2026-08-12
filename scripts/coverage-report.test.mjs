/**
 * Guards the coverage ledger against the three ways it could quietly lie.
 *
 * The ledger is the resume point for a long node-coverage push — "what is left"
 * is computed, never written down, so it cannot drift the way a checklist does.
 * That only holds while its notion of "registered" matches the catalog's
 * `supported`, and while the catalog is regenerated after the registry changes.
 *
 * The failure this file exists to prevent already happened: `supported` was a
 * `typeName: '…'` scrape of slice sources, and `StaticBody2D`, `RigidBody2D` and
 * `CharacterBody2D` are registered by a loop with no string literal to match. The
 * catalog called three shipped node types "not implemented" for as long as that
 * scrape lived. Both sides now read the same live registry, and this asserts it.
 *
 * The third way is the build: that live registry is the one in `dist/`, so an
 * unbuilt or out-of-date `dist/` makes every assertion here agree about a
 * previous revision. It is checked first, and refused rather than measured.
 *
 * `pnpm validate` builds before it tests, so that precheck never fires in CI —
 * it guards the local workflow alone. Its own tests therefore run against
 * synthetic package roots under the temp dir, never against the real one.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { collectCoverage } from './coverage-report/collect.mjs';
import { newestMtime } from './newestMtime.mjs';

const CATALOG = join(import.meta.dirname, 'compare-docs/node-catalog.json');
const catalog = JSON.parse(readFileSync(CATALOG, 'utf8'));

const CORE = join(import.meta.dirname, '../packages/textscene-core');
const BUILD = 'pnpm --filter @textscene/core build';

/**
 * `tsc` emits `src/**` minus the tests, the test kit and the ambient
 * declarations, so an edit to those is not staleness: a guard that fires on
 * work it cannot be measuring is one people learn to bypass. Mirrors the
 * package tsconfig's `exclude`.
 */
const COMPILED = /\.tsx?$/;
const NOT_COMPILED = /\.d\.ts$|\.(test|spec)\.tsx?$/;

/** Newest kept file under `dir`; `testing/` is the excluded kit, at any depth. */
const newest = (dir, keep) => newestMtime(dir, keep, (name) => name !== 'testing');

/**
 * The ledger is read from the BUILT registries, so an unbuilt or stale `dist/`
 * has this file reporting a previous revision's coverage as fact — and every
 * assertion still passes. Refuse to measure instead; building here would race
 * the build step that owns `dist/`.
 */
function stalenessMessage(core) {
  if (!newest(join(core, 'dist'), (n) => n.endsWith('.js')).at) {
    return `packages/textscene-core/dist is not built — run \`${BUILD}\`.`;
  }
  // Against tsc's OWN record of when it last evaluated the project, not against
  // the newest emitted `.js`. An incremental build does not rewrite an output
  // whose content did not change, so a no-op regeneration of a source file
  // (`pnpm nodes:catalog` rewriting nodeBaseTypes.generated.ts byte-identically)
  // left every `.js` older than it and no amount of rebuilding could clear the
  // complaint. A guard whose prescribed remedy does not work gets bypassed.
  let stamp;
  try {
    stamp = statSync(join(core, 'tsconfig.tsbuildinfo')).mtimeMs;
  } catch {
    return `packages/textscene-core has no tsconfig.tsbuildinfo — run \`${BUILD}\`.`;
  }
  const source = newest(join(core, 'src'), (n) => COMPILED.test(n) && !NOT_COMPILED.test(n));
  if (source.at > stamp) {
    return (
      `packages/textscene-core/dist predates ${relative(core, source.file)} — this ledger would ` +
      `report the PREVIOUS revision's registries. Run \`${BUILD}\`.`
    );
  }
  return null;
}

const stale = stalenessMessage(CORE);
const coverage = stale ? null : await collectCoverage();

describe('coverage ledger', () => {
  // Fails every assertion below with one actionable message rather than letting
  // them agree with stale data.
  beforeAll(() => {
    if (stale) throw new Error(stale);
  });

  it('agrees with the catalog on which types are supported', () => {
    const catalogSupported = catalog.nodes
      .filter((n) => n.supported)
      .map((n) => n.name)
      .sort();
    // The ledger's registered set spans every type the parser knows; the catalog
    // can only speak for types Godot's ClassDB listed.
    const catalogued = new Set(catalog.nodes.map((n) => n.name));
    const registeredAndCatalogued = coverage.registered.filter((t) => catalogued.has(t)).sort();

    expect(registeredAndCatalogued).toEqual(catalogSupported);
  });

  it('accounts for every catalogued type as registered or missing', () => {
    const missing = coverage.missing.map((n) => n.name);
    const registeredAndCatalogued = coverage.registered.filter((t) =>
      catalog.nodes.some((n) => n.name === t)
    );
    expect(missing.length + registeredAndCatalogued.length).toBe(coverage.total);
  });

  it('has no registration for a type absent from Godot ClassDB', () => {
    // AreaLight3D is the one sanctioned exception and is filtered upstream — see
    // NOT_IN_CLASSDB. Anything else here is a typo in a `typeName`.
    expect(coverage.phantom).toEqual([]);
  });

  it('reports missing types in dependency order — a base class before its subclasses', () => {
    const position = new Map(coverage.missing.map((n, i) => [n.name, i]));
    const inverted = coverage.missing.flatMap((n) =>
      n.chain
        .filter((ancestor) => position.has(ancestor) && position.get(ancestor) > position.get(n.name))
        .map((ancestor) => `${n.name} scheduled before its ancestor ${ancestor}`)
    );
    expect(inverted).toEqual([]);
  });
});

const OLD = 1_600_000_000;
const MID = 1_650_000_000;
const NEW = 1_700_000_000;

const scratch = [];

/** Synthetic package root; `files` maps a relative path to its mtime in epoch seconds. */
function fakeCore(files) {
  const root = mkdtempSync(join(tmpdir(), 'coverage-staleness-'));
  scratch.push(root);
  for (const [rel, mtime] of Object.entries(files)) {
    const path = join(root, ...rel.split('/'));
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, '');
    utimesSync(path, mtime, mtime);
  }
  return root;
}

afterAll(() => {
  for (const root of scratch) rmSync(root, { recursive: true, force: true });
});

describe('newest', () => {
  it('reports the newest kept file and its path, from any depth', () => {
    const root = fakeCore({
      'shallow.js': MID,
      'a/b/c/deep.js': NEW,
      'a/newer.txt': NEW,
    });

    expect(newest(root, (n) => n.endsWith('.js'))).toEqual({
      at: NEW * 1000,
      file: join(root, 'a', 'b', 'c', 'deep.js'),
    });
  });

  it('never descends into a testing directory, at any depth', () => {
    const root = fakeCore({
      'kept.ts': OLD,
      'testing/kit.ts': NEW,
      'nodes/2d/testing/fixtures.ts': NEW,
    });

    expect(newest(root, () => true)).toEqual({ at: OLD * 1000, file: join(root, 'kept.ts') });
  });

  it('reports nothing for a directory that does not exist', () => {
    expect(newest(join(fakeCore({}), 'absent'), () => true)).toEqual({ at: 0, file: '' });
  });
});

describe('dist-freshness precheck', () => {
  it('passes a build stamp that postdates every source', () => {
    const root = fakeCore({
      'dist/index.js': MID,
      'tsconfig.tsbuildinfo': NEW,
      'src/parser/TscnParser.ts': MID,
    });

    expect(stalenessMessage(root)).toBeNull();
  });

  it('passes on a fresh stamp even when every emitted file predates the sources', () => {
    // The property the stamp was chosen for: incremental `tsc` leaves an output
    // whose content did not change untouched, so comparing against the newest
    // emitted `.js` makes the printed remedy unable to clear the complaint.
    const root = fakeCore({
      'dist/index.js': OLD,
      'dist/core/nodes.js': OLD,
      'src/index.ts': MID,
      'tsconfig.tsbuildinfo': NEW,
    });

    expect(stalenessMessage(root)).toBeNull();
  });

  it('reports a source newer than the stamp, naming it and the remedy', () => {
    const root = fakeCore({
      'dist/index.js': NEW,
      'tsconfig.tsbuildinfo': MID,
      'src/index.ts': NEW,
    });

    expect(stalenessMessage(root)).toBe(
      `packages/textscene-core/dist predates ${join('src', 'index.ts')} — this ledger would ` +
        `report the PREVIOUS revision's registries. Run \`${BUILD}\`.`
    );
  });

  it('finds a stale source nested deep in the slice tree', () => {
    const root = fakeCore({
      'dist/index.js': OLD,
      'tsconfig.tsbuildinfo': MID,
      'src/index.ts': OLD,
      'src/nodes/2d/line2d/parser.ts': NEW,
    });

    expect(stalenessMessage(root)).toContain(join('src', 'nodes', '2d', 'line2d', 'parser.ts'));
  });

  it('counts a .tsx source', () => {
    const root = fakeCore({
      'dist/index.js': OLD,
      'tsconfig.tsbuildinfo': MID,
      'src/r3f/Scene.tsx': NEW,
    });

    expect(stalenessMessage(root)).toContain(join('src', 'r3f', 'Scene.tsx'));
  });

  it('ignores the sources tsc does not emit', () => {
    const root = fakeCore({
      'dist/index.js': OLD,
      'tsconfig.tsbuildinfo': MID,
      'src/index.ts': OLD,
      'src/parser/TscnParser.test.ts': NEW,
      'src/r3f/Scene.test.tsx': NEW,
      'src/linter/rules.spec.ts': NEW,
      'src/r3f/Scene.spec.tsx': NEW,
      'src/types/ambient.d.ts': NEW,
      'src/testing/kit.ts': NEW,
      'src/nodes/2d/testing/fixtures.ts': NEW,
      'src/nodes/2d/line2d/comparison.md': NEW,
    });

    expect(stalenessMessage(root)).toBeNull();
  });

  it('reports an unbuilt dist distinctly from a stale one', () => {
    const noJs = fakeCore({
      'dist/index.d.ts': NEW,
      'tsconfig.tsbuildinfo': NEW,
      'src/index.ts': OLD,
    });
    const staleBuild = fakeCore({
      'dist/index.js': OLD,
      'tsconfig.tsbuildinfo': MID,
      'src/index.ts': NEW,
    });

    expect(stalenessMessage(noJs)).toBe(
      `packages/textscene-core/dist is not built — run \`${BUILD}\`.`
    );
    expect(stalenessMessage(staleBuild)).toContain('predates');
  });

  it('accepts emit that only exists in nested dist directories', () => {
    const root = fakeCore({
      'dist/core/nodes/index.js': OLD,
      'tsconfig.tsbuildinfo': NEW,
      'src/index.ts': MID,
    });

    expect(stalenessMessage(root)).toBeNull();
  });

  it('reports a missing tsconfig.tsbuildinfo as its own remedy', () => {
    const root = fakeCore({ 'dist/index.js': NEW, 'src/index.ts': OLD });

    expect(stalenessMessage(root)).toBe(
      `packages/textscene-core has no tsconfig.tsbuildinfo — run \`${BUILD}\`.`
    );
  });
});
