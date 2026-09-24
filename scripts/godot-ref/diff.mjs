#!/usr/bin/env node
/**
 * Renders a scene through real Godot and the previewer at one camera and prints
 * how far apart they are: `pnpm ref:diff unit-csg-*.tscn [--max-mean 2]`.
 * `test:visual` detects change, this detects wrongness. Not a gate: CI has no
 * Godot, and committed references would need Godot to edit a fixture.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, join, relative as relativePath, resolve, sep } from 'node:path';
import { PNG } from 'pngjs';
import { compareImages } from '../visual/imageDelta.mjs';
import { renderReference } from './run.mjs';
import { captureOurs } from './capture-ours.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const FIXTURE_DIR = join(REPO_ROOT, 'scenes', 'fixtures');
const OUT_DIR = join(import.meta.dirname, 'output');

function usage() {
  console.error(
    'Usage: pnpm ref:diff <fixture.tscn> [more.tscn ...] [--max-mean <n>] [--frame] [--keep]\n' +
      '\n' +
      '  <fixture.tscn>   fixture filename as listed in apps/textscene-web/src/fixtures.ts,\n' +
      '                   or a path to a .tscn under scenes/\n' +
      '  --max-mean <n>   exit 1 if any scene exceeds this mean per-channel error, in /255\n' +
      '                   (default: report only)\n' +
      '  --frame          fit-the-bounds camera on BOTH sides instead of the editor orbit\n' +
      '  --keep           keep the per-side PNGs, not just the diff'
  );
}

export function parseArgs(argv) {
  const args = { fixtures: [], maxMean: null, frame: false, keep: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--max-mean') {
      args.maxMean = Number(argv[++i]);
      if (!Number.isFinite(args.maxMean)) {
        throw new Error(`--max-mean needs a number, got "${argv[i]}"`);
      }
    } else if (arg === '--frame') args.frame = true;
    else if (arg === '--keep') args.keep = true;
    else if (arg.startsWith('--')) throw new Error(`unknown flag: ${arg}`);
    else args.fixtures.push(arg);
  }
  return args;
}

/**
 * Accepts a path on disk or a catalog name and produces both: `ref:godot` wants
 * the path, `ref:ours` the name. The catalog flattens `scenes/fixtures/` to a bare
 * filename but keeps any other subtree as a relative path
 * (`demos/3d/truck_town/town/town_scene.tscn`).
 */
export function resolveFixture(input) {
  const name = basename(input);
  if (!name.endsWith('.tscn')) throw new Error(`not a .tscn: ${input}`);
  const scenePath = input.includes('/') ? resolve(REPO_ROOT, input) : join(FIXTURE_DIR, name);
  if (!existsSync(scenePath)) throw new Error(`no such scene: ${scenePath}`);
  const fixtureName = catalogName(scenePath);
  return { scenePath, fixtureName, label: labelFor(fixtureName) };
}

/**
 * What a run's PNGs are named after: the catalog name, not the basename, since
 * two projects in one sweep can both hold a `settings_menu.tscn`.
 */
function labelFor(fixtureName) {
  return fixtureName.replace(/\.tscn$/, '').split('/').join('-');
}

/** The `?fixture=` value the web catalog lists for a scene on disk. */
export function catalogName(scenePath) {
  const relative = relativePath(REPO_ROOT, scenePath).split(sep).join('/');
  if (!relative.startsWith('scenes/')) throw new Error(`scene is outside scenes/: ${scenePath}`);
  const withinScenes = relative.slice('scenes/'.length);
  return withinScenes.startsWith('fixtures/')
    ? withinScenes.slice('fixtures/'.length)
    : withinScenes;
}

/**
 * The difference between two PNG buffers, plus the diff image: per channel and
 * unweighted, as the golden gate measures (`../visual/imageDelta.mjs`), not a
 * perceptual YIQ distance, which scores 0 for a flat luminance shift.
 */
export function comparePngs(godotBuffer, oursBuffer) {
  const result = compareImages(godotBuffer, oursBuffer, { diff: true });
  if (result.sizeMismatch) {
    const { expected, actual } = result.sizeMismatch;
    return {
      sizeMismatch:
        `godot ${expected.width}x${expected.height} vs ` +
        `ours ${actual.width}x${actual.height}`,
    };
  }
  return result;
}

/**
 * One scene through both renderers. `run.mjs` picks 2D or 3D from the scene root
 * and our side captures the mode it reports. The renderer and the capture are
 * injected, so the pairing is testable without Godot or a browser.
 */
export async function diffOne(
  { scenePath, fixtureName, label },
  { frame, keep },
  { render = renderReference, capture = captureOurs, outDir = OUT_DIR } = {}
) {
  const renderAs = async (renderMode) =>
    render({ scene: scenePath, out: join(outDir, `${label}.godot.png`), frame, mode: renderMode });
  // `run.mjs` refuses a root-window-only viewport setting in the nested arm and
  // names the arm that can answer it, so the scene is retried there.
  const { out: godotOut, mode } = await renderAs('auto').catch((error) => {
    if (!error?.rootOnlyDrift) throw error;
    return renderAs('2d-root');
  });
  const godotBuffer = await readFile(godotOut);

  // The reference is the project-viewport rect our 2D stage lays out at 1:1,
  // so it sizes the capture window, with nothing re-derived on this side.
  const canvas2D = mode === '2d';
  const reference = PNG.sync.read(godotBuffer);
  const oursBuffer = await capture({
    fixture: fixtureName,
    frame,
    canvas2D,
    canvas2DFrame: canvas2D ? { width: reference.width, height: reference.height } : null,
  });
  if (keep) await writeFile(join(outDir, `${label}.ours.png`), oursBuffer);

  const result = comparePngs(godotBuffer, oursBuffer);
  if (result.sizeMismatch) return { label, ...result };

  if (result.changedPixels > 0) {
    const diffPath = join(outDir, `${label}.diff.png`);
    await writeFile(diffPath, PNG.sync.write(result.diff));
    result.diffPath = diffPath;
  }
  return { label, ...result };
}

/**
 * Every scene in the sweep, reported as it lands. An unrenderable scene is a
 * `failed` row, not a throw, so the scenes behind it are still measured.
 */
export async function diffAll(targets, args, deps = {}) {
  const results = [];
  for (const target of targets) {
    let result;
    try {
      result = await diffOne(target, args, deps);
    } catch (error) {
      result = { label: target.label, failed: error.message.split('\n')[0] };
    }
    results.push(result);
    // captureOurs() rebuilds the web app on every call, but only the first build
    // can see new source, so later scenes in the run reuse it.
    process.env.VISUAL_SKIP_BUILD = '1';
    console.log(formatResult(result));
  }
  return results;
}

/**
 * One result line. `changed` saturates between two renderers, so it locates a
 * difference. `max` bounds the damage from one pixel. `mean` |Δ| per channel is
 * the parity statistic, the only one that moves with a difference's size.
 */
function formatResult(result) {
  const label = result.label.padEnd(28);
  if (result.failed) return `${label} FAILED         ${result.failed}`;
  if (result.sizeMismatch) return `${label} SIZE MISMATCH  ${result.sizeMismatch}`;
  const changed = `${result.changedPct.toFixed(3)}%`;
  return (
    `${label} changed ${changed.padStart(8)}  ` +
    `(${result.changedPixels} px of ${result.width}x${result.height})  ` +
    `max ${String(result.maxChannelDelta).padStart(3)}/255  ` +
    `mean ${result.meanChannelError.toFixed(3)}/255` +
    (result.diffPath ? `  ${result.diffPath}` : '')
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.fixtures.length === 0) {
    usage();
    process.exit(2);
  }
  await mkdir(OUT_DIR, { recursive: true });

  const results = await diffAll(args.fixtures.map(resolveFixture), args);

  // A scene that never rendered is over any bound: no number is worse than a
  // large one. Without `--max-mean`, only such a scene exits 1.
  const over = results.filter(
    (r) => r.failed || r.sizeMismatch || (args.maxMean !== null && r.meanChannelError > args.maxMean)
  );
  if (over.length === 0) return;
  if (args.maxMean === null && !over.some((r) => r.failed)) return;
  const bound = args.maxMean === null ? '' : ` or over --max-mean ${args.maxMean}/255`;
  console.error(`\n${over.length} scene(s) unmeasured${bound}: ` + over.map((r) => r.label).join(', '));
  process.exit(1);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
