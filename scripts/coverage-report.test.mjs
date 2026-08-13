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
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { collectCoverage } from './coverage-report/collect.mjs';
import { BUILD, newest, requireFreshDist, stalenessMessage } from './distFreshness.mjs';

const CATALOG = join(import.meta.dirname, 'compare-docs/node-catalog.json');
const catalog = JSON.parse(readFileSync(CATALOG, 'utf8'));

const CORE = join(import.meta.dirname, '../packages/textscene-core');

// Both computed in `beforeAll`, never at module scope: the walk reads a tree a
// concurrent `tsc --build` may be writing, and a throw during module evaluation
// surfaces as a vitest collection error instead of the actionable message.
let coverage;

describe('coverage ledger', () => {
  // Fails every assertion below with one actionable message rather than letting
  // them agree with stale data.
  beforeAll(async () => {
    requireFreshDist(CORE, 'this ledger');
    coverage = await collectCoverage();
  }, 60_000);

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

/** A clean `tsc --build` record: no file carries diagnostics. */
const CLEAN_BUILD = { fileNames: [], semanticDiagnosticsPerFile: [] };

/**
 * Synthetic package root.
 *
 * @param files - relative path → mtime in epoch seconds.
 * @param record - what `tsconfig.tsbuildinfo` contains, when the case is about
 *   tsc's own record rather than about mtimes. Its shape is load-bearing now:
 *   the stamp's mtime alone cannot tell a clean build from a failed one.
 */
function fakeCore(files, record = CLEAN_BUILD) {
  const root = mkdtempSync(join(tmpdir(), 'coverage-staleness-'));
  scratch.push(root);
  for (const [rel, mtime] of Object.entries(files)) {
    const path = join(root, ...rel.split('/'));
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, rel === 'tsconfig.tsbuildinfo' ? JSON.stringify(record) : '');
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
      failed: false,
    });
  });

  it('never descends into a testing directory, at any depth', () => {
    const root = fakeCore({
      'kept.ts': OLD,
      'testing/kit.ts': NEW,
      'nodes/2d/testing/fixtures.ts': NEW,
    });

    expect(newest(root, () => true)).toEqual({
      at: OLD * 1000,
      file: join(root, 'kept.ts'),
      failed: false,
    });
  });

  it('separates a directory that does not exist from one that is empty', () => {
    // Collapsing the two returned 0 for a tree that could not be read, and the
    // freshness guard then compared that 0 against the stamp and passed.
    expect(newest(join(fakeCore({}), 'absent'), () => true)).toEqual({
      at: 0,
      file: '',
      failed: true,
    });
    expect(newest(fakeCore({ 'note.txt': OLD }), (n) => n.endsWith('.js'))).toEqual({
      at: 0,
      file: '',
      failed: false,
    });
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
      `packages/textscene-core has no readable tsconfig.tsbuildinfo — run \`${BUILD}\`.`
    );
  });

  it('refuses a stamp written by a build that did not typecheck', () => {
    // tsc writes the stamp whether or not the build succeeded, so its mtime
    // says only that tsc ran. `semanticDiagnosticsPerFile` carries an array per
    // file it recorded errors against, which is the engine's own answer.
    const root = fakeCore(
      { 'dist/index.js': MID, 'tsconfig.tsbuildinfo': NEW, 'src/index.ts': MID },
      {
        fileNames: ['./src/broken.ts'],
        semanticDiagnosticsPerFile: [[1, [{ messageText: 'Cannot find name', code: 2304 }]]],
      }
    );

    expect(stalenessMessage(root)).toContain('last built with type errors (./src/broken.ts)');
  });

  it('passes a stamp whose diagnostics list holds only clean file ids', () => {
    // A bare id means "checked, no errors"; only the array form is a failure.
    const root = fakeCore(
      { 'dist/index.js': MID, 'tsconfig.tsbuildinfo': NEW, 'src/index.ts': MID },
      { fileNames: ['./src/index.ts'], semanticDiagnosticsPerFile: [1] }
    );

    expect(stalenessMessage(root)).toBeNull();
  });

  it('refuses a build whose source has since been deleted', () => {
    // Unlinking a file bumps no mtime under `src`, so the stamp comparison is
    // blind to it and a dist still carrying the removed slice's registration
    // reads fresh forever.
    const root = fakeCore(
      { 'dist/index.js': MID, 'tsconfig.tsbuildinfo': NEW, 'src/index.ts': MID },
      { fileNames: ['./src/index.ts', './src/nodes/gone/parser.ts'], semanticDiagnosticsPerFile: [] }
    );

    expect(stalenessMessage(root)).toContain('./src/nodes/gone/parser.ts, which no longer exists');
  });

  it('does not mistake a deleted TEST file for a stale build', () => {
    // tsc never emitted it, so its absence dates nothing.
    const root = fakeCore(
      { 'dist/index.js': MID, 'tsconfig.tsbuildinfo': NEW, 'src/index.ts': MID },
      { fileNames: ['./src/index.ts', './src/nodes/gone/parser.test.ts'], semanticDiagnosticsPerFile: [] }
    );

    expect(stalenessMessage(root)).toBeNull();
  });

  it('refuses to answer when the source tree cannot be walked', () => {
    // `newestMtime` used to return 0 for an unreadable tree, which read as
    // "older than the stamp" and passed the guard over a walk that never ran.
    const absent = fakeCore({ 'dist/index.js': MID, 'tsconfig.tsbuildinfo': NEW });
    expect(stalenessMessage(absent)).toContain('could not be walked');

    // Present but holding nothing tsc compiles is a different complaint: the
    // walk worked and there is simply no subject to measure against.
    const empty = fakeCore({
      'dist/index.js': MID,
      'tsconfig.tsbuildinfo': NEW,
      'src/notes.md': OLD,
    });
    expect(stalenessMessage(empty)).toContain('no compiled sources');
  });
});
