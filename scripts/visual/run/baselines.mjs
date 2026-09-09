/**
 * The committed baselines and the pixel arithmetic against them: read one,
 * diff it, write a new one, or drop the failure artifacts a reviewer needs.
 *
 * This module also owns where those two directories are, so the depth is a
 * property of this file alone — deriving `import.meta.url` offsets in each
 * consumer is how a moved module silently repoints the baselines at an empty
 * directory and reports every scene as missing.
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
 * A scene passes when its capture decodes to the baseline's pixels exactly.
 *
 * The tolerance this replaces was perceptual (a YIQ distance), and a perceptual
 * tolerance answers the wrong question for a golden: it is calibrated to what
 * an eye would notice on an edge, while what a golden guards is whether the
 * renderer still produces the same frame. Between those two, a flat luminance
 * shift of ~26/255 and a chroma shift of any size scored as ZERO differing
 * pixels — not "inside the budget", zero, so the budget was never consulted
 * (`imageDelta.mjs` carries the arithmetic). Everything a per-scene budget was
 * held for — antialiasing on a gizmo line, a soft shadow edge — is
 * bit-reproducible here by construction: the same pinned Chromium, the same
 * software rasterizer, and a settle gate that already refuses a capture until
 * two consecutive frames are byte-identical. A scene that cannot reproduce its
 * own baseline is telling us something, and no budget size makes that a better
 * report than the measurement.
 *
 * Failures print area, worst channel excursion and mean channel error, so the
 * SHAPE of a difference is readable without opening the diff image: a broad,
 * low-magnitude shift and a few strong edge pixels are the same percentage and
 * different findings.
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
 * Whether two PNG buffers decode to the same pixels — the same question
 * `compareToBaseline` asks, deliberately routed through the same measurement so
 * the compare path and the `--update` write guard can never disagree about what
 * "unchanged" means.
 *
 * A byte compare answers a different question. Re-encoding an unchanged render
 * routinely produces different PNG bytes, and `--update` writes every scene
 * unconditionally — so a rebaseline that moved four images arrives as thirteen
 * changed binaries, and "eyeball the rebaselined images" turns into finding the
 * four that mean something. An unintended baseline rides along unnoticed in
 * that noise, which is the whole failure mode baselines-are-committed exists to
 * prevent.
 *
 * Returns false for a missing or unreadable baseline, so anything we cannot
 * prove identical gets written.
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
 * Write a baseline, refusing the two writes that quietly disarm the gate.
 *
 * A uniform capture is a lost WebGL context or an unrendered scene, and once
 * committed it makes every later compare pass however badly the renderer
 * breaks. An unchanged one re-encodes to different PNG bytes, burying the
 * images that did move in a diff nobody can read.
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
