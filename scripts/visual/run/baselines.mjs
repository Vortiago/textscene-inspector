/**
 * The committed baselines and the pixel arithmetic against them: read, diff, write, and the
 * failure artefacts a reviewer needs. `baselinePath.mjs` places a baseline, and this module places
 * the output directory.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { PNG } from 'pngjs';
import { REPO_ROOT } from '../../repoRoot.mjs';
import { baselinePath } from '../baselinePath.mjs';
import { compareImages, formatDelta } from '../imageDelta.mjs';
import { isUniformImage } from '../previewServer.mjs';

const OUTPUT_DIR = join(REPO_ROOT, 'scripts/visual/output');

function baselineFile(scene) {
  return join(REPO_ROOT, baselinePath(scene.name));
}

/**
 * A scene passes when its capture decodes to the baseline's pixels exactly, with no perceptual
 * tolerance (`imageDelta.mjs`): the pinned Chromium, the software rasterizer and the settle gate
 * reproduce antialiased edges bit for bit. A failure prints area, worst channel and mean error,
 * since a broad faint shift and a few strong edge pixels can share one percentage.
 */
export function compareToBaseline(scene, actualBuffer) {
  const file = baselineFile(scene);
  if (!existsSync(file)) {
    return { status: 'missing-baseline', detail: 'no baseline — run pnpm test:visual:update' };
  }
  const result = compareImages(readFileSync(file), actualBuffer, { diff: true });
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
  const file = baselineFile(scene);
  const existing = existsSync(file) ? readFileSync(file) : null;
  if (pixelsMatchBaseline(existing, buffer)) {
    return { status: 'unchanged', detail: 'pixels identical — not rewritten' };
  }
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, buffer);
  return { status: 'updated', detail: `${buffer.length} bytes` };
}

export function writeFailureArtifacts(scene, actualBuffer, result) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(join(OUTPUT_DIR, `${scene.name}.actual.png`), actualBuffer);
  if (result.diff) {
    writeFileSync(join(OUTPUT_DIR, `${scene.name}.diff.png`), PNG.sync.write(result.diff));
  }
}
