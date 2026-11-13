/**
 * The verdict of one probe: the translated function's result bits on a real GL context against
 * Godot's record. A lane passes when its bits equal Godot's, or when both are NaN, whose payload
 * GLSL ES 3.00 leaves to the device (section 4.5.1). The tolerance is zero units in the last
 * place: Godot and the page render on the same lavapipe driver.
 */

import { hex } from '../../../../scripts/godot-probes/record.mjs';

/** The distance in units in the last place between two floats' bits, or Infinity across signs. */
export function ulpDistance(a, b) {
  if (a === b) return 0;
  const signA = a >>> 31;
  const signB = b >>> 31;
  const magnitudeA = a & 0x7fffffff;
  const magnitudeB = b & 0x7fffffff;
  if (magnitudeA === 0 && magnitudeB === 0) return Infinity;
  if (signA !== signB) return Infinity;
  return Math.abs(magnitudeA - magnitudeB);
}

function isNaNBits(bits) {
  return (bits & 0x7f800000) === 0x7f800000 && (bits & 0x7fffff) !== 0;
}

/**
 * The verdict of `actual` (the page's answer: `{ bits }` per lane, or `{ error }`) against the
 * record `entry`: `{ passed, lanes, mismatches, maxUlp, detail }`.
 */
export function compareProbe(entry, actual) {
  if (entry === undefined) return failed('no record from Godot');
  if (entry.rejected) {
    return actual.error
      ? { ...failed(`both reject: ${actual.error}`), passed: true }
      : failed('Godot rejects the shader, the translation does not');
  }
  if (actual.error) return failed(actual.error);
  const expected = entry.results.flat().map((text) => Number.parseInt(text, 16));
  if (actual.bits.length !== expected.length) {
    return failed(`expected ${expected.length} lanes, got ${actual.bits.length}`);
  }
  let mismatches = 0;
  let maxUlp = 0;
  let first = '';
  expected.forEach((want, index) => {
    const got = actual.bits[index];
    if (want === got || (isNaNBits(want) && isNaNBits(got))) return;
    mismatches += 1;
    maxUlp = Math.max(maxUlp, ulpDistance(want, got));
    if (!first) first = `lane ${index}: Godot ${hex(want)}, translation ${hex(got)}`;
  });
  return { passed: mismatches === 0, lanes: expected.length, mismatches, maxUlp, detail: first };
}

/** The verdict of a probe that compared no lane. */
const failed = (detail) => ({ passed: false, lanes: 0, mismatches: 0, maxUlp: 0, detail });

/**
 * The coverage verdict: a translated row is one a probe names, and each probe must have a record
 * and pass. Answers one line for each failing probe, with the rows it leaves unproven.
 */
export function coverageFailures(probes, verdicts) {
  return probes
    .filter((probe) => !verdicts.get(probe.name)?.passed)
    .map((probe) => {
      const rows = probe.rows.length === 0 ? 'no row of its own' : probe.rows.join(', ');
      return `${probe.name} (${rows}): ${verdicts.get(probe.name)?.detail ?? 'not run'}`;
    });
}
