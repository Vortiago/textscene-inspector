/** Reads exact pixels back out of a rendered reference. */

import { PNG } from 'pngjs';

/**
 * The colour at each probe: the per-channel median of a `patch`-sided square
 * (odd, default 1). Ours composites through an antialiased canvas and these
 * references are MSAA-off, so one pixel near an edge differs. The median, not
 * the mean, discards an outlier.
 */
export function probePixels(buffer, probes, { patch = 1 } = {}) {
  const png = PNG.sync.read(buffer);
  if (!Number.isInteger(patch) || patch < 1 || patch % 2 === 0) {
    // Non-integer (or NaN, from a bad `--patch`) would set a fractional `reach`
    // and read the buffer at mid-pixel byte offsets, returning garbage.
    throw new Error(`patch must be a positive odd integer, got ${patch}`);
  }
  const reach = (patch - 1) / 2;
  return probes.map(([x, y]) => {
    if (!Number.isInteger(x) || !Number.isInteger(y)) {
      // A fractional coordinate lands the byte index mid-pixel, so the
      // "colour" returned is the tail of one pixel and the head of the next.
      throw new Error(`probe ${x},${y} must be integer pixel coordinates`);
    }
    if (x - reach < 0 || y - reach < 0 || x + reach >= png.width || y + reach >= png.height) {
      throw new Error(
        `probe ${x},${y} (patch ${patch}) falls outside the ${png.width}x${png.height} image`
      );
    }
    const channels = [[], [], []];
    for (let dy = -reach; dy <= reach; dy++) {
      for (let dx = -reach; dx <= reach; dx++) {
        const i = (png.width * (y + dy) + (x + dx)) * 4;
        for (let c = 0; c < 3; c++) channels[c].push(png.data[i + c]);
      }
    }
    return { x, y, rgb: channels.map(median) };
  });
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[(sorted.length - 1) >> 1];
}
