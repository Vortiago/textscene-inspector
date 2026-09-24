/**
 * The committed baselines and the pixel arithmetic against them: read, diff, write, and the
 * failure artefacts a reviewer needs. Only this module locates the two directories, since a moved
 * consumer with its own offset would point at an empty directory and report every scene missing.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { compareImages, formatDelta } from '../imageDelta.mjs';
import { isUniformImage } from '../previewServer.mjs';

const VISUAL_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_DIR = join(VISUAL_DIR, 'baselines');
const OUTPUT_DIR = join(VISUAL_DIR, 'output');

/**
 * A scene passes when its capture decodes to the baseline's pixels exactly, with no perceptual
 * tolerance (`imageDelta.mjs`): the pinned Chromium, the software rasterizer and the settle gate
 * reproduce antialiased edges bit for bit. A failure prints area, worst channel and mean error,
 * since a broad faint shift and a few strong edge pixels can share one percentage.
 */
export function compareToBaseline(scene, actualBuffer) {
  const baselinePath = join(BASELINE_DIR, `${scene.name}.png`);
  if (!existsSync(baselinePath)) {
    return { status: 'missing-baseline', detail: 'no baseline — run pnpm test:visual:update' };
  }
  const result = compareImages(readFileSync(baselinePath), actualBuffer, { diff: true });
  if (result.sizeMismatch || result.changedPixels > 0) {
    return { status: 'fail', detail: formatDelta(result), diff: result.diff };
  }
  return { status: 'pass', detail: formatDelta(result) };
}

/**
 * Whether two PNG buffers decode to the same pixels, through `compareToBaseline`'s measurement so
 * compare and `--update` agree on "unchanged". Not a byte compare: an unchanged render re-encodes
 * to new PNG bytes, which would hide the moved images among rewritten ones. Returns false for a
 * missing or unreadable baseline, so anything not proven identical gets written.
 */
export function pixelsMatchBaseline(baselineBuffer, actualBuffer) {
  if (!baselineBuffer) return false;
  let result;
  try {
    result = compareImages(baselineBuffer, actualBuffer);
  } catch {
    return false;
  }
  return !result.sizeMismatch && result.changedPixels === 0;
}

/**
 * Writes a baseline, refusing the two writes that disarm the gate: a uniform capture (a lost WebGL
 * context or an unrendered scene), which would pass every later compare, and an unchanged one,
 * whose new PNG bytes would bury the images that moved.
 */
export function writeBaseline(scene, buffer) {
  if (isUniformImage(buffer)) {
    return {
      status: 'refused',
      detail:
        'capture is a single uniform colour throughout — refusing to write it as a ' +
        'baseline (a lost WebGL context or an unrendered scene, never a real golden)',
    };
  }
  const baselinePath = join(BASELINE_DIR, `${scene.name}.png`);
  const existing = existsSync(baselinePath) ? readFileSync(baselinePath) : null;
  if (pixelsMatchBaseline(existing, buffer)) {
    return { status: 'unchanged', detail: 'pixels identical — not rewritten' };
  }
  mkdirSync(BASELINE_DIR, { recursive: true });
  writeFileSync(baselinePath, buffer);
  return { status: 'updated', detail: `${buffer.length} bytes` };
}

export function writeFailureArtifacts(scene, actualBuffer, result) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(join(OUTPUT_DIR, `${scene.name}.actual.png`), actualBuffer);
  if (result.diff) {
    writeFileSync(join(OUTPUT_DIR, `${scene.name}.diff.png`), PNG.sync.write(result.diff));
  }
}
