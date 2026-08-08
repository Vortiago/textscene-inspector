/**
 * Building the previewer, and refusing to capture from a bundle that does not
 * contain the sources under test.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { REPO_ROOT, WEB_DIST_INDEX } from './paths.mjs';

const SKIP_BUILD_VALUES = new Set(['1', 'true', 'yes']);

/**
 * Sources whose edits must reach the bundle. The app bundles `@textscene/core`
 * from its BUILT `dist/`, so a core edit needs core rebuilt AND the app
 * re-bundled — two steps, either of which can be skipped without any error.
 */
const BUNDLED_SOURCE_DIRS = ['packages/textscene-core/src', 'apps/textscene-web/src'];

/**
 * Only files that can actually end up in the bundle count. Tests, comparison
 * sheets and fixtures live inside `src/` but vite never sees them, so treating
 * them as staleness would make the guard cry wolf after a test-only edit — and a
 * guard that fires on work it cannot be measuring is one people learn to bypass.
 */
const BUNDLED_FILE = /\.(ts|tsx|js|jsx|css|json)$/;
const NOT_BUNDLED = /\.(test|spec|contract)\.[jt]sx?$/;

/** Newest mtime of a bundle-reachable file under `dir`, and which file carries it. */
function newestMtime(dir) {
  let newest = 0;
  let newestFile = '';
  const walk = (d) => {
    let entries;
    try {
      entries = readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = join(d, e.name);
      if (e.isDirectory()) {
        walk(p);
        continue;
      }
      if (!BUNDLED_FILE.test(e.name) || NOT_BUNDLED.test(e.name)) continue;
      const m = statSync(p).mtimeMs;
      if (m > newest) {
        newest = m;
        newestFile = p;
      }
    }
  };
  walk(dir);
  return { newest, newestFile };
}

/**
 * Refuse to capture from a bundle older than the sources it claims to contain.
 *
 * `prebuild` chains core's build into the app's, so the happy path is covered —
 * but a build that no-ops, one skipped via VISUAL_SKIP_BUILD, or a source edited
 * after it all yield a harness that measures the PREVIOUS revision and reports it
 * as fact. That failure is invisible: every scene still passes and a fix under
 * test looks like it changed nothing, which is exactly how it wastes an hour.
 */
export function assertWebBuildFresh() {
  if (!existsSync(WEB_DIST_INDEX)) {
    console.error('[preview] no built dist/ to capture from');
    process.exit(1);
  }
  const builtAt = statSync(WEB_DIST_INDEX).mtimeMs;
  for (const dir of BUNDLED_SOURCE_DIRS) {
    const { newest, newestFile } = newestMtime(join(REPO_ROOT, dir));
    if (newest > builtAt) {
      console.error(
        `[preview] dist/ predates ${relative(REPO_ROOT, newestFile)} — this capture would ` +
          `reflect the PREVIOUS revision, not your change.\n` +
          `[preview] rebuild: pnpm --filter @textscene/core build && ` +
          `pnpm --filter @textscene/web-previewer build`
      );
      process.exit(1);
    }
  }
}

/**
 * Build the previewer every run. Reusing an existing `dist/` is how this
 * harness silently captured a build that predated the change under test —
 * every scene "passed" against stale code, and a newly added fixture was
 * missing from the bundle entirely, so its deep link fell back and baked a
 * bogus baseline. A stale-green visual suite is worse than a slow one; set
 * VISUAL_SKIP_BUILD=1 to reuse `dist/` while iterating locally.
 */
export function ensureWebBuilt(log = console.log) {
  const skip = process.env.VISUAL_SKIP_BUILD;
  if (skip !== undefined && !SKIP_BUILD_VALUES.has(skip.trim().toLowerCase())) {
    console.warn(`[preview] VISUAL_SKIP_BUILD="${skip}" not recognised — building anyway`);
  } else if (skip !== undefined && existsSync(WEB_DIST_INDEX)) {
    log('[preview] VISUAL_SKIP_BUILD set — reusing existing dist/');
    // Opting out of the BUILD is fine; opting out of measuring the right
    // revision is not, so the freshness check still runs.
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
  // A build that exits 0 has not necessarily produced a bundle carrying the
  // sources — an incremental step can no-op. Verify rather than assume.
  assertWebBuildFresh();
}
