#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { requireGodotVersion, runGodotScript } from '../../../../scripts/godot-probes/godotRun.mjs';
import { withConsumerPage, writeJobSummary } from '../consumer.mjs';
import { compareImages, TOLERANCE_STEPS } from './compareImages.mjs';
import { MAIN_SCRIPT, parseShowcaseOutput, showcaseProjectFiles } from './godotShowcases.mjs';
import { SHOWCASES } from './showcases.mjs';
import { ALL_SCENES, DRAWN_SCENES } from './drawnScenes.mjs';
import { MESH_MAIN_SCRIPT, meshProjectFiles, parseMeshOutput } from './godotMeshScenes.mjs';
import { godotRuns } from './godotViewports.mjs';
import { FAULT_SCENES, MESH_SCENES } from './meshScenes.mjs';
import { parseSkyOutput, SKY_MAIN_SCRIPT, skyProjectFiles } from './godotSkyScenes.mjs';
import { SKY_SCENES } from './skyScenes.mjs';

/** Where the guide shows each showcase's two images. */
const SHOWCASE_DIR = join(import.meta.dirname, '../../guide/showcase');

const showcaseImage = (name, side) => join(SHOWCASE_DIR, `${name}-${side}.png`);

/** Godot's image of each showcase, each sky scene and each mesh scene, by name. */
async function godotImages() {
  const [showcases, ...runs] = await Promise.all([
    runGodotScript(MAIN_SCRIPT, showcaseProjectFiles(SHOWCASES)).then(parseShowcaseOutput),
    ...godotRuns(MESH_SCENES).map(({ scenes, options }) =>
      runGodotScript(MESH_MAIN_SCRIPT, meshProjectFiles(scenes), options).then(parseMeshOutput)
    ),
    ...godotRuns(SKY_SCENES).map(({ scenes, options }) =>
      runGodotScript(SKY_MAIN_SCRIPT, skyProjectFiles(scenes), options).then(parseSkyOutput)
    ),
  ]);
  for (const run of [showcases, ...runs]) requireGodotVersion(run.godot);
  return new Map([...showcases.images, ...runs.flatMap((run) => [...run.images])]);
}

/** The page's image of each showcase, each sky scene and each mesh scene, by name. */
async function transpiledImages() {
  return withConsumerPage(
    { pageDir: join(import.meta.dirname, 'page'), module: 'e2ePage.js', harness: 'shaderEndToEnd' },
    async (page) => {
      const images = new Map();
      for (const { spec, draw } of DRAWN_SCENES) {
        const drawn = await page.evaluate(([value, name]) => globalThis[name](value), [spec, draw]);
        if (drawn.error) throw new Error(`${spec.name}: ${drawn.error}`);
        if (drawn.faults) throw new Error(`${spec.name}: ${drawn.faults[0].message}`);
        images.set(spec.name, Uint8Array.from(drawn.pixels));
      }
      return images;
    }
  );
}

/** A failure for each fault scene that does not reach its material as a translator fault with its log. */
async function unreportedFaults() {
  return withConsumerPage(
    { pageDir: join(import.meta.dirname, 'page'), module: 'e2ePage.js', harness: 'shaderEndToEnd' },
    async (page) => {
      const failures = [];
      for (const { log, ...spec } of FAULT_SCENES) {
        const drawn = await page.evaluate((value) => globalThis.drawMesh(value), spec);
        const fault = drawn.faults?.[0];
        if (fault?.name !== 'TranslatorFault' || !log.test(fault.log))
          failures.push(
            `${spec.name}: expected a translator fault with ${log}, got ${JSON.stringify(drawn.faults ?? drawn.error ?? 'pixels')}`
          );
        else console.log(`${spec.name}: translator fault, ${fault.log.split('\n')[0]}`);
      }
      return failures;
    }
  );
}

function writePng(path, { width, height }, pixels) {
  const png = new PNG({ width, height });
  png.data = Buffer.from(pixels);
  writeFileSync(path, PNG.sync.write(png));
}

/** Lavapipe rounds `exp` and `pow` one step apart with and without AVX, as `sky-fog-sun` shows on CI. */
const MACHINE_STEPS = 1;

/** Nothing when no byte moves more than a machine moves it: 2/255 is for Godot against the transpilation. */
function staleImage(path, pixels) {
  if (!existsSync(path)) return `${path} is missing`;
  const { maxSteps } = compareImages(PNG.sync.read(readFileSync(path)).data, pixels);
  return maxSteps <= MACHINE_STEPS ? undefined : `${path} differs from the render by up to ${maxSteps}/255`;
}

function resultTable(results) {
  const lines = results.map(
    ({ showcase, overTolerance, pixels, maxSteps, meanSteps }) =>
      `| \`${showcase.name}\` | ${pixels} | ${overTolerance} | ${maxSteps}/255 | ${meanSteps.toFixed(3)}/255 |`
  );
  return [
    `| Showcase | Pixels | Over ${TOLERANCE_STEPS}/255 | Max | Mean |`,
    '| --- | --- | --- | --- | --- |',
    ...lines,
  ].join('\n');
}

async function main() {
  const godot = await godotImages();
  const transpilation = await transpiledImages();
  const update = process.argv.includes('--update');
  if (update) mkdirSync(SHOWCASE_DIR, { recursive: true });
  const failures = [];
  const results = ALL_SCENES.map((showcase) => {
    const ours = transpilation.get(showcase.name);
    const theirs = godot.get(showcase.name);
    if (!theirs) throw new Error(`expected Godot's image of showcase ${showcase.name}, found none`);
    const result = { showcase, ...compareImages(theirs, ours) };
    const knownPixels = showcase.knownPixels ?? 0;
    if (result.overTolerance > knownPixels)
      failures.push(
        `${showcase.name}: ${result.overTolerance} pixels over ${TOLERANCE_STEPS}/255, ${knownPixels} known`
      );
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
  failures.push(...(await unreportedFaults()));
  const table = resultTable(results);
  console.log(table);
  writeJobSummary(`## Shader showcases against Godot\n\n${table}\n`);
  for (const failure of failures) console.error(`[shader-e2e] ${failure}`);
  process.exitCode = failures.length === 0 ? 0 : 1;
}

await main();
