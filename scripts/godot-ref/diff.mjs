#!/usr/bin/env node
/**
 * Parity measurement: render a scene through real Godot AND through the previewer,
 * then report how far apart they are.
 *
 *   pnpm ref:diff unit-csg-box.tscn
 *   pnpm ref:diff unit-csg-*.tscn --max-mean 2
 *
 * ## Why this exists
 *
 * `pnpm test:visual` compares the previewer against its own committed PNG, so it detects
 * CHANGE and can never detect WRONGNESS. A render that was wrong the day it was baselined
 * stays green forever. That is not hypothetical: `csg-cylinder-3d` matched its golden for
 * months while its cone apex was shaded unlike Godot's, because three.js gives a
 * collapsed apex nine distinct radial normals where Godot's `smooth_faces` averages every
 * face meeting at one position into a single normal.
 *
 * `ref:godot` and `ref:ours` could each answer that question already, but only one side at
 * a time and only by eye. This runs both at the same camera and prints the number, which
 * is what makes parity something you can put in a PR body instead of assert by assertion.
 *
 * ## Deliberately not a gate
 *
 * CI has no Godot and no xvfb, and committing reference PNGs so that it could have them
 * would mean fixtures are only editable by someone with Godot installed. The three
 * reference PNGs already in `scripts/godot-ref/reference/` show the other failure mode:
 * committed, asserted by nothing, and now of unknown freshness. So this is a tool the
 * author runs, exactly like `ref:godot` itself (see AGENTS.md).
 *
 * `--max-mean` is offered for scripted use and is opt-in; without it the command reports
 * and exits 0 whatever the numbers say.
 *
 * ## Reading the output
 *
 * Three numbers per scene, all per-channel and unweighted (`imageDelta.mjs`):
 *
 *   changed   the share of pixels differing at all. Between two DIFFERENT renderers this
 *             saturates — a half-bit of shading difference everywhere reads as ~100% —
 *             so it locates a difference rather than sizing it.
 *   max       the worst single-channel excursion. One resampled edge pixel can reach
 *             255, so this bounds the damage, it does not describe it.
 *   mean      mean |Δ| per channel over the whole frame. This is the parity statistic:
 *             it is what "closer to Godot" is measured in when a baseline is arbitrated,
 *             and the only one of the three that moves with the SIZE of a difference
 *             rather than its extent.
 *
 * The predecessor of these numbers was a single perceptual percentage, which can report
 * 0.000% for two images that share no identical pixel anywhere — a flat luminance or
 * chroma shift scores zero under a YIQ distance. An arbitration tool that inherits the
 * gate's blind spot is worse than none, because its answer is trusted more.
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
 * A fixture is addressed two different ways by the two harnesses: `ref:godot` wants a path
 * on disk, `ref:ours` wants the name the web app's fixture catalog lists. Accept either
 * form and produce both, so the caller never has to know.
 *
 * The catalog flattens `scenes/fixtures/` to a bare filename but keeps every other subtree
 * as a relative path (`demos/3d/truck_town/town/town_scene.tscn`). Taking the basename for
 * BOTH — as this did — silently measured the wrong scene for anything outside
 * `scenes/fixtures/`: the app rejects an unknown `?fixture=` and falls back to the stored
 * or default scene, so `ref:diff` on a demo compared Godot's town against our unit-plane
 * fixture and reported 25%. `gotoFixture` now also asserts the app opened what was asked
 * for, so a future mismatch fails instead of producing a number.
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
 * What the PNGs a run writes are named after.
 *
 * The catalog name rather than the basename, because two projects in one sweep
 * can both hold a `settings_menu.tscn` — and under a bare basename the second
 * scene's images silently overwrote the first's, leaving one scene's diff
 * filed under the other's name. `scenes/fixtures/` is flat, so its scenes keep
 * the bare name they always had.
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
 * Difference between two PNG buffers, plus the diff image — the same
 * measurement the golden gate asserts on (`../visual/imageDelta.mjs`), so a
 * parity number and a golden number mean the same thing.
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
 * One scene through both renderers.
 *
 * WHICH FRAME a scene is belongs to the engine, not to a flag: `run.mjs` picks
 * 2D or 3D from the scene root and reports the mode it rendered in. Our side
 * captures whatever that says, so the two rectangles agree by construction. It
 * used to always capture the 3D canvas, so every Control scene came back as a
 * SIZE MISMATCH and produced no number at all.
 *
 * The renderer and the capture are injected so the pairing above is assertable
 * without a Godot and a browser.
 */
export async function diffOne(
  { scenePath, fixtureName, label },
  { frame, keep },
  { render = renderReference, capture = captureOurs, outDir = OUT_DIR } = {}
) {
  const renderAs = async (renderMode) =>
    render({ scene: scenePath, out: join(outDir, `${label}.godot.png`), frame, mode: renderMode });
  // A project setting one of the root-window-only viewport settings cannot be
  // answered from the nested capture, and `run.mjs` refuses rather than return
  // the class default — naming the arm that can. Following that instruction is
  // the whole remedy, so a scene carrying one stays in the batch.
  const { out: godotOut, mode } = await renderAs('auto').catch((error) => {
    if (!error?.rootOnlyDrift) throw error;
    return renderAs('2d-root');
  });
  const godotBuffer = await readFile(godotOut);

  // The reference IS the project-viewport rect, which is also the rect our 2D
  // stage must lay out at 1:1 — so the picture the engine just produced is
  // what sizes the capture window, with nothing re-derived from the project
  // file on this side.
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
 * Every scene in the sweep, reported as it lands.
 *
 * A scene the harness cannot render is recorded as a `failed` row rather than
 * thrown: the tool is documented as `ref:diff unit-csg-*.tscn`, and aborting on
 * one scene measures nothing about the ones behind it.
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
    // captureOurs() rebuilds the web app on every call. The first render is the only one
    // that can see uncommitted source, so subsequent scenes in the same run reuse it.
    process.env.VISUAL_SKIP_BUILD = '1';
    console.log(formatResult(result));
  }
  return results;
}

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

  // A scene that never rendered is over ANY bound: it produced no number, which
  // is a worse answer than a large one.
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
