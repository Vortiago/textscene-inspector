/**
 * The verdict of one probe: the translated function's result bits on a real GL context against
 * Godot's record. A lane passes when its bits equal Godot's, or when both are NaN, whose payload
 * GLSL ES 3.00 leaves to the device (section 4.5.1). The tolerance is zero units in the last
 * place: Godot and the page render on the same lavapipe driver.
 */

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
  if (entry === undefined)
    return { passed: false, lanes: 0, mismatches: 0, maxUlp: 0, detail: 'no record from Godot' };
  if (entry.rejected) {
    return actual.error
      ? { passed: true, lanes: 0, mismatches: 0, maxUlp: 0, detail: `both reject: ${actual.error}` }
      : {
          passed: false,
          lanes: 0,
          mismatches: 0,
          maxUlp: 0,
          detail: 'Godot rejects the shader, the translation does not',
        };
  }
  if (actual.error) return { passed: false, lanes: 0, mismatches: 0, maxUlp: 0, detail: actual.error };
  const expected = entry.results.flat().map((hex) => Number.parseInt(hex, 16));
  if (actual.bits.length !== expected.length) {
    return {
      passed: false,
      lanes: 0,
      mismatches: 0,
      maxUlp: 0,
      detail: `expected ${expected.length} lanes, got ${actual.bits.length}`,
    };
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

const hex = (bits) => bits.toString(16).padStart(8, '0');

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
