/**
 * Builds `packages/textscene-core` once, before any vitest project starts, when its dist is stale.
 * The package e2e tests run the same build through each app's `prebuild`, and `tsc --build` rewrites
 * dist files in place. A script test that reads dist during that rewrite fails on a build that is
 * half done. After this build, the nested builds find dist current and write nothing.
 */

import { execSync } from 'node:child_process';
import { BUILD, stalenessMessage } from '../distFreshness.mjs';
import { REPO_ROOT } from '../repoRoot.mjs';

/** Runs the build that the staleness message names. A type error stops the run, with its output visible. */
export function buildCore() {
  execSync(BUILD, { cwd: REPO_ROOT, stdio: 'inherit' });
}

/**
 * Leaves dist current, or throws the staleness message when the build cannot make it so.
 *
 * @param core - the `packages/textscene-core` directory.
 * @param build - the step that rebuilds it.
 */
export function ensureFreshDist(core, build) {
  if (stalenessMessage(core) === null) return;
  build();
  const stale = stalenessMessage(core);
  if (stale) throw new Error(stale);
}
