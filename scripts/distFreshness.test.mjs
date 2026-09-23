/**
 * The freshness gate, from literal buildinfo JSON and synthetic package roots,
 * not a `tsc` run: the cases that matter are rare in a real run, and invoking
 * the compiler would move the repo's own stamp.
 */

import { afterAll, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { BUILD, newest, stalenessMessage } from './distFreshness.mjs';

const OLD = 1_600_000_000;
const MID = 1_650_000_000;
const NEW = 1_700_000_000;

const scratch = [];

afterAll(() => {
  for (const root of scratch) rmSync(root, { recursive: true, force: true });
});

/** A clean `tsc --build` record: no file carries diagnostics. */
const CLEAN_BUILD = { fileNames: [], semanticDiagnosticsPerFile: [] };

/**
 * Synthetic package root with dictated mtimes.
 *
 * @param files - relative path → mtime in epoch seconds.
 * @param record - what `tsconfig.tsbuildinfo` contains, when the case is about
 *   tsc's own record rather than about mtimes. Its shape is load-bearing: the
 *   stamp's mtime alone cannot tell a clean build from a failed one.
 */
function datedCore(files, record = CLEAN_BUILD) {
  const root = mkdtempSync(join(tmpdir(), 'dist-freshness-'));
  scratch.push(root);
  for (const [rel, mtime] of Object.entries(files)) {
    const path = join(root, ...rel.split('/'));
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, rel === 'tsconfig.tsbuildinfo' ? JSON.stringify(record) : '');
    utimesSync(path, mtime, mtime);
  }
  return root;
}

/**
 * A core whose dist is genuinely current, plus whatever the case adds to the
 * record.
 *
 * The counterpart to `datedCore`: a case about the RECORD wants real mtimes in
 * a passing arrangement, so the only thing under test is what the record says.
 */
function currentCore(record) {
  const core = mkdtempSync(join(tmpdir(), 'dist-freshness-'));
  scratch.push(core);
  mkdirSync(join(core, 'src'));
  mkdirSync(join(core, 'dist'));
  writeFileSync(join(core, 'src/a.ts'), 'export const a = 1;\n');
  writeFileSync(join(core, 'dist/a.js'), 'export const a = 1;\n');
  writeFileSync(
    join(core, 'tsconfig.tsbuildinfo'),
    JSON.stringify({ fileNames: ['./src/a.ts'], fileInfos: [], ...record })
  );
  // The stamp must postdate the source, which is what a real build guarantees
  // and what a same-second write does not.
  const past = new Date(Date.now() - 60_000);
  utimesSync(join(core, 'src/a.ts'), past, past);
  return core;
}

describe('newest', () => {
  it('reports the newest kept file and its path, from any depth', () => {
    const root = datedCore({
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
    const root = datedCore({
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
    // `failed` marks an unreadable tree, whose 0 would otherwise compare as
    // older than the stamp and pass.
    expect(newest(join(datedCore({}), 'absent'), () => true)).toEqual({
      at: 0,
      file: '',
      failed: true,
    });
    expect(newest(datedCore({ 'note.txt': OLD }), (n) => n.endsWith('.js'))).toEqual({
      at: 0,
      file: '',
      failed: false,
    });
  });
});

describe('stalenessMessage', () => {
  it('passes a build stamp that postdates every source', () => {
    const root = datedCore({
      'dist/index.js': MID,
      'tsconfig.tsbuildinfo': NEW,
      'src/parser/TscnParser.ts': MID,
    });

    expect(stalenessMessage(root)).toBeNull();
  });

  it('passes on a fresh stamp even when every emitted file predates the sources', () => {
    // Incremental `tsc` leaves an unchanged output untouched, so the newest
    // emitted `.js` would make the printed remedy unable to clear the complaint.
    const root = datedCore({
      'dist/index.js': OLD,
      'dist/core/nodes.js': OLD,
      'src/index.ts': MID,
      'tsconfig.tsbuildinfo': NEW,
    });

    expect(stalenessMessage(root)).toBeNull();
  });

  it('passes on a newer test kit, which the program does not contain', () => {
    // `**/*.testkit.ts` is in the package tsconfig's `exclude`, so `tsc --build`
    // no-ops and a complaint about one could never be cleared.
    const root = datedCore({
      'dist/index.js': MID,
      'tsconfig.tsbuildinfo': MID,
      // A compiled source too, and OLDER than the stamp: without it the walk
      // finds no subject and complains for an unrelated reason.
      'src/index.ts': OLD,
      'src/nodes/3d/meshinstance3d/arrayMeshSurfaces.testkit.ts': NEW,
    });

    expect(stalenessMessage(root)).toBeNull();
  });

  it('reports a source newer than the stamp, naming it and the remedy', () => {
    const root = datedCore({
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
    const root = datedCore({
      'dist/index.js': OLD,
      'tsconfig.tsbuildinfo': MID,
      'src/index.ts': OLD,
      'src/nodes/2d/line2d/parser.ts': NEW,
    });

    expect(stalenessMessage(root)).toContain(join('src', 'nodes', '2d', 'line2d', 'parser.ts'));
  });

  it('counts a .tsx source', () => {
    const root = datedCore({
      'dist/index.js': OLD,
      'tsconfig.tsbuildinfo': MID,
      'src/r3f/Scene.tsx': NEW,
    });

    expect(stalenessMessage(root)).toContain(join('src', 'r3f', 'Scene.tsx'));
  });

  it('ignores the sources tsc does not emit', () => {
    const root = datedCore({
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
    // Two input shapes, one message: no `dist/` at all (the contributor who has
    // never built) and a `dist/` holding no emit.
    const neverBuilt = datedCore({ 'tsconfig.tsbuildinfo': NEW, 'src/index.ts': OLD });
    const noJs = datedCore({
      'dist/index.d.ts': NEW,
      'tsconfig.tsbuildinfo': NEW,
      'src/index.ts': OLD,
    });
    const staleBuild = datedCore({
      'dist/index.js': OLD,
      'tsconfig.tsbuildinfo': MID,
      'src/index.ts': NEW,
    });

    const notBuilt = `packages/textscene-core/dist is not built — run \`${BUILD}\`.`;
    expect(stalenessMessage(neverBuilt)).toBe(notBuilt);
    expect(stalenessMessage(noJs)).toBe(notBuilt);
    expect(stalenessMessage(staleBuild)).toContain('predates');
  });

  it('accepts emit that only exists in nested dist directories', () => {
    const root = datedCore({
      'dist/core/nodes/index.js': OLD,
      'tsconfig.tsbuildinfo': NEW,
      'src/index.ts': MID,
    });

    expect(stalenessMessage(root)).toBeNull();
  });

  it('reports a missing tsconfig.tsbuildinfo as its own remedy', () => {
    const root = datedCore({ 'dist/index.js': NEW, 'src/index.ts': OLD });

    expect(stalenessMessage(root)).toBe(
      `packages/textscene-core has no readable tsconfig.tsbuildinfo — run \`${BUILD}\`.`
    );
  });

  it('refuses a stamp written by a build that did not typecheck', () => {
    // tsc writes the stamp whether or not the build succeeded, so its mtime
    // says only that tsc ran. `semanticDiagnosticsPerFile` carries an array per
    // file it recorded errors against, which is the engine's own answer.
    const root = datedCore(
      { 'dist/index.js': MID, 'tsconfig.tsbuildinfo': NEW, 'src/index.ts': MID },
      {
        fileNames: ['./src/broken.ts'],
        semanticDiagnosticsPerFile: [[1, [{ messageText: 'Cannot find name', code: 2304 }]]],
      }
    );

    expect(stalenessMessage(root)).toContain('last built with type errors (./src/broken.ts)');
  });

  it('reports a build that ended in type errors before the mtime complaint', () => {
    // Precedence, and the ARRAY FORM as the signal: an empty diagnostics array
    // still means tsc recorded against that file. The source here is newer than
    // the stamp, so the "predates" message is available and has to lose.
    const root = datedCore(
      { 'dist/index.js': OLD, 'tsconfig.tsbuildinfo': MID, 'src/index.ts': NEW },
      { fileNames: ['./src/index.ts'], semanticDiagnosticsPerFile: [[1, []]] }
    );

    expect(stalenessMessage(root)).toContain('last built with type errors');
  });

  it('passes a stamp whose diagnostics list holds only clean file ids', () => {
    // A bare id means "checked, no errors"; only the array form is a failure.
    const root = datedCore(
      { 'dist/index.js': MID, 'tsconfig.tsbuildinfo': NEW, 'src/index.ts': MID },
      { fileNames: ['./src/index.ts'], semanticDiagnosticsPerFile: [1] }
    );

    expect(stalenessMessage(root)).toBeNull();
  });

  it('refuses a stamp a --noEmit run wrote, however fresh its mtime', () => {
    // `pnpm type-check` rewrites the same record a build does, so the stamp
    // alone reads as newer than every source.
    const message = stalenessMessage(
      currentCore({ affectedFilesPendingEmit: [[1, 1]], emitSignatures: [1] }),
      'this ledger'
    );
    expect(message).toContain('type-check rather than a build');
    // The literal, not `${BUILD}`: every other case here is BUILD-relative, so
    // this is the one place a wrong remedy command shows up.
    expect(message).toContain('pnpm --filter @textscene/core build');
  });

  it('refuses a build whose source has since been deleted', () => {
    // Unlinking a file bumps no mtime under `src`, so the stamp comparison is
    // blind to it and a dist still carrying the removed slice's registration
    // reads fresh forever.
    const root = datedCore(
      { 'dist/index.js': MID, 'tsconfig.tsbuildinfo': NEW, 'src/index.ts': MID },
      { fileNames: ['./src/index.ts', './src/nodes/gone/parser.ts'], semanticDiagnosticsPerFile: [] }
    );

    expect(stalenessMessage(root)).toContain('./src/nodes/gone/parser.ts, which no longer exists');
  });

  it('does not mistake a deleted TEST file for a stale build', () => {
    // tsc never emitted it, so its absence dates nothing.
    const root = datedCore(
      { 'dist/index.js': MID, 'tsconfig.tsbuildinfo': NEW, 'src/index.ts': MID },
      {
        fileNames: ['./src/index.ts', './src/nodes/gone/parser.test.ts'],
        semanticDiagnosticsPerFile: [],
      }
    );

    expect(stalenessMessage(root)).toBeNull();
  });

  it('refuses to answer when the source tree cannot be walked', () => {
    // Returning 0 for an unreadable tree reads as "older than the stamp" and
    // passes the guard over a walk that never ran.
    const absent = datedCore({ 'dist/index.js': MID, 'tsconfig.tsbuildinfo': NEW });
    expect(stalenessMessage(absent)).toContain('could not be walked');

    // Present but holding nothing tsc compiles is a different complaint: the
    // walk worked and there is simply no subject to measure against.
    const empty = datedCore({
      'dist/index.js': MID,
      'tsconfig.tsbuildinfo': NEW,
      'src/notes.md': OLD,
    });
    expect(stalenessMessage(empty)).toContain('no compiled sources');
  });
});
