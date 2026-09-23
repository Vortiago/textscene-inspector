/**
 * Builds the previewer, and refuses to capture from a bundle that does not contain the sources
 * under test.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { newestMtime } from '../../newestMtime.mjs';
import { REPO_ROOT, WEB_DIST_INDEX } from './paths.mjs';

const SKIP_BUILD_VALUES = new Set(['1', 'true', 'yes']);

/**
 * Only files that can reach the bundle count. Tests, sheets and fixtures in `src/` never reach
 * vite, and a guard that fires after a test-only edit is one people learn to bypass.
 */
const BUNDLED_FILE = /\.(ts|tsx|js|jsx|css|json)$/;
const NOT_BUNDLED = /\.(test|spec|contract)\.[jt]sx?$/;

/** Reaches the bundle, so an edit to it must reach `dist/` too. */
const isBundled = (name) => BUNDLED_FILE.test(name) && !NOT_BUNDLED.test(name);

/** A scene, resource, texture or script the corpus ships: anything but docs. */
const isCorpusInput = (name) => !name.endsWith('.md');

/** The test kit vite never bundles, excluded the way `distFreshness.mjs` does. */
const notTesting = (name) => name !== 'testing';

/** Every tree whose edits must reach `dist/`, with what counts as an input. */
const BUNDLED_TREES = [
  // The app bundles core from its built `dist/`, so a core edit needs two builds, and either can be
  // skipped without an error.
  { dir: 'packages/textscene-core/src', keep: isBundled, enterDir: notTesting },
  { dir: 'apps/textscene-web/src', keep: isBundled, enterDir: notTesting },
  // `copy-fixtures` stages `scenes/` into `public/fixtures/` at `prebuild`. After an unbuilt edit
  // the deep link still resolves, so the old scene passes and `--update` commits it. `public/` is
  // not walked: its mtimes are stage times, which `predev` moves. `scenes/games/` is deploy-only.
  { dir: 'scenes', keep: isCorpusInput, enterDir: (name) => name !== 'games' },
];

/**
 * Single-file inputs: vite's entry document, the build config, and the script that decides which
 * of `scenes/` reaches `public/`.
 */
const BUNDLED_FILES = [
  'apps/textscene-web/index.html',
  'apps/textscene-web/vite.config.ts',
  'apps/textscene-web/scripts/copy-fixtures.js',
];

/** Refuses the capture, naming the input the bundle predates. */
function refuseStale(file) {
  console.error(
    `[preview] dist/ predates ${relative(REPO_ROOT, file)} — this capture would ` +
      `reflect the PREVIOUS revision, not your change.\n` +
      `[preview] rebuild: pnpm --filter @textscene/core build && ` +
      `pnpm --filter @textscene/web-previewer build`
  );
  process.exit(1);
}

/**
 * Refuses to capture from a bundle older than its sources. `prebuild` chains core's build into the
 * app's, but a build that does nothing, one skipped with VISUAL_SKIP_BUILD, or a later edit leaves
 * the previous revision in `dist/`: every scene passes, and a fix under test seems to do nothing.
 */
export function assertWebBuildFresh() {
  if (!existsSync(WEB_DIST_INDEX)) {
    console.error('[preview] no built dist/ to capture from');
    process.exit(1);
  }
  const builtAt = statSync(WEB_DIST_INDEX).mtimeMs;
  for (const { dir, keep, enterDir } of BUNDLED_TREES) {
    const { at, file, failed } = newestMtime(join(REPO_ROOT, dir), keep, enterDir);
    // An incomplete walk reports a low mtime, so `at > builtAt` would read fresh over a directory
    // it never saw.
    if (failed) {
      console.error(`[preview] could not read every source under ${dir}; freshness is unproven`);
      process.exit(1);
    }
    if (at > builtAt) refuseStale(file);
  }
  for (const rel of BUNDLED_FILES) {
    const file = join(REPO_ROOT, rel);
    if (!existsSync(file)) {
      console.error(`[preview] ${rel} is missing; freshness is unproven`);
      process.exit(1);
    }
    if (statSync(file).mtimeMs > builtAt) refuseStale(file);
  }
}

/**
 * Builds the previewer every run: a reused `dist/` passes every scene against stale code, and a
 * new fixture missing from it falls back and bakes a bogus baseline. Set VISUAL_SKIP_BUILD=1 to
 * reuse `dist/` while iterating locally.
 */
export function ensureWebBuilt(log = console.log) {
  const skip = process.env.VISUAL_SKIP_BUILD;
  if (skip !== undefined && !SKIP_BUILD_VALUES.has(skip.trim().toLowerCase())) {
    console.warn(`[preview] VISUAL_SKIP_BUILD="${skip}" not recognised — building anyway`);
  } else if (skip !== undefined && existsSync(WEB_DIST_INDEX)) {
    log('[preview] VISUAL_SKIP_BUILD set — reusing existing dist/');
    // Skipping the build still checks that `dist/` holds the revision under test.
    assertWebBuildFresh();
    return;
  }
  log('[preview] building web previewer…');
  const r = spawnSync('pnpm', ['--filter', '@textscene/web-previewer', 'build'], {
    cwd: REPO_ROOT,
    shell: true,
    stdio: 'inherit',
  });
  if (r.status !== 0) {
    console.error('[preview] web previewer build failed');
    process.exit(1);
  }
  // A build that exits 0 can still leave the old bundle, since an incremental step can do nothing.
  assertWebBuildFresh();
}
