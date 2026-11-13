#!/usr/bin/env node
/**
 * The lit surface sweep: every 3D golden of the visual gate, captured as the gate captures it with
 * the node lit surface switched on (`?litSurface=nodes`), and compared with its baseline.
 *   pnpm test:visual:lit-surface --out <file.jsonl> [--match <text>]
 * It writes one JSON row per scene and skips each scene `--out` already holds, so a stopped run
 * goes on where it stopped. After the rows it prints the four counts over the whole file.
 */

import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { baselinePath } from '../baselinePath.mjs';
import { compareImages } from '../imageDelta.mjs';
import { previewPort, REPO_ROOT, withPreviewBrowser } from '../previewServer.mjs';
import { openPagePool } from '../run/pagePool.mjs';
import { captureScene } from '../run/sceneCapture.mjs';
import { GOLDEN_SCENES } from '../scenes.mjs';
import { sweepCounts } from './sweepCounts.mjs';

function parseArgs(argv) {
  const args = { out: null, match: '' };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--out') args.out = argv[++i];
    else if (arg === '--match') args.match = argv[++i];
    else throw new Error(`expected --out <file> or --match <text>, got ${arg}`);
  }
  if (!args.out) throw new Error('expected --out <file>, got none');
  return { out: resolve(args.out), match: args.match };
}

function readRows(out) {
  if (!existsSync(out)) return [];
  return readFileSync(out, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((row) => JSON.parse(row));
}

function deltaOf(scene, buffer) {
  const baseline = readFileSync(resolve(REPO_ROOT, baselinePath(scene.name)));
  const { sizeMismatch, changedPixels, maxChannelDelta, meanChannelError } = compareImages(baseline, buffer);
  return sizeMismatch ? { sizeMismatch } : { changedPixels, maxChannelDelta, meanChannelError };
}

/** The 3D goldens `match` names that `out` holds no row for, each with the switch on. */
function scenesToSweep(out, match) {
  const swept = new Set(readRows(out).map((row) => row.name));
  return GOLDEN_SCENES.filter((scene) => scene.mode !== '2d' && scene.name.includes(match))
    .filter((scene) => !swept.has(scene.name))
    .map((scene) => ({ ...scene, litSurface: 'nodes' }));
}

async function sweep(out, scenes) {
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
      appendFileSync(out, `${JSON.stringify(row)}\n`);
    }
  });
}

async function main() {
  const { out, match } = parseArgs(process.argv.slice(2));
  const scenes = scenesToSweep(out, match);
  if (scenes.length > 0) await sweep(out, scenes);
  const { identical, withinOneStep, aboveOneStep, failed } = sweepCounts(readRows(out));
  console.log(
    `[lit-surface] identical ${identical}, within 1/255 ${withinOneStep}, above 1/255 ${aboveOneStep}, failed ${failed}`
  );
  process.exit(0);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
