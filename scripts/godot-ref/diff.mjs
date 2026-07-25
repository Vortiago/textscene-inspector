#!/usr/bin/env node
/**
 * Parity measurement: render a scene through real Godot AND through the previewer,
 * then report how far apart they are.
 *
 *   pnpm ref:diff unit-csg-box.tscn
 *   pnpm ref:diff unit-csg-*.tscn --max 0.2
 *
 * ## Why this exists
 *
 * `pnpm test:visual` compares the previewer against its own committed PNG, so it detects
 * CHANGE and can never detect WRONGNESS. A render that was wrong the day it was baselined
 * stays green forever. That is not hypothetical: `csg-cylinder-3d` passed its 0.1% golden
 * for months while sitting 0.788% away from Godot, because three.js gives a collapsed cone
 * apex nine distinct radial normals where Godot's `smooth_faces` averages every face
 * meeting at one position into a single normal.
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
 * `--max` is offered for scripted use and is opt-in; without it the command reports and
 * exits 0 whatever the numbers say.
 *
 * ## Reading the output
 *
 * Two renderers never agree byte-for-byte. Measured floor on this corpus is 0.011% to
 * 0.013% for a clean single-object scene and 0.069% for a silhouette-heavy four-object
 * one, all antialiasing along edges. A real geometry or shading bug reads an order of
 * magnitude above that.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, join, relative as relativePath, resolve, sep } from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { renderReference } from './run.mjs';
import { captureOurs } from './capture-ours.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const FIXTURE_DIR = join(REPO_ROOT, 'scenes', 'fixtures');
const OUT_DIR = join(import.meta.dirname, 'output');

/** Same tolerance the visual harness uses, so the two numbers are comparable. */
const PIXELMATCH_THRESHOLD = 0.1;

function usage() {
  console.error(
    'Usage: pnpm ref:diff <fixture.tscn> [more.tscn ...] [--max <pct>] [--frame] [--keep]\n' +
      '\n' +
      '  <fixture.tscn>  fixture filename as listed in apps/textscene-web/src/fixtures.ts,\n' +
      '                  or a path to a .tscn under scenes/\n' +
      '  --max <pct>     exit 1 if any scene exceeds this percentage (default: report only)\n' +
      '  --frame         fit-the-bounds camera on BOTH sides instead of the editor orbit\n' +
      '  --keep          keep the per-side PNGs, not just the diff'
  );
}

export function parseArgs(argv) {
  const args = { fixtures: [], max: null, frame: false, keep: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--max') {
      args.max = Number(argv[++i]);
      if (!Number.isFinite(args.max)) throw new Error(`--max needs a number, got "${argv[i]}"`);
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
  return { scenePath, fixtureName: catalogName(scenePath), label: basename(name, '.tscn') };
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

/** Pixel difference between two PNG buffers, plus the diff image. */
export function comparePngs(godotBuffer, oursBuffer) {
  const a = PNG.sync.read(godotBuffer);
  const b = PNG.sync.read(oursBuffer);
  if (a.width !== b.width || a.height !== b.height) {
    return {
      sizeMismatch: `godot ${a.width}x${a.height} vs ours ${b.width}x${b.height}`,
    };
  }
  const diff = new PNG({ width: a.width, height: a.height });
  const pixels = pixelmatch(a.data, b.data, diff.data, a.width, a.height, {
    threshold: PIXELMATCH_THRESHOLD,
  });
  return {
    pixels,
    pct: (pixels / (a.width * a.height)) * 100,
    width: a.width,
    height: a.height,
    diff,
  };
}

async function diffOne({ scenePath, fixtureName, label }, { frame, keep }) {
  const godotOut = join(OUT_DIR, `${label}.godot.png`);
  await renderReference({ scene: scenePath, out: godotOut, frame });
  const godotBuffer = await readFile(godotOut);

  const oursBuffer = await captureOurs({ fixture: fixtureName, frame });
  if (keep) await writeFile(join(OUT_DIR, `${label}.ours.png`), oursBuffer);

  const result = comparePngs(godotBuffer, oursBuffer);
  if (result.sizeMismatch) return { label, ...result };

  if (result.pixels > 0) {
    const diffPath = join(OUT_DIR, `${label}.diff.png`);
    await writeFile(diffPath, PNG.sync.write(result.diff));
    result.diffPath = diffPath;
  }
  return { label, ...result };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.fixtures.length === 0) {
    usage();
    process.exit(2);
  }
  await mkdir(OUT_DIR, { recursive: true });

  const targets = args.fixtures.map(resolveFixture);
  const results = [];
  for (const target of targets) {
    const result = await diffOne(target, args);
    results.push(result);
    // captureOurs() rebuilds the web app on every call. The first render is the only one
    // that can see uncommitted source, so subsequent scenes in the same run reuse it.
    process.env.VISUAL_SKIP_BUILD = '1';

    if (result.sizeMismatch) {
      console.log(`${result.label.padEnd(28)} SIZE MISMATCH  ${result.sizeMismatch}`);
    } else {
      const pct = `${result.pct.toFixed(3)}%`;
      console.log(
        `${result.label.padEnd(28)} ${pct.padStart(8)}  ` +
          `(${result.pixels} px of ${result.width}x${result.height})` +
          (result.diffPath ? `  ${result.diffPath}` : '')
      );
    }
  }

  if (args.max === null) return;
  const over = results.filter((r) => r.sizeMismatch || r.pct > args.max);
  if (over.length > 0) {
    console.error(`\n${over.length} scene(s) over --max ${args.max}%: ${over.map((r) => r.label).join(', ')}`);
    process.exit(1);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
