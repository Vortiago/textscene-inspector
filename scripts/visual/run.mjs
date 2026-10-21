#!/usr/bin/env node
/**
 * The visual-regression gate: a screenshot of each golden scene's canvas element, so no shell DOM
 * or font rendering, must decode to the committed baseline's pixels exactly (`imageDelta.mjs`). A
 * failure writes <name>.actual.png and <name>.diff.png to scripts/visual/output/, which is
 * gitignored and uploaded as a CI artefact.
 *
 * @example
 *   pnpm test:visual                 # compare every scene against its baseline
 *   pnpm test:visual:update          # rewrite the baselines, then eyeball and commit them
 *   node scripts/visual/run.mjs --scene label3d [--update]
 *   node scripts/visual/run.mjs --shard 2/4      # the 2nd of 4 shards of equal seconds, as CI runs it
 */

import { resolve } from 'node:path';
import { previewPort, withPreviewBrowser } from './previewServer.mjs';
import { BASELINE_DIR } from './baselinePath.mjs';
import { parseArgs, selectScenes, summarize } from './run/cli.mjs';
import { openPagePool } from './run/pagePool.mjs';
import { captureScene } from './run/sceneCapture.mjs';
import { compareToBaseline, writeBaseline, writeFailureArtifacts } from './run/baselines.mjs';

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const results = [];
  await withPreviewBrowser(previewPort('visual'), async (browser, baseUrl) => {
    console.log(`[visual] preview at ${baseUrl}`);
    const pool = await openPagePool(browser, selectScenes(opts));
    // shards/measure.mjs starts the first scene's clock here, so the browser launch stays out of
    // the scene's seconds.
    console.log('[visual] browser ready');
    for (const scene of pool.scenes) {
      const result = await pool.use(scene, (pageState) => checkScene(pageState, baseUrl, scene, opts));
      results.push(result);
      // One line per scene, so a slow run shows progress and a cancelled one shows how far it got.
      console.log(`[visual] ${results.length}/${pool.scenes.length} ${scene.name} ${result.status}`);
    }
  });

  console.log('\n=== visual regression summary ===');
  const { lines, failed } = summarize(results);
  for (const line of lines) console.log(line);
  if (opts.update) {
    const written = results.filter((r) => r.status === 'updated').length;
    const unchanged = results.filter((r) => r.status === 'unchanged').length;
    console.log(
      `\n[visual] ${written} baseline(s) written to ${BASELINE_DIR}/, ${unchanged} left ` +
        'alone (pixels identical) — eyeball the written ones, then commit.'
    );
  }
  if (failed > 0) {
    console.error(`\n[visual] ${failed}/${results.length} scene(s) failed. Diffs in scripts/visual/output/.`);
    process.exit(1);
  }
  console.log(`\n[visual] PASS: ${results.length}/${results.length} scenes.`);
  // A lingering handle from the killed preview group would keep the event loop open after
  // success, so the script exits explicitly.
  process.exit(0);
}

/** Captures one scene and compares it with its baseline, or writes the baseline under --update. */
async function checkScene(pageState, baseUrl, scene, opts) {
  const { buffer, reason, status } = await captureScene(pageState, baseUrl, scene);
  if (!buffer) return { scene, status: status ?? 'unstable', detail: reason };
  if (opts.update) {
    // `writeBaseline` refuses a uniform capture and skips an unchanged one: a dead context
    // settles as cleanly as a real one, and a dead baseline passes every later compare.
    return { scene, ...writeBaseline(scene, buffer) };
  }
  const result = compareToBaseline(scene, buffer);
  if (result.status === 'fail') writeFailureArtifacts(scene, buffer, result);
  return { scene, status: result.status, detail: result.detail };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  await main();
}
