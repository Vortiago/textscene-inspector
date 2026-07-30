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
    // The scene authors a Camera3D framing the material spheres head-on; both
    // sides render through it (Godot adopts the scene camera, the previewer
    // activates it via `?camera=`), so the framing matches by construction
    // instead of relying on two independent fit-to-bounds passes — which
    // diverge here because billboard Label3D text extents differ per engine.
    slug: 'complex-materials',
    mode: '3d',
    sceneCamera: true,
    oursCamera: 'Root/Camera3D',
    godot: 'scenes/fixtures/integration-material-features.tscn',
    ours: 'integration-material-features.tscn',
  },
  {
    // A whole game world: a glTF town model, ten instanced lamp sub-scenes, a
    // CSG racetrack, a WorldEnvironment with sky + fog, shadows, and a Control
    // UI over the top. Neither automatic framing works — the scene's bounds are
    // 2048 x 1104 x 2048, so a fit shot shrinks the town to a speck, and the
    // editor orbit opens 4 units from the origin, under the terrain — so the
    // scene carries a PreviewCamera that both sides look through.
    slug: 'complex-truck-town',
    mode: '3d',
    sceneCamera: true,
    oursCamera: 'TownScene/PreviewCamera',
    godot: 'scenes/demos/3d/truck_town/town/town_scene.tscn',
    ours: 'demos/3d/truck_town/town/town_scene.tscn',
    // The heaviest scene in the corpus; one software-rendered frame exceeds
    // Playwright's default action timeout.
    settleTimeout: 120000,
  },
  {
    // A vehicle on its own, framed by a fit. The town scene shows the trucks at
    // a distance where a wrong vertex layout reads as noise; these show the
    // decoded mesh close enough to judge. Both carry surfaces in Godot 4.2+'s
    // compressed attribute layout — the only place in the corpus where an
    // ArrayMesh drives a whole vehicle body rather than a test quad.
    slug: 'complex-truck-town-trailer',
    mode: '3d',
    frame: true,
    godot: 'scenes/demos/3d/truck_town/vehicles/trailer_truck.tscn',
    ours: 'demos/3d/truck_town/vehicles/trailer_truck.tscn',
  },
  {
    // The tow truck's mesh mixes compressed and uncompressed surfaces inside
    // one file, which is what made a per-surface drop necessary.
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
      // Match the Godot framing. A 3D scene is fit to bounds on both sides only
      // when Godot fits it (`frame`); `oursCamera` instead looks through a
      // named scene Camera3D (Godot's `sceneCamera`), which needs neither fit;
      // otherwise both use the fixed editor orbit. 2D renders the project frame.
      const context = await createCaptureContext(browser, {
        frameOnOpen: c.mode === '3d' && (c.frame ?? false),
        canvas2D: c.mode === '2d',
      });
      const page = await context.newPage();
      try {
        await gotoFixture(page, baseUrl, c.ours, () => {}, c.oursCamera ? { camera: c.oursCamera } : {});
        // A scene with BOTH 3D and 2D content (e.g. the 3D platformer's touch UI)
        // floats a "switch to 2D" hint button over the 3D canvas — chrome that
        // must not land in the capture. It carries no testid, so target its title.
        await page
          .addStyleTag({ content: 'button[title*="switch to the 2D view"]{display:none !important}' })
          .catch(() => {});
        const { target, reason } = await findCaptureTarget(page, { canvas2D: c.mode === '2d' });
        if (!target) throw new Error(reason);
        const { buffer, reason: settleReason } = await settleCanvas(page, target, {
          screenshotTimeout: c.settleTimeout,
        });
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
