/**
 * Reading exact pixels back out of a rendered reference — the step that turns
 * "close to Godot" into a number.
 */

import { PNG } from 'pngjs';

/**
 * Read back the colour at each probe. `patch` (odd, default 1) samples a
 * square of that side centred on the coordinate and returns the per-channel
 * MEDIAN.
 *
 * A single pixel is not a safe sample across two renderers: ours composites
 * through an antialiased canvas while these references render MSAA-off, so one
 * pixel anywhere near an edge, a silhouette or a shadow boundary carries a
 * blend weight that exists on one side only. The median (not the mean) also
 * discards a stray outlier outright instead of averaging it in.
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
