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
 * Both sides default to Godot's editor camera (`Node3DEditorViewport::Cursor`)
 * at the same frame size, so a pixel means the same thing in both images
 * without any per-fixture camera derivation.
 *
 * `--only <substring>` restricts the run while iterating. Existing images are
 * skipped unless `--force` is passed, so an interrupted run resumes.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { SWIFTSHADER_GL_ARGS } from '../showcase/browser.mjs';
import { renderReference } from '../godot-ref/run.mjs';
import {
  assertPortFree,
  createCaptureContext,
  ensureWebBuilt,
  findCanvas,
  gotoFixture,
  killPreviewGroup,
  settleCanvas,
  startPreview,
  waitForServer,
} from '../visual/previewServer.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(here, '../..');
const PLAN = join(here, 'plan.json');
const IMAGES = join(here, 'images');

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

async function captureGodot(fixtures, force) {
  mkdirSync(IMAGES, { recursive: true });
  const failures = [];
  for (const [i, fixture] of fixtures.entries()) {
    const out = imagePath(fixture, 'godot');
    if (!force && existsSync(out)) {
      console.log(`[godot] ${i + 1}/${fixtures.length} ${fixture} — have it`);
      continue;
    }
    process.stdout.write(`[godot] ${i + 1}/${fixtures.length} ${fixture} … `);
    try {
      await renderReference({ scene: join(REPO_ROOT, 'scenes/fixtures', fixture), out });
      console.log('ok');
    } catch (error) {
      // One unrenderable scene must not cost the other sixty.
      console.log(`FAILED: ${error.message.split('\n')[0]}`);
      failures.push({ fixture, error: error.message.split('\n')[0] });
    }
  }
  return failures;
}

async function captureOurs(fixtures, force) {
  mkdirSync(IMAGES, { recursive: true });
  const pending = fixtures.filter((f) => force || !existsSync(imagePath(f, 'ours')));
  if (pending.length === 0) {
    console.log('[ours] nothing to capture');
    return [];
  }

  ensureWebBuilt();
  await assertPortFree(PORT, 'COMPARE_PORT');
  const { proc, baseUrl } = startPreview(PORT);
  const failures = [];
  let browser;
  try {
    await waitForServer(`${baseUrl}/`);
    browser = await chromium.launch({ headless: true, args: SWIFTSHADER_GL_ARGS });
    // Godot's editor camera, matching the reference side — see the header.
    const context = await createCaptureContext(browser, { frameOnOpen: false });
    const page = await context.newPage();

    for (const [i, fixture] of pending.entries()) {
      process.stdout.write(`[ours] ${i + 1}/${pending.length} ${fixture} … `);
      try {
        await gotoFixture(page, baseUrl, fixture);
        const { canvas, reason: canvasReason } = await findCanvas(page);
        if (!canvas) throw new Error(canvasReason);
        const { buffer, reason } = await settleCanvas(page, canvas);
        if (!buffer) throw new Error(reason);
        writeFileSync(imagePath(fixture, 'ours'), buffer);
        console.log('ok');
      } catch (error) {
        console.log(`FAILED: ${error.message}`);
        failures.push({ fixture, error: error.message });
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
  if (args.godot) failures.push(...(await captureGodot(fixtures, args.force)));
  if (args.ours) failures.push(...(await captureOurs(fixtures, args.force)));

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
