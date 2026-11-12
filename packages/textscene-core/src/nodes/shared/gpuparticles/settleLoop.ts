/** The steps of the first frame's settle (`particles_storage.cpp:1542-1563`). No THREE and no React. */

/**
 * How many steps of `frameTime` the first frame runs: `while (todo >= 0)` overshoots the last step
 * (`:1559-1563`). The `todo` it subtracts is a double. The caller bounds `seconds`.
 */
export function settleStepCount(seconds: number, frameTime: number): number {
  let steps = 0;
  for (let todo = seconds; todo >= 0; todo -= frameTime) steps++;
  return steps;
}
