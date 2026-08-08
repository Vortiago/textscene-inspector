/**
 * How two renders of the same frame are compared — the one definition of
 * "different" shared by the golden gate and the Godot parity tool.
 *
 * ## Why this is not a perceptual metric
 *
 * The obvious library for this (pixelmatch) counts a pixel only when its
 * YIQ-space distance exceeds `35215 * threshold^2`, and it additionally drops
 * pixels its neighbourhood heuristic classifies as antialiasing. Both are
 * wrong for a golden gate:
 *
 *   - The YIQ distance weights luminance 0.5053, in-phase 0.299 and
 *     quadrature 0.114, so at the customary `threshold: 0.1` a FLAT grey shift
 *     of up to ~26/255 scores under the cutoff and is counted as zero pixels —
 *     not "within budget", zero, so no budget is ever consulted. A shift along
 *     a chroma direction stays under it at ANY magnitude, because the distance
 *     depends on the direction of the colour change and not on its size.
 *   - A pixel the antialiasing heuristic claims is an edge is skipped outright,
 *     however far it moved.
 *
 * A gate that cannot see a uniform luminance or chroma shift cannot see the
 * class of regression that moves a whole surface at once — exactly what a
 * colour-space, tonemap, or lighting-scale change does.
 *
 * ## What this measures instead
 *
 * Per-channel, per-pixel, with no perceptual weighting and no heuristics:
 *
 *   - `changedPixels` — pixels differing in ANY channel by ≥ 1/255. This is
 *     the count a golden gate should reason about: it is direction-blind and
 *     magnitude-blind, so a 1/255 chroma shift over a whole fill counts as the
 *     whole fill.
 *   - `maxChannelDelta` — the largest single-channel excursion anywhere.
 *   - `meanChannelError` — mean |Δ| per COLOUR channel over the whole frame,
 *     the statistic Godot-parity arbitration is written in. Alpha is left out
 *     of this one on purpose: our captures are opaque, so averaging a channel
 *     that is identical in both images by construction would quietly report
 *     three quarters of the colour error the two frames actually carry.
 *
 * Alpha IS counted for detection — `changedPixels` and `maxChannelDelta` scan
 * all four channels, so a capture that turned partly transparent while keeping
 * its RGB is reported rather than blended away (which is what a perceptual
 * metric does to it).
 */

import { PNG } from 'pngjs';

/** Weight of the baseline image left visible under the highlight, 0..1. */
const DIFF_BACKDROP_ALPHA = 0.1;

/**
 * Highlight saturation floor, and the excursion that reaches full red.
 *
 * A binary highlight is unreadable for the comparison this module also serves —
 * two different renderers disagree on nearly every pixel, so an all-or-nothing
 * mask paints the whole frame and says nothing about where the real difference
 * is. Saturation carries the magnitude instead; the floor keeps a 1/255 pixel
 * visible, so the picture still shows exactly the set `changedPixels` counts.
 */
const DIFF_MIN_SATURATION = 0.35;
const DIFF_FULL_DELTA = 32;

/**
 * Compare two PNG buffers.
 *
 * Returns `{ sizeMismatch }` when the two frames are not the same rectangle —
 * a comparison of differently sized images has no meaning, and the caller
 * reports the shapes rather than a number.
 *
 * `diff: true` also renders the highlight image: every changed pixel painted
 * red over a faded copy of the baseline, saturated by how far it moved. It
 * highlights exactly the pixels `changedPixels` counts, so the picture and the
 * number can never disagree about which pixels moved.
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
    changedPixels,
    changedPct: pixels === 0 ? 0 : (changedPixels / pixels) * 100,
    maxChannelDelta,
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
