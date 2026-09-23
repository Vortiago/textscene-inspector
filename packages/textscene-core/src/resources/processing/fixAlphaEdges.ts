/**
 * Godot's import-time "fix alpha border" pass on RGBA8 bytes, which reading a raw
 * PNG skips: a bilinear sample bleeds transparent texels' arbitrary RGB into the
 * fringe. `ResourceImporterTexture` runs `Image::fix_alpha_edges()` for every non-3D
 * preset (`editor/import/resource_importer_texture.cpp:253,862`, `process/fix_alpha_border=true`).
 */

/**
 * `core/io/image.cpp Image::fix_alpha_edges`: a texel with alpha at or above
 * this is left alone and is a source of replacement colour. Everything below it
 * is rewritten.
 */
const ALPHA_THRESHOLD = 20;

/** `core/io/image.cpp Image::fix_alpha_edges`: `const int max_radius = 4`. */
const MAX_RADIUS = 4;

/**
 * Rewrite each below-threshold texel's RGB in place with the nearest opaque
 * texel's within `MAX_RADIUS`, leaving alpha untouched. `data` is RGBA8,
 * row-major, top row first. Returns whether any byte changed, so a caller can
 * keep the original image.
 */
export function fixAlphaEdges(data: Uint8Array, width: number, height: number): boolean {
  const opaque = opaqueCounts(data, width, height);
  if (!opaque) return false;

  let changed = false;

  for (let y = 0; y < height; y++) {
    const fromY = Math.max(0, y - MAX_RADIUS);
    const toY = Math.min(height - 1, y + MAX_RADIUS);

    for (let x = 0; x < width; x++) {
      const target = (y * width + x) * 4;
      if (data[target + 3]! >= ALPHA_THRESHOLD) continue;

      const fromX = Math.max(0, x - MAX_RADIUS);
      const toX = Math.min(width - 1, x + MAX_RADIUS);

      // A texel with an all-transparent neighbourhood stays untouched, and in a
      // large transparent region that is every texel. The summed-area table
      // answers "any opaque texel in this box" in constant time, so only texels
      // that find a source pay for the full scan.
      if (boxSum(opaque, width, fromX, fromY, toX, toY) === 0) continue;

      let closestDist = Infinity;
      let source = -1;

      for (let k = fromY; k <= toY; k++) {
        for (let l = fromX; l <= toX; l++) {
          const dy = y - k;
          const dx = x - l;
          const dist = dy * dy + dx * dx;
          if (dist >= closestDist) continue;
          const candidate = (k * width + l) * 4;
          if (data[candidate + 3]! < ALPHA_THRESHOLD) continue;
          closestDist = dist;
          source = candidate;
        }
      }

      if (source < 0) continue;
      // Read straight from `data` rather than the C++'s defensive copy of the
      // whole image: a source is at or above the threshold, so the outer loop
      // skips it and its RGB is never one of the bytes this pass rewrites.
      for (let c = 0; c < 3; c++) {
        if (data[target + c] === data[source + c]) continue;
        data[target + c] = data[source + c]!;
        changed = true;
      }
    }
  }

  return changed;
}

/**
 * Whether every below-threshold texel has an opaque texel within `MAX_RADIUS`.
 * In Godot an unreached texel keeps its RGB, but the premultiplied canvas store
 * has already zeroed it here, so it would turn black. When one exists, the
 * caller keeps the decoded texture.
 */
export function everyTransparentTexelHasASource(
  data: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number
): boolean {
  // `opaqueCounts` reports "no below-threshold texel anywhere" as null, which is
  // vacuously true here: nothing is stranded when nothing needs a source.
  const opaque = opaqueCounts(data, width, height);
  if (!opaque) return true;
  for (let y = 0; y < height; y++) {
    const fromY = Math.max(0, y - MAX_RADIUS);
    const toY = Math.min(height - 1, y + MAX_RADIUS);
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3]! >= ALPHA_THRESHOLD) continue;
      const fromX = Math.max(0, x - MAX_RADIUS);
      const toX = Math.min(width - 1, x + MAX_RADIUS);
      if (boxSum(opaque, width, fromX, fromY, toX, toY) === 0) return false;
    }
  }
  return true;
}

/**
 * Summed-area table of the at-or-above-threshold texels, one row and one column
 * of zeroes wider than the image so `boxSum` needs no bounds tests. `null` when
 * no texel is below the threshold, so the pass has nothing to rewrite.
 */
function opaqueCounts(
  data: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number
): Int32Array | null {
  let targets = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i]! < ALPHA_THRESHOLD) targets++;
  }
  if (targets === 0) return null;

  const stride = width + 1;
  const sums = new Int32Array(stride * (height + 1));
  for (let y = 0; y < height; y++) {
    let row = 0;
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3]! >= ALPHA_THRESHOLD) row++;
      sums[(y + 1) * stride + x + 1] = sums[y * stride + x + 1]! + row;
    }
  }
  return sums;
}

/** How many at-or-above-threshold texels the INCLUSIVE box holds. */
function boxSum(
  sums: Int32Array,
  width: number,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number
): number {
  const stride = width + 1;
  return (
    sums[(toY + 1) * stride + toX + 1]! -
    sums[fromY * stride + toX + 1]! -
    sums[(toY + 1) * stride + fromX]! +
    sums[fromY * stride + fromX]!
  );
}
