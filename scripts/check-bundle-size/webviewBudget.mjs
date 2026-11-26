import { gzipSync } from 'node:zlib';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ENTRY, WEBVIEW_DIR } from './paths.mjs';
import { reportGzipBudget } from './gzipBudget.mjs';

// Growth inside the ceiling is invisible in a PASS line, so the report reads it against the last measure.
const MEASURED_GZ = 1_798_787;
// A change that outgrows it, with no shrink found, raises it by its measured growth (ADR-0090).
const BUDGET_GZ = 1_798_787;

/** The scripts of `files` beside the entry, each one more request a closed load holds (ADR-0090). */
export function findExtraScripts(files) {
  return files.filter((file) => file.endsWith('.js') && file !== ENTRY);
}

/**
 * The exit code is the caller's: only `main()` sees both the budget and the host guard.
 *
 * @param {boolean} enforce whether an over-budget script is an error or a warning
 * @returns {'ok' | 'over-budget' | 'missing-entry' | 'split-entry'}
 */
export function checkWebviewBudget(enforce) {
  const entryPath = join(WEBVIEW_DIR, ENTRY);
  if (!existsSync(entryPath)) {
    console.error(`\n[bundle-size] entry not found: ${entryPath}`);
    console.error('[bundle-size] run `pnpm --filter textscene-inspector build` first');
    return 'missing-entry';
  }

  const extra = findExtraScripts(readdirSync(WEBVIEW_DIR, { recursive: true }));
  if (extra.length > 0) {
    console.error(`[bundle-size] FAIL: the build writes ${extra.length} script(s) beside ${ENTRY}:`);
    for (const file of extra) console.error(`  ${file}`);
    console.error('[bundle-size] the webview must load as one script file (ADR-0090).');
    return 'split-entry';
  }

  const script = readFileSync(entryPath);

  const size = { gz: gzipSync(script).length, raw: script.length };
  const ceiling = { measured: MEASURED_GZ, budget: BUDGET_GZ };
  if (reportGzipBudget('VS Code webview script', size, ceiling, enforce)) return 'over-budget';
  return 'ok';
}
