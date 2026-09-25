/** The argument contract, and which fixtures a run covers. */

import { existsSync, readFileSync } from 'node:fs';
import { PLAN } from './paths.mjs';
import { parseCaptureFlags } from '../captureFlags.mjs';

/** The shared side and `--only` flags, plus `--force`, which re-renders an image that exists. */
export function parseArgs(argv) {
  return parseCaptureFlags(argv, ['force']);
}

export function loadPlan(only) {
  if (!existsSync(PLAN)) {
    throw new Error(`No capture plan at ${PLAN} — generate it before capturing.`);
  }
  const plan = JSON.parse(readFileSync(PLAN, 'utf8'));
  const fixtures = only ? plan.distinct.filter((f) => f.includes(only)) : plan.distinct;
  if (fixtures.length === 0) throw new Error(`No fixture matches --only ${only}`);
  return fixtures;
}
