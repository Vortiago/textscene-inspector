#!/usr/bin/env node
/**
 * Batch capture for the comparison sheets — the same scene through real Godot
 * and through this previewer, from the same camera, for many fixtures at once.
 *
 *   node scripts/compare-docs/capture.mjs --godot   # reference side
 *   node scripts/compare-docs/capture.mjs --ours    # our side
 *   node scripts/compare-docs/capture.mjs           # both
 *
 * Why a batch tool rather than looping `ref:godot` / `ref:ours`: each
 * `ref:ours` invocation rebuilds the web app, starts a preview server and
 * launches a browser. Sixty of those is sixty builds — and running them
 * concurrently is worse, because they would fight over the same port and
 * `assertPortFree` would (correctly) kill all but one. So the capture is
 * SERIAL over one build, one server and one browser, and only the writing of
 * the sheets fans out.
 *
 * A 3D scene is captured from Godot's editor camera
 * (`Node3DEditorViewport::Cursor`) at the same frame size on both sides, so a
 * pixel means the same thing in both images without any per-fixture camera
 * derivation. A 2D scene has no such camera: both sides render the SCENE's own
 * project viewport rectangle instead (`display/window/size/viewport_*`, which
 * 23 of the corpus's projects set), so that rect is per-fixture rather than a
 * constant, and the workspace is recorded beside each image rather than
 * inferred from its size.
 *
 * WHICH of the two a fixture is comes from GODOT, which knows its own class
 * hierarchy, and our side then has to AGREE — the previewer picks its workspace
 * from the scene root independently (`workspaceForScene.ts`), so a disagreement
 * means the pair would show two different renderings of two different scenes'
 * worth of framing. It is reported, not reconciled.
 *
 * `--only <substring>` restricts the run while iterating. Existing images are
 * skipped unless `--force` is passed, so an interrupted run resumes.
 *
 * The parts live in `capture/`: `cli` (flags and the fixture list), `paths`,
 * `modes` (the 2D/3D workspace a pair is framed in), and one module per side —
 * `godotSide` and `oursSide`.
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
    // A partial set is still useful — the sheets for what DID capture can be
    // written — so this reports loudly and exits non-zero without pretending
    // the run succeeded.
    process.exitCode = 1;
  }
  console.log(`\n[compare] images in ${IMAGES}`);
}

await main();
