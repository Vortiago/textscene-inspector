/**
 * What the sky layer gate requires of the baked layers, judged from the range of each bake that
 * `page.mjs` reads back. Each check returns its failure, or nothing when the layers pass.
 */

/**
 * A half float holds 11 significant bits, and each pass rounds once: the octmap, up to six
 * downsamples and the filter. Eight rounding steps stay under this.
 */
export const HALF_FLOAT_TOLERANCE = 8 * 2 ** -11;

/** A sky of one colour filters to that colour, as every filter's weights sum to one. */
export function uniformSkyFailure(name, range, radiance) {
  if (range.nonFinite > 0)
    return `${name}: expected finite layers, found ${range.nonFinite} values that are not`;
  for (let channel = 0; channel < 3; channel += 1) {
    const expected = radiance[channel];
    for (const found of [range.min[channel], range.max[channel]]) {
      if (Math.abs(found - expected) > expected * HALF_FLOAT_TOLERANCE) {
        return `${name}: expected channel ${channel} at ${expected} in every texel, found ${found}`;
      }
    }
  }
  return undefined;
}

/** No layer is darker than black, though the fast filter weighs some taps below zero. */
export function negativeFailure(name, range) {
  if (range.nonFinite > 0)
    return `${name}: expected finite layers, found ${range.nonFinite} values that are not`;
  const darkest = Math.min(...range.min);
  return darkest < 0 ? `${name}: expected no channel below 0, found ${darkest}` : undefined;
}

/** Every failure of the gate's three bakes. */
export function skyLayerFailures(samples) {
  return [
    uniformSkyFailure('uniform sky, importance filter', samples.uniformImportance, samples.uniformRadiance),
    uniformSkyFailure('uniform sky, fast filter', samples.uniformFast, samples.uniformRadiance),
    negativeFailure('high-contrast sky, fast filter', samples.highContrastFast),
  ].filter((failure) => failure !== undefined);
}
