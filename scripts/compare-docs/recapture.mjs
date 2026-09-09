#!/usr/bin/env node
/**
 * Re-render EVERY comparison image the sheets reference — one command to refresh
 * the whole gallery after a renderer change, so no sheet is left showing a stale
 * frame. The sheets are the source of truth: each sheet's `image:`/`fixture:` and
 * each section's `<!-- compare: image= fixture= -->` marker names an image and the
 * scene that produces it.
 *
 *   pnpm recapture              # re-render godot + ours for every sheet image
 *   pnpm recapture --ours       # only ours (Godot is deterministic; this is the
 *                               # usual case — our renderer is what drifts)
 *   pnpm recapture --only sky   # limit to images whose name contains "sky"
 *
 * Godot detects 2D vs 3D from the scene, so both sides frame the same way with no
 * per-image config; a sheet's `camera:` (a scene Camera3D path) is looked through
 * on both sides when present.
 *
 * The parts live in `recapture/`: `cli` (the flags), `targets` (what the sheets
 * ask for, where it lands, and which script owns it), `godotSide` / `oursSide`
 * (the two renderers) and `complex` (the delegation to capture-complex.mjs).
 */
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { IMAGES_DIR as IMAGES } from './sheetSources.mjs';
import { parseArgs } from './recapture/cli.mjs';
import { captureGodot } from './recapture/godotSide.mjs';
import { captureOurs } from './recapture/oursSide.mjs';
import { runComplex } from './recapture/complex.mjs';
import { collectTargets, partitionTargets } from './recapture/targets.mjs';

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let targets = collectTargets();
  if (args.only) targets = targets.filter((t) => t.image.includes(args.only));
  const { own, delegated } = partitionTargets(targets);
  if (!targets.length) throw new Error(args.only ? `No sheet image matches --only ${args.only}` : 'No sheet images found');
  console.log(`Re-rendering ${own.length} comparison image(s)…`);

  const godot = args.godot ? await captureGodot(own) : { modes: new Map(), failures: [] };
  const oursFailures = args.ours ? await captureOurs(own, godot.modes) : [];
  const delegatedFailures = await runComplex(delegated, args);

  const failures = [...godot.failures, ...oursFailures, ...delegatedFailures];
  console.log(`\n[recapture] images in ${IMAGES}`);
  if (failures.length) {
    console.warn(`\n${failures.length} failure(s):`);
    for (const f of failures) console.warn(`  - ${f.image}: ${f.error}`);
    process.exitCode = 1;
  }
}

// Guarded so an unguarded main() cannot start rendering the moment anything
// imports this entry.
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
