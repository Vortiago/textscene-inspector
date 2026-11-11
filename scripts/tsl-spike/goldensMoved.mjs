#!/usr/bin/env node
/**
 * Counts the 3D goldens a renderer path moves, and by how much: every 3D scene of the visual gate,
 * captured as the gate captures it, compared with its baseline.
 *   node scripts/tsl-spike/goldensMoved.mjs --renderer handler --out moved.json [--match light]
 * It writes one row per scene, and skips each scene `--out` already holds, so a stopped run goes on
 * where it stopped.
 */

import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { baselinePath } from '../visual/baselinePath.mjs';
import { compareImages } from '../visual/imageDelta.mjs';
import { previewPort, REPO_ROOT, withPreviewBrowser } from '../visual/previewServer.mjs';
import { openPagePool } from '../visual/run/pagePool.mjs';
import { captureScene } from '../visual/run/sceneCapture.mjs';
import { GOLDEN_SCENES } from '../visual/scenes.mjs';

function parseArgs(argv) {
  const args = { renderer: 'handler', out: null, match: '' };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--renderer') args.renderer = argv[++i];
    else if (arg === '--out') args.out = argv[++i];
    else if (arg === '--match') args.match = argv[++i];
    else throw new Error(`unknown argument ${arg}`);
  }
  if (!args.out) throw new Error('--out <file> is required');
  return args;
}

function deltaOf(scene, buffer) {
  const baseline = readFileSync(resolve(REPO_ROOT, baselinePath(scene.name)));
  const { sizeMismatch, changedPixels, maxChannelDelta, meanChannelError } = compareImages(baseline, buffer);
  return sizeMismatch ? { sizeMismatch } : { changedPixels, maxChannelDelta, meanChannelError };
}

/** The names of the scenes `out` already holds a row for. */
function measuredScenes(out) {
  if (!existsSync(out)) return new Set();
  const rows = readFileSync(out, 'utf8').split('\n').filter(Boolean);
  return new Set(rows.map((row) => JSON.parse(row).name));
}

async function main() {
  const { renderer, out, match } = parseArgs(process.argv.slice(2));
  // `gotoFixture` reads it: the gate's own capture passes no query parameter.
  process.env.TSL_SPIKE_RENDERER = renderer;
  const measured = measuredScenes(resolve(out));
  const scenes = GOLDEN_SCENES.filter(
    (scene) => scene.mode !== '2d' && scene.name.includes(match) && !measured.has(scene.name)
  );
  await withPreviewBrowser(previewPort('visual'), async (browser, baseUrl) => {
    const pool = await openPagePool(browser, scenes);
    for (const scene of pool.scenes) {
      const startedAt = Date.now();
      const row = await pool.use(scene, async (pageState) => {
        const { buffer, reason } = await captureScene(pageState, baseUrl, scene);
        return {
          name: scene.name,
          file: scene.file,
          ...(buffer ? deltaOf(scene, buffer) : { failed: reason }),
        };
      });
      row.seconds = (Date.now() - startedAt) / 1000;
      appendFileSync(resolve(out), `${JSON.stringify(row)}\n`);
    }
  });
  process.exit(0);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
