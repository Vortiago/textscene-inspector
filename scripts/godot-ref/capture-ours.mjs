#!/usr/bin/env node
/**
 * Our side of a parity measurement, `run.mjs`'s counterpart: the previewer
 * under SwiftShader, probes printed in `run.mjs`'s format. The scene is its
 * filename in `fixtures.ts`, so run `pnpm generate:fixtures` after adding one:
 *   pnpm ref:ours unit-light-transport-direct.tscn --probe 320,200 --patch 5
 * `--camera x,y,z [--look-at x,y,z]` replaces the editor orbit, as it does for `ref:godot`.
 * `--scene-camera [path]` looks through the scene's own Camera3D, as `ref:godot --scene-camera` does.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { probePixels, vec3 } from './run.mjs';
import { freeCameraPath, sceneCameraPath, withFreeCamera } from './ourCamera.mjs';
import { launchGodotComparisonBrowser } from '../showcase/browser.mjs';
import {
  createCaptureContext,
  openScene,
  previewPort,
  showDisplayOverlay,
  settleCanvas,
  withPreviewBrowser,
} from '../visual/previewServer.mjs';

export function parseArgs(argv) {
  const args = {
    fixture: null,
    out: null,
    probes: [],
    patch: 1,
    frame: false,
    canvas2D: false,
    camera: null,
    lookAt: null,
    sceneCamera: null,
    showCollisions: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--out':
        args.out = argv[++i];
        break;
      case '--patch':
        args.patch = Number(argv[++i]);
        break;
      case '--frame':
        args.frame = true;
        break;
      // The project viewport frame `ref:godot` picks by itself. A mismatch
      // fails instead of capturing the other frame.
      case '--2d':
        args.canvas2D = true;
        break;
      // As `ref:godot --debug-collisions`: Visible Collision Shapes.
      case '--collisions':
        args.showCollisions = true;
        break;
      // As `ref:godot` takes them: the camera replaces the editor orbit on both sides.
      case '--camera':
        args.camera = vec3('--camera', argv[++i]);
        break;
      case '--look-at':
        args.lookAt = vec3('--look-at', argv[++i]);
        break;
      // As `ref:godot` takes it: an optional path, the first Camera3D without one.
      case '--scene-camera':
        args.sceneCamera = argv[i + 1] && !String(argv[i + 1]).startsWith('--') ? argv[++i] : true;
        break;
      case '--probe': {
        const raw = argv[++i];
        const parts = String(raw).split(',').map(Number);
        if (parts.length !== 2 || parts.some((n) => !Number.isFinite(n))) {
          throw new Error(`--probe needs two comma-separated numbers, got "${raw}"`);
        }
        args.probes.push(parts);
        break;
      }
      default:
        if (arg.startsWith('--')) throw new Error(`Unknown flag ${arg}`);
        args.fixture = arg;
    }
  }
  if (!args.fixture) throw new Error('a fixture filename is required');
  if (args.lookAt && !args.camera) throw new Error('--look-at needs --camera');
  // `ref:godot --2d --scene-camera` keeps the scene's Camera2D, which the previewer never looks through.
  if (args.canvas2D && args.sceneCamera) throw new Error('--scene-camera needs a 3D capture, not --2d');
  return args;
}

export function captureOurs({
  fixture,
  frame = false,
  canvas2D = false,
  canvas2DFrame = null,
  camera = null,
  lookAt = null,
  sceneCamera = null,
  showCollisions = false,
}) {
  return withPreviewBrowser(
    { ...previewPort('parity'), launchBrowser: launchGodotComparisonBrowser },
    async (browser, baseUrl) => {
      // Godot's editor orbit (ADR-0025) on both sides, so a probe at (x, y)
      // addresses one surface point. `--frame` opts both into fit-the-bounds for
      // a scene too large to read at distance 4.
      const context = await createCaptureContext(browser, { frameOnOpen: frame, canvas2D, canvas2DFrame });
      const page = await context.newPage();
      const cameraPath = await cameraPathOf(page, baseUrl, fixture, { camera, lookAt, sceneCamera });
      const { target, reason: targetReason } = await openScene(page, baseUrl, fixture, {
        canvas2D,
        camera: cameraPath,
        onSlow: (ms) => console.log(`[ours] no network idle within ${ms}ms`),
      });
      if (!target) throw new Error(targetReason);
      const collisionsReason = showCollisions ? await showDisplayOverlay(page, 'Collisions') : null;
      if (collisionsReason) throw new Error(collisionsReason);
      const { buffer, reason } = await settleCanvas(page, target);
      if (!buffer) throw new Error(reason);
      return buffer;
    }
  );
}

/**
 * The camera to open the scene through, or undefined for the editor orbit. `--camera` overrides
 * every other choice, as in `ref:godot`.
 */
async function cameraPathOf(page, baseUrl, fixture, { camera, lookAt, sceneCamera }) {
  const url = fixtureFileUrl(baseUrl, fixture);
  if (camera) return addFreeCamera(page, url, { camera, lookAt: lookAt ?? undefined });
  if (sceneCamera) return sceneCameraPath(await fixtureText(page, url), sceneCamera) ?? undefined;
  return undefined;
}

function fixtureFileUrl(baseUrl, fixture) {
  return `${baseUrl.replace(/\/$/, '')}/fixtures/${fixture}`;
}

async function fixtureText(page, url) {
  return (await page.request.get(url)).text();
}

/** Serves the fixture at `url` with a Camera3D at the pose, and answers the path to open the scene through. */
async function addFreeCamera(page, url, pose) {
  const sceneText = await fixtureText(page, url);
  await page.route(url, (route) => route.fulfill({ body: withFreeCamera(sceneText, pose) }));
  return freeCameraPath(sceneText);
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    console.error('Usage: pnpm ref:ours <fixture.tscn> [--out file.png]');
    console.error(
      '       [--probe x,y] [--patch n] [--frame] [--2d] [--collisions] [--camera x,y,z] [--look-at x,y,z]'
    );
    console.error('       [--scene-camera [path]]');
    process.exit(2);
  }

  const buffer = await captureOurs(args);

  if (args.out) {
    const out = resolve(args.out);
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, buffer);
    console.log(`Rendered ${out}`);
  }

  for (const { x, y, rgb } of probePixels(buffer, args.probes, { patch: args.patch })) {
    console.log(`  probe ${x},${y} → rgb(${rgb.join(', ')})`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
