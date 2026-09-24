/**
 * The one definition of "different" that the golden gate and the Godot parity tool share: per
 * channel and per pixel, with no perceptual weighting. pixelmatch's YIQ distance scores a flat grey
 * shift up to about 26/255 as zero pixels at `threshold: 0.1`, and a chroma shift at any size, and
 * it skips pixels it calls antialiasing. So it misses a colour-space, tonemap or lighting change.
 */

import { PNG } from 'pngjs';

/** Weight of the baseline image left visible under the highlight, 0..1. */
const DIFF_BACKDROP_ALPHA = 0.1;

/**
 * Highlight saturation floor, and the excursion that reaches full red. Two renderers disagree on
 * nearly every pixel, so a binary mask would paint the whole frame: saturation carries the
 * magnitude, and the floor keeps a 1/255 pixel visible.
 */
const DIFF_MIN_SATURATION = 0.35;
const DIFF_FULL_DELTA = 32;

/**
 * Compares two PNG buffers. Returns `{ sizeMismatch }` for two different rectangles, whose caller
 * reports the shapes. `diff: true` also paints each pixel `changedPixels` counts red over a faded
 * baseline, saturated by how far it moved, so the picture and the number always agree.
 */
export function compareImages(expectedBuffer, actualBuffer, { diff = false } = {}) {
  const expected = PNG.sync.read(expectedBuffer);
  const actual = PNG.sync.read(actualBuffer);
  if (expected.width !== actual.width || expected.height !== actual.height) {
    return {
      sizeMismatch: {
        expected: { width: expected.width, height: expected.height },
        actual: { width: actual.width, height: actual.height },
      },
    };
  }

  const { width, height } = expected;
  const pixels = width * height;
  const diffImage = diff ? new PNG({ width, height }) : null;
  let changedPixels = 0;
  let maxChannelDelta = 0;
  let channelErrorSum = 0;

  for (let i = 0; i < expected.data.length; i += 4) {
    let pixelDelta = 0;
    for (let c = 0; c < 4; c++) {
      const delta = Math.abs(expected.data[i + c] - actual.data[i + c]);
      if (c < 3) channelErrorSum += delta;
      if (delta > pixelDelta) pixelDelta = delta;
    }
    if (pixelDelta > 0) {
      changedPixels++;
      if (maxChannelDelta < pixelDelta) maxChannelDelta = pixelDelta;
    }
    if (diffImage) writeDiffPixel(diffImage.data, expected.data, i, pixelDelta);
  }

  return {
    width,
    height,
    pixels,
    // Pixels that differ in any channel, alpha included, by 1/255 or more. The count is blind to
    // direction and size, so a 1/255 chroma shift over a whole fill counts the whole fill.
    changedPixels,
    changedPct: pixels === 0 ? 0 : (changedPixels / pixels) * 100,
    // The largest single-channel excursion, alpha included, so a capture that turned partly
    // transparent is reported.
    maxChannelDelta,
    // Mean |Δ| per colour channel, the statistic of Godot-parity arbitration. It leaves out alpha:
    // the captures are opaque, and an identical channel would hide a quarter of the colour error.
    meanChannelError: pixels === 0 ? 0 : channelErrorSum / (pixels * 3),
    diff: diffImage,
  };
}

/** Red where the pixel moved, a faded copy of the baseline where it did not. */
function writeDiffPixel(out, expected, i, delta) {
  if (delta > 0) {
    const saturation =
      DIFF_MIN_SATURATION + (1 - DIFF_MIN_SATURATION) * Math.min(1, delta / DIFF_FULL_DELTA);
    out[i] = 255;
    out[i + 1] = Math.round(255 * (1 - saturation));
    out[i + 2] = out[i + 1];
    out[i + 3] = 255;
    return;
  }
  // Rec. 601 luma, the same greyscale a diff backdrop conventionally uses.
  const luma =
    0.29889531 * expected[i] + 0.58662247 * expected[i + 1] + 0.11448223 * expected[i + 2];
  const faded = 255 + (luma - 255) * DIFF_BACKDROP_ALPHA * (expected[i + 3] / 255);
  out[i] = faded;
  out[i + 1] = faded;
  out[i + 2] = faded;
  out[i + 3] = 255;
}

/** One-line summary of a comparison, in the units the gate asserts on. */
export function formatDelta(result) {
  if (result.sizeMismatch) {
    const { expected, actual } = result.sizeMismatch;
    return `size mismatch: ${expected.width}x${expected.height} vs ${actual.width}x${actual.height}`;
  }
  return (
    `${result.changedPixels} px changed (${result.changedPct.toFixed(3)}%), ` +
    `max ${result.maxChannelDelta}/255, mean ${result.meanChannelError.toFixed(3)}/255`
  );
}
