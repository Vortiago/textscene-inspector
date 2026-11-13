#!/usr/bin/env node
/**
 * The end to end layer of the shader package: `pnpm test:shaders:e2e [--update]`. Godot draws
 * each showcase, a plain three.js page draws its translation from the packed tarball, and the run
 * reports the pixels over 2/255 and the largest difference. It fails on any pixel over, and on a
 * guide image that no longer matches the renders; `--update` writes the guide images instead.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { requireGodotVersion, runGodotScript } from '../../../../scripts/godot-probes/godotRun.mjs';
import { withConsumerPage, writeJobSummary } from '../consumer.mjs';
import { compareImages, TOLERANCE_STEPS } from './compareImages.mjs';
import { MAIN_SCRIPT, parseShowcaseOutput, showcaseProjectFiles } from './godotShowcases.mjs';
import { SHOWCASES } from './showcases.mjs';

/** Where the guide shows each showcase's two images. */
const SHOWCASE_DIR = join(import.meta.dirname, '../../guide/showcase');

const showcaseImage = (name, side) => join(SHOWCASE_DIR, `${name}-${side}.png`);

function godotImages() {
  const output = parseShowcaseOutput(runGodotScript(MAIN_SCRIPT, showcaseProjectFiles(SHOWCASES)));
  requireGodotVersion(output.godot);
  return output.images;
}

async function translationImages() {
  return withConsumerPage(
    { pageDir: join(import.meta.dirname, 'page'), module: 'showcasePage.js', harness: 'shaderEndToEnd' },
    async (page) => {
      const images = new Map();
      for (const showcase of SHOWCASES) {
        const drawn = await page.evaluate((spec) => globalThis.drawShowcase(spec), showcase);
        if (drawn.error) throw new Error(`showcase ${showcase.name}: ${drawn.error}`);
        images.set(showcase.name, Uint8Array.from(drawn.pixels));
      }
      return images;
    }
  );
}

function writePng(path, { width, height }, pixels) {
  const png = new PNG({ width, height });
  png.data = Buffer.from(pixels);
  writeFileSync(path, PNG.sync.write(png));
}

/**
 * The guide image's staleness against a render: nothing when every byte matches. A guide image is
 * a baseline, so it takes no tolerance. The 2/255 tolerance is for Godot against the translation.
 */
function staleImage(path, pixels) {
  if (!existsSync(path)) return `${path} is missing`;
  const { maxSteps } = compareImages(PNG.sync.read(readFileSync(path)).data, pixels);
  return maxSteps === 0 ? undefined : `${path} differs from the render by up to ${maxSteps}/255`;
}

function resultTable(results) {
  const lines = results.map(
    ({ showcase, overTolerance, pixels, maxSteps }) =>
      `| \`${showcase.name}\` | ${pixels} | ${overTolerance} | ${maxSteps}/255 |`
  );
  return [
    `| Showcase | Pixels | Over ${TOLERANCE_STEPS}/255 | Max |`,
    '| --- | --- | --- | --- |',
    ...lines,
  ].join('\n');
}

async function main() {
  const godot = godotImages();
  const translation = await translationImages();
  const update = process.argv.includes('--update');
  if (update) mkdirSync(SHOWCASE_DIR, { recursive: true });
  const failures = [];
  const results = SHOWCASES.map((showcase) => {
    const ours = translation.get(showcase.name);
    const theirs = godot.get(showcase.name);
    if (!theirs) throw new Error(`expected Godot's image of showcase ${showcase.name}, found none`);
    const result = { showcase, ...compareImages(theirs, ours) };
    if (result.overTolerance > 0)
      failures.push(`${showcase.name}: ${result.overTolerance} pixels over ${TOLERANCE_STEPS}/255`);
    for (const [side, pixels] of [
      ['godot', theirs],
      ['three', ours],
    ]) {
      if (update) writePng(showcaseImage(showcase.name, side), showcase, pixels);
      else {
        const stale = staleImage(showcaseImage(showcase.name, side), pixels);
        if (stale) failures.push(`${stale}: run pnpm test:shaders:e2e --update`);
      }
    }
    return result;
  });
  const table = resultTable(results);
  console.log(table);
  writeJobSummary(`## Shader showcases against Godot\n\n${table}\n`);
  for (const failure of failures) console.error(`[shader-e2e] ${failure}`);
  process.exitCode = failures.length === 0 ? 0 : 1;
}

await main();
