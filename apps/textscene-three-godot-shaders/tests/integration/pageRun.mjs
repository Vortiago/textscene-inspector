/**
 * One probe on the probe page: its transpiled function's result bits on a real GL context, or
 * the transpiler's refusal. A random program is a probe too, so both runs call this.
 */

import { parameterBits } from '../../../../scripts/godot-probes/probeShader.mjs';

/** The page's answer for `probe`: `{ bits }`, one per result lane, or `{ error }`. */
export function runOnPage(page, probe) {
  const spec = { source: probe.source, rows: probe.inputs.length, parameters: parameterBits(probe) };
  return page.evaluate((each) => globalThis.runProbe(each), spec);
}
