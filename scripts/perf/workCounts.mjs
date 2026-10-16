/**
 * A scene's work per frame, as the Performance overlay shows it: the frame's draw calls, and each
 * render step's draw calls and runs. Its budget is the committed work of the same scene.
 */

/**
 * Parses an overlay snapshot: the draws total, and each step row's cells in the overlay's column
 * order (step, CPU ms, GPU ms, draws, runs).
 */
export function parseWorkCounts({ drawCalls, rows }) {
  const steps = {};
  for (const [step, , , stepDrawCalls, runs] of rows) {
    steps[step] = {
      drawCalls: parseCount(stepDrawCalls, `${step} draws`),
      runs: parseCount(runs, `${step} runs`),
    };
  }
  return { drawCalls: parseCount(drawCalls, 'draws total'), steps };
}

function parseCount(text, cell) {
  const count = Number.parseFloat(text);
  if (!Number.isFinite(count)) {
    throw new Error(`expected a count such as "12 draws" in the ${cell}, got "${text}"`);
  }
  return count;
}

/**
 * Each count of `measured` over its count in `budget`, as `overruns`, and each count under it, as
 * `slack`. A step that one side does not list counts zero there.
 */
export function compareToBudget(measured, budget) {
  const measuredCounts = labelledCounts(measured);
  const budgetCounts = labelledCounts(budget);
  const overruns = [];
  const slack = [];
  for (const label of new Set([...measuredCounts.keys(), ...budgetCounts.keys()])) {
    const value = measuredCounts.get(label) ?? 0;
    const limit = budgetCounts.get(label) ?? 0;
    const line = `${label}: ${value}, budget ${limit}`;
    if (value > limit) overruns.push(line);
    else if (value < limit) slack.push(line);
  }
  return { overruns, slack };
}

/** Every count of `work` under the label a report names it by. */
function labelledCounts({ drawCalls, steps }) {
  const counts = new Map([['draw calls', drawCalls]]);
  for (const [step, { drawCalls: stepDrawCalls, runs }] of Object.entries(steps)) {
    counts.set(`${step} draw calls`, stepDrawCalls);
    counts.set(`${step} runs`, runs);
  }
  return counts;
}
