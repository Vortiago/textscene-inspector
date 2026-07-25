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
 * derivation. A 2D scene has no such camera: both sides render the project
 * viewport rectangle 1:1 instead (see `CANVAS_2D_CAPTURE`).
 *
 * WHICH of the two a fixture is comes from GODOT, which knows its own class
 * hierarchy, and our side then has to AGREE — the previewer picks its workspace
 * from the scene root independently (`workspaceForScene.ts`), so a disagreement
 * means the pair would show two different renderings of two different scenes'
 * worth of framing. It is reported, not reconciled.
 *
 * `--only <substring>` restricts the run while iterating. Existing images are
 * skipped unless `--force` is passed, so an interrupted run resumes.
 */

import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { SWIFTSHADER_GL_ARGS } from '../showcase/browser.mjs';
import { renderReference } from '../godot-ref/run.mjs';
import {
  assertPortFree,
  CANVAS_2D_CAPTURE,
  createCaptureContext,
  ensureWebBuilt,
  findCaptureTarget,
  gotoFixture,
  killPreviewGroup,
  readViewportMode,
  settleCanvas,
  startPreview,
  waitForServer,
} from '../visual/previewServer.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(here, '../..');
const PLAN = join(here, 'plan.json');
// Beside the sheets that embed them, so a sheet's `![](images/...)` link is
// relative and the pair travels together.
const IMAGES = join(REPO_ROOT, 'docs/comparison/images');

// Distinct from both the golden harness (4317) and the single-shot parity
// capture (4319), so a long batch run cannot collide with either.
const PORT = Number(process.env.COMPARE_PORT) || 4321;

function parseArgs(argv) {
  const args = { godot: false, ours: false, only: null, force: false };
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--godot':
        args.godot = true;
        break;
      case '--ours':
        args.ours = true;
        break;
      case '--force':
        args.force = true;
        break;
      case '--only':
        args.only = argv[++i];
        break;
      default:
        throw new Error(`Unknown flag ${argv[i]}`);
    }
  }
  if (!args.godot && !args.ours) {
    args.godot = true;
    args.ours = true;
  }
  return args;
}

function loadPlan(only) {
  if (!existsSync(PLAN)) {
    throw new Error(`No capture plan at ${PLAN} — generate it before capturing.`);
  }
  const plan = JSON.parse(readFileSync(PLAN, 'utf8'));
  const fixtures = only ? plan.distinct.filter((f) => f.includes(only)) : plan.distinct;
  if (fixtures.length === 0) throw new Error(`No fixture matches --only ${only}`);
  return fixtures;
}

const imagePath = (fixture, side) => join(IMAGES, `${fixture.replace(/\.tscn$/, '')}-${side}.png`);

/**
 * A PNG's dimensions, straight out of the IHDR header — the reference image's
 * size is what a skipped/earlier Godot pass left behind saying which frame it
 * rendered, and decoding sixty full images to read six bytes each is waste.
 */
function pngSize(file) {
  const header = Buffer.alloc(24);
  const fd = openSync(file, 'r');
  try {
    readSync(fd, header, 0, header.length, 0);
  } finally {
    closeSync(fd);
  }
  return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
}

function modeOfImage(file) {
  const { width, height } = pngSize(file);
  return width === CANVAS_2D_CAPTURE.width && height === CANVAS_2D_CAPTURE.height ? '2d' : '3d';
}

async function captureGodot(fixtures, force) {
  mkdirSync(IMAGES, { recursive: true });
  const failures = [];
  const modes = new Map();
  for (const [i, fixture] of fixtures.entries()) {
    const out = imagePath(fixture, 'godot');
    if (!force && existsSync(out)) {
      console.log(`[godot] ${i + 1}/${fixtures.length} ${fixture} — have it`);
      continue;
    }
    process.stdout.write(`[godot] ${i + 1}/${fixtures.length} ${fixture} … `);
    try {
      const { mode } = await renderReference({
        scene: join(REPO_ROOT, 'scenes/fixtures', fixture),
        out,
      });
      if (mode) modes.set(fixture, mode);
      console.log(`ok (${mode ?? 'mode unknown'})`);
    } catch (error) {
      // One unrenderable scene must not cost the other sixty.
      console.log(`FAILED: ${error.message.split('\n')[0]}`);
      failures.push({ fixture, error: error.message.split('\n')[0] });
    }
  }
  return { failures, modes };
}

/**
 * The workspace each fixture is captured in, from the side that knows: Godot.
 * A fixture the reference pass skipped takes it from the reference IMAGE, whose
 * size already says which frame was rendered — and one with no reference at all
 * is not capturable, because there is nothing to compare it against anyway.
 */
function resolveModes(fixtures, godotModes) {
  const modes = new Map();
  const unknown = [];
  for (const fixture of fixtures) {
    const reported = godotModes.get(fixture);
    if (reported) {
      modes.set(fixture, reported);
      continue;
    }
    const reference = imagePath(fixture, 'godot');
    if (existsSync(reference)) modes.set(fixture, modeOfImage(reference));
    else unknown.push(fixture);
  }
  return { modes, unknown };
}

async function captureOurs(fixtures, force, godotModes) {
  mkdirSync(IMAGES, { recursive: true });
  const pending = fixtures.filter((f) => force || !existsSync(imagePath(f, 'ours')));
  if (pending.length === 0) {
    console.log('[ours] nothing to capture');
    return [];
  }

  const { modes, unknown } = resolveModes(pending, godotModes);
  const failures = unknown.map((fixture) => ({
    fixture,
    error: 'no reference render to take the 2D/3D mode from — capture --godot first',
  }));
  const capturable = pending.filter((f) => modes.has(f));
  if (capturable.length === 0) return failures;

  ensureWebBuilt();
  await assertPortFree(PORT, 'COMPARE_PORT');
  const { proc, baseUrl } = startPreview(PORT);
  let browser;
  try {
    await waitForServer(`${baseUrl}/`);
    browser = await chromium.launch({ headless: true, args: SWIFTSHADER_GL_ARGS });

    // One context per workspace, not per fixture: the two need different
    // browser viewports and different seeded preferences, and a context is far
    // more expensive than the navigation it hosts.
    let done = 0;
    for (const mode of ['3d', '2d']) {
      const group = capturable.filter((f) => modes.get(f) === mode);
      if (group.length === 0) continue;
      // 3D: Godot's editor camera, matching the reference side. 2D: the project
      // viewport rectangle at zoom 1, with the stage's chrome painted out.
      const context = await createCaptureContext(browser, {
        frameOnOpen: false,
        canvas2D: mode === '2d',
      });
      const page = await context.newPage();
      try {
        for (const fixture of group) {
          process.stdout.write(`[ours] ${++done}/${capturable.length} ${fixture} (${mode}) … `);
          try {
            await gotoFixture(page, baseUrl, fixture);
            const { target, reason: targetReason } = await findCaptureTarget(page, {
              canvas2D: mode === '2d',
            });
            if (!target) throw new Error(targetReason);
            const { buffer, reason } = await settleCanvas(page, target);
            if (!buffer) throw new Error(reason);
            // Asked once the frame has settled, not before: the workspace claim
            // is re-derived as a scene's sub-resources land, so a page read
            // early enough can still be showing the 3D default.
            const opened = await readViewportMode(page);
            if (opened !== mode) {
              throw new Error(
                `the previewer opened this scene in ${opened.toUpperCase()} but Godot rendered ` +
                  `it as ${mode.toUpperCase()} — the two frames are not comparable`
              );
            }
            writeFileSync(imagePath(fixture, 'ours'), buffer);
            console.log('ok');
          } catch (error) {
            console.log(`FAILED: ${error.message}`);
            failures.push({ fixture, error: error.message });
          }
        }
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser?.close();
    killPreviewGroup(proc);
  }
  return failures;
}

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
