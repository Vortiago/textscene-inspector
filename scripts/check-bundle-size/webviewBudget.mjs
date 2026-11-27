import { gzipSync } from 'node:zlib';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ENTRY, WEBVIEW_DIR, formatKb } from './paths.mjs';

// Growth inside the ceiling is invisible in a PASS line, so the report reads it against the last measure.
const MEASURED_GZ = 2_344_057;
// 1,418 B over the measure (ADR-0090): growth past it is raised here.
const BUDGET_GZ = 2_345_475;

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

  const totalGz = gzipSync(script).length;
  const sinceMeasured = totalGz - MEASURED_GZ;
  console.log('\n=== VS Code webview script ===');
  console.log(`Raw:              ${formatKb(script.length)}  (${script.length} B)`);
  console.log(`Gzipped:          ${formatKb(totalGz)}  (${totalGz} B)`);
  console.log(`Last measured:    ${formatKb(MEASURED_GZ)}  (${MEASURED_GZ} B)`);
  console.log(
    `Growth since:     ${sinceMeasured >= 0 ? '+' : ''}${formatKb(sinceMeasured)}  (${sinceMeasured} B)`
  );
  console.log(`Budget absolute:  ${formatKb(BUDGET_GZ)}  (${BUDGET_GZ} B)`);

  const overBudget = totalGz - BUDGET_GZ;
  if (overBudget > 0) {
    const msg = `[bundle-size] FAIL: the script is ${formatKb(overBudget)} OVER the budget (gzipped ${totalGz} > ${BUDGET_GZ}).`;
    if (enforce) {
      console.error(msg);
    } else {
      console.warn(`[bundle-size] WARN: ${msg} (informational; pass --enforce to fail)`);
    }
    return 'over-budget';
  }
  console.log(`[bundle-size] PASS: ${formatKb(-overBudget)} headroom under budget.`);
  return 'ok';
}
