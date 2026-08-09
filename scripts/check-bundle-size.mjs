#!/usr/bin/env node
/**
 * Bundle-size guards for the VS Code extension:
 *
 * 1. The webview's initial-paint chunk (700 kB gzipped budget, see
 *    `check-bundle-size/webviewBudget.mjs` — the repo's `check:bundle-size`
 *    script passes `--enforce`, so validate/pre-push/CI hard-fail when it is
 *    exceeded).
 * 2. The extension HOST bundles (`dist/extension.js` / `extension.web.js`),
 *    which must never bundle `react`/`three` (hard invariant — see
 *    `check-bundle-size/hostBundles.mjs`).
 *
 * Run modes:
 *   node scripts/check-bundle-size.mjs            # webview budget informational; host guard always hard-fails
 *   node scripts/check-bundle-size.mjs --enforce  # webview budget also exits 1 if over budget (hard-fail)
 *
 * The repo's `pnpm check:bundle-size` script (package.json) passes
 * `--enforce`, so validate / pre-push / CI all hard-fail on a webview
 * budget breach.
 *
 * The parts live in `check-bundle-size/`: `paths` (where dist/ is),
 * `hostBundles` (the React/THREE invariant) and `webviewBudget` (the
 * closure walk and the gzipped ceiling).
 */

import { pathToFileURL } from 'node:url';
import { checkHostBundles } from './check-bundle-size/hostBundles.mjs';
import { checkWebviewBudget } from './check-bundle-size/webviewBudget.mjs';

// Re-exported for `check-bundle-size.test.mjs`, which unit-tests the pure
// token/metafile scanners through this entry point.
export { findForbiddenHostInputs, findHostBundleViolations } from './check-bundle-size/hostBundles.mjs';

function main() {
  const enforce = process.argv.includes('--enforce');

  // The host-bundle guard is a binary invariant (never gated behind
  // --enforce) and independent of the webview build, so it runs first and
  // unconditionally regardless of whether the webview has been built.
  const hostOk = checkHostBundles();
  const webview = checkWebviewBudget(enforce);

  // The host-bundle guard always hard-fails; the webview budget only
  // hard-fails in --enforce mode. A missing webview build is not itself a
  // failure — nothing was measured — but --enforce callers expect a built
  // webview, so it fails for them.
  if (webview === 'missing-entry') process.exit(!hostOk || enforce ? 1 : 0);
  if (webview === 'dead-chunks') process.exit(1);
  if (!hostOk || (webview === 'over-budget' && enforce)) process.exit(1);
}

// Only run when executed directly (`node scripts/check-bundle-size.mjs`),
// not when imported by `check-bundle-size.test.mjs` for its pure functions.
// `pathToFileURL` (rather than a manual `file://` template) is required for
// this comparison to hold on Windows, where `process.argv[1]` is a
// `C:\...`-style path, not a POSIX one.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
