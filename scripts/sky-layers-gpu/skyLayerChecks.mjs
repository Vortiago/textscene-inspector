/**
 * What the sky layer gate requires of the baked layers, judged from the range of each layer's mip
 * that `page.mjs` reads back. Each check returns its first failure, or nothing when the layers pass.
 */

/** A half float holds 11 significant bits, so each pass that rounds may move a value this much. */
const HALF_FLOAT_STEP = 2 ** -11;

/** The downsamples of the chain a filtered layer reads: at most six, as Godot drops two mips. */
const CHAIN_DOWNSAMPLES = 6;

/**
 * How far mip `mip` of layer `layer` may stray from the sky, a step for each pass that wrote it:
 * the octmap, then for a filtered layer the chain and the filter, then each of the layer's own
 * downsamples to that mip.
 */
export function halfFloatTolerance(layer, mip) {
  const filterSteps = layer === 0 ? 0 : CHAIN_DOWNSAMPLES + 1;
  return (1 + filterSteps + mip) * HALF_FLOAT_STEP;
}

/** A sky of one colour filters to that colour, as every filter's weights sum to one. */
export function uniformSkyFailure(name, ranges, radiance) {
  for (const { layer, mip, min, max, nonFinite } of ranges) {
    const at = `${name}, layer ${layer} mip ${mip}`;
    if (nonFinite > 0) return `${at}: expected finite values, found ${nonFinite} that are not`;
    const tolerance = halfFloatTolerance(layer, mip);
    for (let channel = 0; channel < 3; channel += 1) {
      const expected = radiance[channel];
      const found = [min[channel], max[channel]].find(
        (value) => Math.abs(value - expected) > expected * tolerance
      );
      if (found !== undefined)
        return `${at}: expected channel ${channel} at ${expected} in every texel, found ${found}`;
    }
  }
  return undefined;
}

/** No layer is darker than black, though the fast filter weighs some taps below zero. */
export function negativeFailure(name, ranges) {
  for (const { layer, mip, min, nonFinite } of ranges) {
    const at = `${name}, layer ${layer} mip ${mip}`;
    if (nonFinite > 0) return `${at}: expected finite values, found ${nonFinite} that are not`;
    const darkest = Math.min(...min);
    if (darkest < 0) return `${at}: expected no channel below 0, found ${darkest}`;
  }
  return undefined;
}

/** The squared distance between two colours. */
const squaredDistance = (a, b) => a.reduce((sum, channel, index) => sum + (channel - b[index]) ** 2, 0);

/** Each mip of each layer keeps +Y nearer the sky's top colour and -Y nearer its bottom one. */
export function orientationFailure(name, texels, { top, bottom }) {
  for (const { layer, mip, up, down } of texels) {
    const at = `${name}, layer ${layer} mip ${mip}`;
    if (squaredDistance(up, top) >= squaredDistance(up, bottom))
      return `${at}: expected +Y nearer ${top}, found ${up}`;
    if (squaredDistance(down, bottom) >= squaredDistance(down, top))
      return `${at}: expected -Y nearer ${bottom}, found ${down}`;
  }
  return undefined;
}

/** Every failure of the gate's bakes. */
export function skyLayerFailures(samples) {
  return [
    uniformSkyFailure('uniform sky, importance filter', samples.uniformImportance, samples.uniformRadiance),
    uniformSkyFailure('uniform sky, fast filter', samples.uniformFast, samples.uniformRadiance),
    negativeFailure('high-contrast sky, fast filter', samples.highContrastFast),
    orientationFailure('two-colour sky, importance filter', samples.twoColourImportance, samples.twoColours),
    orientationFailure('two-colour sky, fast filter', samples.twoColourFast, samples.twoColours),
  ].filter((failure) => failure !== undefined);
}
