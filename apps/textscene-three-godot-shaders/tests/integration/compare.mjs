import { lanesAgree, returnsFloat } from '../../../../scripts/godot-probes/laneAgreement.mjs';
import { hex } from '../../../../scripts/godot-probes/record.mjs';

/** Whether `probe` returns floats, whose NaN lanes agree whatever their bits. */
export const isFloatResult = (probe) => returnsFloat(probe.source);

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

/** The transpiler's refusal of an expression that ends Godot as Godot evaluates it. */
const ABORT_REFUSAL = /aborts on this expression/;

/** A shader Godot rejects passes only on a refusal, one that ends Godot only on a refusal that says so. */
export function compareProbe(entry, actual, isFloatResult = true) {
  if (entry === undefined) return failed('no answer from Godot');
  if (entry.rejected?.stage === 'Godot') {
    return actual.isRefusal && ABORT_REFUSAL.test(actual.error)
      ? { ...failed(`Godot ends, the transpiler refuses: ${actual.error}`), passed: true }
      : failed(`Godot ends on the shader, the transpiler does not say so: ${actual.error ?? 'it draws'}`);
  }
  if (entry.rejected) {
    return actual.isRefusal
      ? { ...failed(`both reject: ${actual.error}`), passed: true }
      : failed(`Godot rejects the shader, the transpiler does not: ${actual.error ?? 'it draws'}`);
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
    if (lanesAgree(want, got, isFloatResult)) return;
    mismatches += 1;
    maxUlp = Math.max(maxUlp, ulpDistance(want, got));
    if (!first) first = `lane ${index}: Godot ${hex(want)}, transpilation ${hex(got)}`;
  });
  return { passed: mismatches === 0, lanes: expected.length, mismatches, maxUlp, detail: first };
}

/** The verdict of a probe that compared no lane. */
const failed = (detail) => ({ passed: false, lanes: 0, mismatches: 0, maxUlp: 0, detail });

/** A listed probe that equals Godot fails too, so the change that fixes it removes its entry. */
export function coverageFailures(probes, verdicts, known) {
  return probes.flatMap((probe) => {
    const verdict = verdicts.get(probe.name);
    const listed = known[probe.name];
    if (verdict?.passed)
      return listed ? [`${probe.name} equals Godot now: remove it from knownProbeDifferences.mjs`] : [];
    if (listed && verdict?.mismatches === listed.lanesOff && verdict.detail === listed.first) return [];
    const rows = probe.rows.length === 0 ? 'no row of its own' : probe.rows.join(', ');
    const failure = `${probe.name} (${rows}): ${verdict?.detail ?? 'not run'}`;
    if (!listed) return [failure];
    const lanes = `${listed.lanesOff} ${listed.lanesOff === 1 ? 'lane' : 'lanes'}`;
    return [`${failure}, where knownProbeDifferences.mjs lists ${lanes} off from ${listed.first}`];
  });
}
