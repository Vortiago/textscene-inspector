/**
 * Vitest's global setup: builds core once, before any project starts. The package e2e tests run the
 * same build through each app's `prebuild`, and `tsc --build` rewrites dist files in place, so a
 * script test that reads dist mid-rewrite fails on a half-written file. After this build the nested
 * builds find nothing to do. Unconditional, not gated on `stalenessMessage`: an up-to-date build costs
 * about a second, and a gate that disagrees with tsc would let the nested builds write again.
 */
import { execSync } from 'node:child_process';
import { BUILD } from '../distFreshness.mjs';
import { REPO_ROOT } from '../repoRoot.mjs';

export function setup() {
  execSync(BUILD, { cwd: REPO_ROOT, stdio: 'inherit' });
}
