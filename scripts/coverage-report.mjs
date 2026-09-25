#!/usr/bin/env node
/**
 * Which Godot node types the lenient parser recognises, against ClassDB in
 * `node-catalog.json`, and which are missing: `node scripts/coverage-report.mjs
 * [--json]`. Needs a current `pnpm --filter @textscene/core build`. The r3f
 * registries are not React-free (ADR-0001), so they are out of scope.
 */

import { pathToFileURL } from 'node:url';
import { collectCoverage } from './coverage-report/collect.mjs';
import { parseArgs, report } from './coverage-report/report.mjs';

// Only as a CLI, so an import prints nothing. `pathToFileURL` because argv[1]
// is a path and import.meta.url is a URL.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log('usage: node scripts/coverage-report.mjs [--json]');
  } else {
    report(await collectCoverage(), opts);
  }
}
