/**
 * Godot's import-time "fix alpha border" pass, on RGBA8 bytes.
 *
 * A PNG's fully-transparent texels carry arbitrary RGB — a paletted image
 * routinely stores black, or a leftover key colour, behind alpha 0. Nothing
 * shows it until a bilinear sample straddles the alpha boundary: the filter
 * blends RGB and alpha independently, so that hidden colour bleeds into the
 * visible fringe, darkest where the texture is magnified most.
 *
 * Godot never renders those bytes. `ResourceImporterTexture` runs
 * `Image::fix_alpha_edges()` on every texture whose import preset is not the 3D
 * one (`editor/import/resource_importer_texture.cpp:253,862` — the generated
 * `.import` for an unattended texture carries `process/fix_alpha_border=true`),
 * rewriting each below-threshold texel's RGB with its nearest opaque texel's,
 * so the bleed is the sprite's own colour. Reading a `res://` PNG straight off
 * disk skips the importer, so this reproduces that one pass.
 */

/**
 * `core/io/image.cpp Image::fix_alpha_edges`: a texel with alpha at or above
 * this is left alone AND is a source of replacement colour; everything below it
 * is rewritten.
 */
const ALPHA_THRESHOLD = 20;

/** `core/io/image.cpp Image::fix_alpha_edges`: `const int max_radius = 4`. */
const MAX_RADIUS = 4;

/**
 * Rewrite each below-threshold texel's RGB in place with the RGB of the nearest
 * opaque texel within `MAX_RADIUS`, leaving every alpha byte untouched. Returns
 * whether any byte changed, so a caller can keep the original image when the
 * pass is a no-op.
 *
 * `data` is RGBA8, row-major, first row = top row.
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

      // The C++ leaves a texel untouched when its whole neighbourhood is
      // transparent, and in a large transparent region that is every texel —
      // the case that dominates the cost. The summed-area table answers "is
      // there an opaque texel in this box" in constant time, so only texels
      // that will actually find a source pay for the full scan below.
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
 * Summed-area table of the at-or-above-threshold texels, one row and one column
 * of zeroes wider than the image so `boxSum` needs no bounds tests. Returns
 * `null` when the image has no below-threshold texel at all — there is nothing
 * for the pass to rewrite, and the table would be built for nobody.
 */
function opaqueCounts(data: Uint8Array, width: number, height: number): Int32Array | null {
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
