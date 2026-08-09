/**
 * The committed baselines and the pixel arithmetic against them: read one,
 * diff it, write a new one, or drop the failure artifacts a reviewer needs.
 *
 * This module also owns where those two directories are, so the depth is a
 * property of this file alone — deriving `import.meta.url` offsets in each
 * consumer is how a moved module silently repoints 145 baselines at an empty
 * directory and reports every scene as missing.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { DEFAULT_MAX_DIFF_PCT } from '../scenes.mjs';

const VISUAL_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_DIR = join(VISUAL_DIR, 'baselines');
const OUTPUT_DIR = join(VISUAL_DIR, 'output');

/** Accept a capture as the new baseline (`--update`). */
export function writeBaseline(scene, buffer) {
  mkdirSync(BASELINE_DIR, { recursive: true });
  writeFileSync(join(BASELINE_DIR, `${scene.name}.png`), buffer);
}

export function compareToBaseline(scene, actualBuffer) {
  const baselinePath = join(BASELINE_DIR, `${scene.name}.png`);
  if (!existsSync(baselinePath)) {
    return { status: 'missing-baseline', detail: `no baseline — run pnpm test:visual:update` };
  }
  const expected = PNG.sync.read(readFileSync(baselinePath));
  const actual = PNG.sync.read(actualBuffer);
  if (expected.width !== actual.width || expected.height !== actual.height) {
    return {
      status: 'fail',
      detail: `size mismatch: baseline ${expected.width}x${expected.height}, actual ${actual.width}x${actual.height}`,
      actual,
    };
  }
  const { width, height } = expected;
  const diff = new PNG({ width, height });
  const diffPixels = pixelmatch(expected.data, actual.data, diff.data, width, height, {
    threshold: 0.1,
  });
  const diffPct = (diffPixels / (width * height)) * 100;
  const maxDiffPct = scene.maxDiffPct ?? DEFAULT_MAX_DIFF_PCT;
  if (diffPct > maxDiffPct) {
    return {
      status: 'fail',
      detail: `${diffPixels} px differ (${diffPct.toFixed(3)}% > ${maxDiffPct}%)`,
      actual,
      diff,
    };
  }
  return { status: 'pass', detail: `${diffPixels} px differ (${diffPct.toFixed(3)}%)` };
}

export function writeFailureArtifacts(scene, actualBuffer, result) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(join(OUTPUT_DIR, `${scene.name}.actual.png`), actualBuffer);
  if (result.diff) {
    writeFileSync(join(OUTPUT_DIR, `${scene.name}.diff.png`), PNG.sync.write(result.diff));
  }
}
