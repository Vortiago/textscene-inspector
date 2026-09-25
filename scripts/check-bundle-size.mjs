#!/usr/bin/env node
/**
 * Bundle-size guards for the VS Code extension: the webview's initial-paint chunk against a
 * 700 kB gzipped budget (`check-bundle-size/webviewBudget.mjs`), and the host bundles
 * (`dist/extension.js`, `extension.web.js`), which must never bundle `react` or `three`
 * (`check-bundle-size/hostBundles.mjs`). `check-bundle-size/paths.mjs` says where dist/ is.
 */

import { pathToFileURL } from 'node:url';
import { checkHostBundles } from './check-bundle-size/hostBundles.mjs';
import { checkWebviewBudget } from './check-bundle-size/webviewBudget.mjs';

function main() {
  // `--enforce` makes an over-budget webview exit 1. Without it the budget is informational.
  // `pnpm check:bundle-size` passes it, so validate, pre-push and CI fail on a budget breach.
  const enforce = process.argv.includes('--enforce');

  // The host guard is a binary invariant, never behind --enforce, and independent of the
  // webview build, so it runs first whether or not the webview is built.
  const hostOk = checkHostBundles();
  const webview = checkWebviewBudget(enforce);

  // A missing webview build measured nothing, so it fails only --enforce callers, who expect one.
  if (webview === 'missing-entry') process.exit(!hostOk || enforce ? 1 : 0);
  if (webview === 'dead-chunks' || webview === 'unresolved-imports') process.exit(1);
  if (!hostOk || (webview === 'over-budget' && enforce)) process.exit(1);
}

// Only run when executed directly, so importing this entry never exits the importer.
// `pathToFileURL`, not a `file://` template: on Windows `process.argv[1]` is a `C:\...` path.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
