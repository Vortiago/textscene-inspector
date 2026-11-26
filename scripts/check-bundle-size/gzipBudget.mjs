import { formatKb } from './paths.mjs';

/**
 * Prints a gzipped size against its last measure and its ceiling, and whether it fits.
 *
 * @param {string} title
 * @param {{ gz: number, raw?: number }} size the gzipped size, and the raw size when one file holds it
 * @param {{ measured: number, budget: number }} ceiling
 * @param {boolean} enforce whether an over-budget size is an error or a warning
 * @returns {boolean} whether the size is over the ceiling
 */
export function reportGzipBudget(title, { gz: totalGz, raw }, { measured, budget }, enforce) {
  const sinceMeasured = totalGz - measured;
  console.log(`\n=== ${title} ===`);
  if (raw !== undefined) console.log(`Raw:              ${formatKb(raw)}  (${raw} B)`);
  console.log(`Gzipped:          ${formatKb(totalGz)}  (${totalGz} B)`);
  console.log(`Last measured:    ${formatKb(measured)}  (${measured} B)`);
  console.log(
    `Growth since:     ${sinceMeasured >= 0 ? '+' : ''}${formatKb(sinceMeasured)}  (${sinceMeasured} B)`
  );
  console.log(`Budget absolute:  ${formatKb(budget)}  (${budget} B)`);

  const overBudget = totalGz - budget;
  if (overBudget <= 0) {
    console.log(`[bundle-size] PASS: ${formatKb(-overBudget)} headroom under budget.`);
    return false;
  }
  const msg = `[bundle-size] FAIL: ${formatKb(overBudget)} OVER the budget (gzipped ${totalGz} > ${budget}).`;
  if (enforce) console.error(msg);
  else console.warn(`[bundle-size] WARN: ${msg} (informational; pass --enforce to fail)`);
  return true;
}
