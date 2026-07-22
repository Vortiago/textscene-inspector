#!/usr/bin/env node
/**
 * Capture the "Complex Scenes" showcase — full demo/game scenes (dungeon, the 2D
 * and 3D platformers, a material-types scene) rendered through real Godot beside
 * this previewer, to show how feature-complete the renderer is on a whole scene
 * rather than a single node.
 *
 *   node scripts/compare-docs/capture-complex.mjs --godot   # reference side
 *   node scripts/compare-docs/capture-complex.mjs --ours    # our side
 *
 * These scenes live OUTSIDE scenes/fixtures/, and the Godot path differs from
 * the previewer's `?fixture=` value, so each entry carries both. Framing per
 * scene: a 2D scene renders through the project viewport (Camera2D ignored on
 * both sides, matching the still 2D capture); a 3D scene with its own gameplay
 * camera uses that camera on both sides; a 3D scene without a useful camera is
 * fit to its bounds. Reuses the still-capture pipeline, so the previewer chrome
 * is painted out exactly as in capture.mjs.
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { SWIFTSHADER_GL_ARGS } from '../showcase/browser.mjs';
import { renderReference } from '../godot-ref/run.mjs';
import {
  assertPortFree,
  createCaptureContext,
  ensureWebBuilt,
  findCaptureTarget,
  gotoFixture,
  killPreviewGroup,
  settleCanvas,
  startPreview,
  waitForServer,
} from '../visual/previewServer.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(here, '../..');
const IMAGES = join(REPO_ROOT, 'docs/comparison/images');
const PORT = Number(process.env.COMPARE_PORT) || 4321;

/**
 * `godot` is the scene path from the repo root; `ours` is the previewer's
 * `?fixture=` value (as apps/textscene-web/src/fixtures.ts lists it). `frame`
 * fits the 3D camera to the scene bounds; `sceneCamera` uses the scene's own
 * current camera. A 2D scene needs neither.
 */
export const COMPLEX_SCENES = [
  {
    slug: 'complex-isometric-dungeon',
    mode: '2d',
    godot: 'scenes/isometric/dungeon.tscn',
    ours: 'dungeon.tscn',
  },
  {
    slug: 'complex-2d-platformer',
    mode: '2d',
    godot: 'scenes/demos/2d/platformer/level/level.tscn',
    ours: 'demos/2d/platformer/level/level.tscn',
  },
  {
    // The editor orbit on BOTH sides — the previewer does not adopt a scene's
    // Camera3D, so opting only Godot into the game camera would mismatch. The
    // orbit gives a level overview, which showcases the whole scene anyway.
    slug: 'complex-3d-platformer',
    mode: '3d',
    godot: 'scenes/demos/3d/platformer/game.tscn',
    ours: 'demos/3d/platformer/game.tscn',
  },
  {
    slug: 'complex-materials',
    mode: '3d',
    frame: true,
    godot: 'scenes/fixtures/integration-material-features.tscn',
    ours: 'integration-material-features.tscn',
  },
];

function parseArgs(argv) {
  const args = { godot: false, ours: false, only: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--godot') args.godot = true;
    else if (argv[i] === '--ours') args.ours = true;
    else if (argv[i] === '--only') args.only = argv[++i];
  }
  if (!args.godot && !args.ours) {
    args.godot = true;
    args.ours = true;
  }
  return args;
}

async function captureGodot(scenes) {
  mkdirSync(IMAGES, { recursive: true });
  for (const c of scenes) {
    const scenePath = resolve(REPO_ROOT, c.godot);
    if (!existsSync(scenePath)) throw new Error(`No such scene: ${scenePath}`);
    process.stdout.write(`[complex godot] ${c.slug} … `);
    await renderReference({
      scene: scenePath,
      out: join(IMAGES, `${c.slug}-godot.png`),
      mode: c.mode,
      frame: c.frame ?? false,
      sceneCamera: c.sceneCamera ?? false,
    });
    console.log('ok');
  }
}

async function captureOurs(scenes) {
  ensureWebBuilt();
  await assertPortFree(PORT, 'COMPARE_PORT');
  const { proc, baseUrl } = startPreview(PORT);
  let browser;
  const failures = [];
  try {
    await waitForServer(`${baseUrl}/`);
    browser = await chromium.launch({ headless: true, args: SWIFTSHADER_GL_ARGS });
    for (const c of scenes) {
      process.stdout.write(`[complex ours] ${c.slug} (${c.mode}) … `);
      // Match the Godot framing: a 3D scene is fit to bounds on both sides only
      // when Godot fits it (`frame`); otherwise both use the fixed editor orbit.
      // 2D renders the project frame.
      const context = await createCaptureContext(browser, {
        frameOnOpen: c.mode === '3d' && (c.frame ?? false),
        canvas2D: c.mode === '2d',
      });
      const page = await context.newPage();
      try {
        await gotoFixture(page, baseUrl, c.ours);
        // A scene with BOTH 3D and 2D content (e.g. the 3D platformer's touch UI)
        // floats a "switch to 2D" hint button over the 3D canvas — chrome that
        // must not land in the capture. It carries no testid, so target its title.
        await page
          .addStyleTag({ content: 'button[title*="switch to the 2D view"]{display:none !important}' })
          .catch(() => {});
        const { target, reason } = await findCaptureTarget(page, { canvas2D: c.mode === '2d' });
        if (!target) throw new Error(reason);
        const { buffer, reason: settleReason } = await settleCanvas(page, target);
        if (!buffer) throw new Error(settleReason);
        writeFileSync(join(IMAGES, `${c.slug}-ours.png`), buffer);
        console.log('ok');
      } catch (error) {
        console.log(`FAILED: ${error.message}`);
        failures.push({ slug: c.slug, error: error.message });
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
  const scenes = args.only
    ? COMPLEX_SCENES.filter((c) => c.slug.includes(args.only))
    : COMPLEX_SCENES;
  if (scenes.length === 0) throw new Error(`No complex scene matches --only ${args.only}`);
  if (args.godot) await captureGodot(scenes);
  let failures = [];
  if (args.ours) failures = await captureOurs(scenes);
  console.log(`\n[complex] images in ${IMAGES}`);
  if (failures.length) {
    for (const f of failures) console.error(`  ${f.slug}: ${f.error}`);
    process.exit(1);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
