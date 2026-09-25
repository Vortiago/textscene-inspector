#!/usr/bin/env node
/**
 * Re-renders each comparison image the sheets name in `image:` and `<!-- compare: -->` markers:
 * `pnpm recapture [--ours|--godot] [--only sky]`. `--ours` is the usual case, as Godot is deterministic and
 * our renderer drifts. `--only` keeps names that contain the fragment. Godot picks 2D or 3D from the scene.
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

// Guarded so an import of this entry does not start rendering.
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
