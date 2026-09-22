/**
 * Pixel accounting shared by `drive-vscode.mjs` (per-capture ink) and
 * `ink-diff.mjs` (A/B attribution). Pure functions over PNG buffers so the
 * arithmetic can be tested without launching VS Code.
 */
import { PNG } from 'pngjs';

/**
 * Manhattan distance over RGBA between the pixel at byte offset `ai` in `a`
 * and the one at byte offset `bi` in `b`. Both offsets are explicit so a whole
 * image can be compared against a single four-byte colour.
 */
function delta(a, ai, b, bi) {
  return (
    Math.abs(a[ai] - b[bi]) +
    Math.abs(a[ai + 1] - b[bi + 1]) +
    Math.abs(a[ai + 2] - b[bi + 2]) +
    Math.abs(a[ai + 3] - b[bi + 3])
  );
}

/**
 * Ink = pixels that differ from the image's dominant colour (its background).
 * An image that rendered nothing is one flat colour and scores 0 whatever that
 * colour is — so this reads a transparent WebGL canvas and an opaque workbench
 * screenshot with the same rule, without hardcoding either background.
 *
 * @param {Buffer} buffer PNG bytes
 * @param {number} [threshold] summed RGBA distance above which a pixel is ink
 */
export function inkStats(buffer, threshold = 24) {
  const png = PNG.sync.read(buffer);
  const histogram = new Map();
  for (let i = 0; i < png.data.length; i += 4) {
    const key =
      (png.data[i] << 24) | (png.data[i + 1] << 16) | (png.data[i + 2] << 8) | png.data[i + 3];
    histogram.set(key, (histogram.get(key) ?? 0) + 1);
  }
  let dominantKey = 0;
  let dominantCount = -1;
  for (const [key, count] of histogram) {
    if (count > dominantCount) {
      dominantCount = count;
      dominantKey = key;
    }
  }
  const dominant = [
    (dominantKey >> 24) & 0xff,
    (dominantKey >> 16) & 0xff,
    (dominantKey >> 8) & 0xff,
    dominantKey & 0xff,
  ];

  let ink = 0;
  let opaque = 0;
  for (let i = 0; i < png.data.length; i += 4) {
    if (png.data[i + 3] > 8) opaque++;
    if (delta(png.data, i, dominant, 0) > threshold) ink++;
  }
  const totalPixels = png.width * png.height;
  return {
    width: png.width,
    height: png.height,
    totalPixels,
    dominantColor: `rgba(${dominant[0]},${dominant[1]},${dominant[2]},${dominant[3]})`,
    dominantShare: totalPixels ? Number((dominantCount / totalPixels).toFixed(4)) : 0,
    inkPixels: ink,
    nonTransparentPixels: opaque,
    distinctColors: histogram.size,
  };
}

/**
 * Pixels present in `a` but not `b` (or vice versa), with the bounding box that
 * contains them and a black/white mask. Throws on a size mismatch: two captures
 * that laid out differently cannot attribute a difference to one feature.
 *
 * @param {Buffer} aBuffer PNG bytes
 * @param {Buffer} bBuffer PNG bytes
 * @param {number} [threshold] summed RGBA distance above which pixels differ
 */
export function diffMask(aBuffer, bBuffer, threshold = 24) {
  const a = PNG.sync.read(aBuffer);
  const b = PNG.sync.read(bBuffer);
  if (a.width !== b.width || a.height !== b.height) {
    throw new Error(
      `Size mismatch: ${a.width}x${a.height} vs ${b.width}x${b.height} — ` +
        'the two runs must lay out identically for a diff to be meaningful.'
    );
  }

  const mask = new PNG({ width: a.width, height: a.height });
  let diffPixels = 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < a.height; y++) {
    for (let x = 0; x < a.width; x++) {
      const i = (y * a.width + x) * 4;
      const differs = delta(a.data, i, b.data, i) > threshold;
      if (differs) {
        diffPixels++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
      const value = differs ? 255 : 0;
      mask.data[i] = value;
      mask.data[i + 1] = value;
      mask.data[i + 2] = value;
      mask.data[i + 3] = 255;
    }
  }

  return {
    diffPixels,
    bbox: diffPixels ? { minX, minY, maxX, maxY } : null,
    size: { width: a.width, height: a.height },
    mask,
  };
}
