#!/usr/bin/env node
/**
 * Captures the "Complex Scenes" showcase: whole demo scenes through real Godot
 * beside this previewer, on the still-capture pipeline.
 *   node scripts/compare-docs/capture-complex.mjs --godot   # reference side
 *   node scripts/compare-docs/capture-complex.mjs --ours    # our side
 */

import { existsSync, mkdirSync } from 'node:fs';
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
  warmUpGLContext,
  writeCaptureImage,
} from '../visual/previewServer.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(here, '../..');
const IMAGES = join(REPO_ROOT, 'docs/comparison/images');
const PORT = Number(process.env.COMPARE_PORT) || 4321;

/**
 * These scenes live outside scenes/fixtures/. `godot` is the path from the repo
 * root, `ours` the `?fixture=` value from apps/textscene-web/src/fixtures.ts.
 * `frame` fits the 3D camera to the bounds, `sceneCamera` looks through the
 * scene's camera. A 2D scene uses the project viewport and ignores Camera2D.
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
    // The project sets `default_texture_filter`, which Godot hands to the root
    // Window only. The nested SubViewport arm refuses it, so the root-window arm
    // draws the same rectangle and observes it.
    godotMode: '2d-root',
    godot: 'scenes/demos/2d/platformer/level/level.tscn',
    ours: 'demos/2d/platformer/level/level.tscn',
  },
  {
    // The editor orbit on both sides: the previewer does not adopt a scene's
    // Camera3D, so the game camera on one side only would mismatch.
    slug: 'complex-3d-platformer',
    mode: '3d',
    godot: 'scenes/demos/3d/platformer/game.tscn',
    ours: 'demos/3d/platformer/game.tscn',
  },
  {
    // Both sides look through the scene's Camera3D (`?camera=` on ours), not
    // two fit-to-bounds passes, which diverge here because billboard Label3D
    // text extents differ per engine.
    slug: 'complex-materials',
    mode: '3d',
    sceneCamera: true,
    oursCamera: 'Root/Camera3D',
    godot: 'scenes/fixtures/integration-material-features.tscn',
    ours: 'integration-material-features.tscn',
  },
  {
    // Neither automatic framing works: a fit to the 2048 x 1104 x 2048 bounds
    // shrinks the town to a speck, and the editor orbit opens under the
    // terrain. Both sides look through the scene's PreviewCamera.
    slug: 'complex-truck-town',
    mode: '3d',
    sceneCamera: true,
    oursCamera: 'TownScene/PreviewCamera',
    godot: 'scenes/demos/3d/truck_town/town/town_scene.tscn',
    ours: 'demos/3d/truck_town/town/town_scene.tscn',
    // One software-rendered frame exceeds Playwright's default action timeout.
    settleTimeout: 120000,
  },
  {
    // A vehicle close enough to judge its decoded mesh, which the town shows
    // too far away. Both trucks carry surfaces in Godot 4.2+'s compressed
    // attribute layout on a whole vehicle body.
    slug: 'complex-truck-town-trailer',
    mode: '3d',
    frame: true,
    godot: 'scenes/demos/3d/truck_town/vehicles/trailer_truck.tscn',
    ours: 'demos/3d/truck_town/vehicles/trailer_truck.tscn',
  },
  {
    // The tow truck's mesh mixes compressed and uncompressed surfaces in one
    // file, which needs a per-surface drop.
    slug: 'complex-truck-town-tow',
    mode: '3d',
    frame: true,
    godot: 'scenes/demos/3d/truck_town/vehicles/tow_truck.tscn',
    ours: 'demos/3d/truck_town/vehicles/tow_truck.tscn',
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
      mode: c.godotMode ?? c.mode,
      frame: c.frame ?? false,
      sceneCamera: c.sceneCamera ?? false,
      // Both sides name one camera, or a scene with several Camera3Ds leaves
      // Godot to tree order and the previewer to `oursCamera`.
      sceneCameraPath: c.oursCamera ?? null,
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
    // Spends the first-context-lost risk before any published image.
    await warmUpGLContext(browser);
    for (const c of scenes) {
      process.stdout.write(`[complex ours] ${c.slug} (${c.mode}) … `);
      // A 3D scene is fit only when Godot fits it (`frame`). Otherwise both use
      // the editor orbit, or the named `oursCamera`.
      const context = await createCaptureContext(browser, {
        frameOnOpen: c.mode === '3d' && (c.frame ?? false),
        canvas2D: c.mode === '2d',
      });
      const page = await context.newPage();
      try {
        await gotoFixture(page, baseUrl, c.ours, () => {}, c.oursCamera ? { camera: c.oursCamera } : {});
        // A scene with both 3D and 2D content floats a "switch to 2D" button over
        // the canvas. It carries no testid, so this hides it by its title.
        await page
          .addStyleTag({ content: 'button[title*="switch to the 2D view"]{display:none !important}' })
          .catch(() => {});
        const { target, reason } = await findCaptureTarget(page, { canvas2D: c.mode === '2d' });
        if (!target) throw new Error(reason);
        const { buffer, reason: settleReason } = await settleCanvas(page, target, {
          screenshotTimeout: c.settleTimeout,
        });
        if (!buffer) throw new Error(settleReason);
        writeCaptureImage(join(IMAGES, `${c.slug}-ours.png`), buffer, `${c.slug} ours`);
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
