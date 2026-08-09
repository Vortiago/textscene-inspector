#!/usr/bin/env node
/**
 * Which Godot node types the previewer recognises, and which are still missing.
 *
 *   node scripts/coverage-report.mjs             # full report
 *   node scripts/coverage-report.mjs --next 5    # the next N types to implement
 *   node scripts/coverage-report.mjs --json      # machine-readable
 *
 * State is DERIVED, never written down: the registered set comes from the live
 * registries in the built package and the universe comes from Godot's own
 * ClassDB via `node-catalog.json`. A long node-coverage push can therefore be
 * resumed from a cold start — run this and it tells you exactly where you are —
 * and no hand-maintained checklist can drift out of sync with the code.
 *
 * Needs a current `pnpm --filter @textscene/core build`. The lenient parser and
 * the linter are React/THREE-free (ADR-0001), so both load in plain Node; the
 * r3f component registries are not, and are deliberately out of scope here.
 * "Registered" means the lenient parser recognises the type, which is the same
 * definition `node-catalog.json` uses for `supported`.
 *
 * The parts live in `coverage-report/`: `collect` (the ledger), `waveOrder`
 * (which type comes next) and `report` (the flags and the printing).
 */

import { pathToFileURL } from 'node:url';
import { collectCoverage } from './coverage-report/collect.mjs';
import { parseArgs, report } from './coverage-report/report.mjs';

// Only report when run as a CLI, so importing this entry never prints a report
// into someone else's output.
// `pathToFileURL` because argv[1] is a path and import.meta.url is a URL.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log('usage: node scripts/coverage-report.mjs [--next <n>] [--json]');
  } else {
    report(await collectCoverage(), opts);
  }
}
