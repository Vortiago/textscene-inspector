/** The four counts of a lit surface sweep, over its rows. */

/**
 * The 1/255 rule of ADR-0055: a golden may move by one step of an 8-bit channel when its material
 * switches to the node lit surface.
 */
const ONE_STEP = 1;

/**
 * @param {{ changedPixels?: number, maxChannelDelta?: number, sizeMismatch?: object, failed?: string }[]} rows
 * @returns {{ identical: number, withinOneStep: number, aboveOneStep: number, failed: number }}
 */
export function sweepCounts(rows) {
  const counts = { identical: 0, withinOneStep: 0, aboveOneStep: 0, failed: 0 };
  for (const row of rows) counts[kindOf(row)] += 1;
  return counts;
}

function kindOf(row) {
  if (row.failed !== undefined) return 'failed';
  if (row.sizeMismatch !== undefined || row.maxChannelDelta > ONE_STEP) return 'aboveOneStep';
  return row.changedPixels === 0 ? 'identical' : 'withinOneStep';
}
