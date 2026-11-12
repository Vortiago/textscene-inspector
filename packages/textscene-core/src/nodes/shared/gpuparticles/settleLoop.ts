/**
 * The steps of the first frame's settle (`particles_storage.cpp:1542-1563`). No THREE and no React.
 */

/** Ceiling on settle steps, as for the CPU settle: a huge `preprocess` would spin for minutes. */
import { MAX_SETTLE_STEPS } from '../cpuparticles/process';

/** The frame times the first frame steps: `while (todo >= 0)` overshoots the last step (`:1559-1563`). */
export function settleFrameDeltas(seconds: number, frameTime: number): number[] {
  const deltas: number[] = [];
  for (let todo = seconds; todo >= 0 && deltas.length < MAX_SETTLE_STEPS; todo -= frameTime) {
    deltas.push(frameTime);
  }
  return deltas;
}
