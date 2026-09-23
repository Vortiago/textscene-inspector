#!/usr/bin/env node
/**
 * Captures each fixture through real Godot and this previewer: `capture.mjs [--godot|--ours]
 * [--only <s>] [--force]`. A 3D pair shares Godot's editor camera (`Node3DEditorViewport::Cursor`),
 * a 2D pair the scene's viewport rectangle. An existing image is kept unless `--force`, so a stopped run resumes.
 */

import { captureGodot } from './capture/godotSide.mjs';
import { captureOurs } from './capture/oursSide.mjs';
import { loadPlan, parseArgs } from './capture/cli.mjs';
import { IMAGES } from './capture/paths.mjs';

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const fixtures = loadPlan(args.only);
  console.log(`[compare] ${fixtures.length} fixture(s)`);

  const failures = [];
  let godotModes = new Map();
  if (args.godot) {
    const godot = await captureGodot(fixtures, args.force);
    failures.push(...godot.failures);
    godotModes = godot.modes;
  }
  if (args.ours) failures.push(...(await captureOurs(fixtures, args.force, godotModes)));

  if (failures.length > 0) {
    console.error(`\n[compare] ${failures.length} capture(s) failed:`);
    for (const f of failures) console.error(`  ${f.fixture}: ${f.error}`);
    // A partial set still feeds the sheets, so the run finishes and exits
    // non-zero.
    process.exitCode = 1;
  }
  console.log(`\n[compare] images in ${IMAGES}`);
}

await main();
