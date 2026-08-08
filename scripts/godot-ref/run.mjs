#!/usr/bin/env node
/**
 * Godot reference-render harness — renders a `.tscn` through the REAL engine so
 * parity questions are answered by measurement instead of derivation.
 *
 *   pnpm ref:godot scenes/fixtures/unit-plane-mesh.tscn --out /tmp/ref.png
 *   pnpm ref:godot scripts/godot-ref/scenes/preview-lighting.tscn \
 *     --camera 0,1.5,4 --look-at 0,0.8,0 --probe 200,8 --probe 200,292
 *
 * `--probe x,y` prints the exact RGB at that pixel, which is what turns "close
 * to Godot" into a number.
 *
 * Requires a local Godot 4.6 (`godot`) and `xvfb-run`; there is no CI copy of
 * either, so this is a developer tool, never a gate.
 *
 * CAMERA: by default this opens where Godot's EDITOR opens every scene —
 * `Node3DEditorViewport::Cursor()`'s fixed orbit at distance 4, fov 70 — which
 * is exactly where the previewer opens it too. So a bare `ref:godot` and a bare
 * `ref:ours` produce the same frame with nothing derived and nothing to keep in
 * sync, and "the pixel at (x, y)" means the same thing on both sides.
 *
 * A scene's own `Camera3D` is IGNORED by default, because the previewer ignores
 * it too: Godot's editor keeps its own free camera and draws the node as a
 * frustum gizmo. `--scene-camera` opts into rendering through it.
 *
 * `--frame` instead fits the scene's geometry bounds the way `frameSceneBounds.ts`
 * does (the previewer's opt-in "frame on open"), for a scene too large to read
 * at distance 4. `--camera` / `--look-at` override everything.
 *
 * 2D: a scene whose root is a CanvasItem (or a CanvasLayer) has no 3D camera to
 * place, and forcing one renders a sky with the scene's Controls laid out
 * against the wrong rectangle. Such a scene renders instead through a
 * SubViewport the size of Godot's project viewport — the same rectangle the
 * previewer's 2D stage draws — so both sides produce the game frame 1:1 and
 * `--width` / `--height` (which size the 3D frame) do not apply. `--mode`
 * forces the choice when the root's type does not settle it.
 *
 * TWO THINGS THIS HARNESS DOES THAT A NAIVE `godot --path` DOES NOT:
 *
 * 1. **It injects the editor previews.** `godot --path` runs the GAME. Godot's
 *    preview sun and preview environment are `Node3DEditor` members and do not
 *    exist at runtime, so a raw render of an unlit scene is black — a picture
 *    Godot never shows the user. The generated bootstrap re-implements
 *    `Node3DEditor::_node_added`'s yield rule (two independent presence checks,
 *    by node type, ignoring `visible`) and `_load_default_preview_settings`'s
 *    values. `--no-previews` renders true runtime semantics instead.
 * 2. **It strips `default_environment`.** A project-level default environment
 *    would light the scene through a channel the previewer has no notion of,
 *    silently biasing every comparison.
 *
 * The parts live beside this file — `refArgs` (the command line), `refConstants`
 * (the frame and camera the reference renders at), `refProject` (the scratch
 * project), `bootstrap` (the generated GDScript), `render` (running Godot) and
 * `refProbe` (reading pixels back). They are re-exported here, so a caller
 * importing `run.mjs` never depends on which of them owns a given piece.
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { CANVAS_2D_CAPTURE } from '../visual/previewServer.mjs';
import { parseArgs } from './refArgs.mjs';
import { RENDER_MODES } from './refConstants.mjs';
import { probePixels } from './refProbe.mjs';
import { renderReference } from './render.mjs';

export { bootstrapScript } from './bootstrap.mjs';
export {
  EDITOR_CAMERA_DIRECTION,
  EDITOR_CAMERA_DISTANCE,
  EDITOR_FOV,
  FRAME_MARGIN,
  RENDER_MODES,
} from './refConstants.mjs';
export { projectConfig, projectViewportSizeFromIni, resolveProjectRoot } from './refProject.mjs';
export { parseArgs, probePixels, renderReference };

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.scene) {
    console.error('usage: pnpm ref:godot <scene.tscn> [--out png] [--camera x,y,z]');
    console.error(
      '       [--look-at x,y,z] [--probe x,y] [--patch n] [--no-previews] [--width n] [--height n]'
    );
    console.error(
      `       [--mode ${RENDER_MODES.join('|')}]  (2d renders the project viewport, ` +
        `${CANVAS_2D_CAPTURE.width}x${CANVAS_2D_CAPTURE.height}; --width/--height size the 3D frame)`
    );
    process.exit(2);
  }

  const out = args.out ?? join(import.meta.dirname, 'output', `${basename(args.scene, '.tscn')}.png`);
  await mkdir(dirname(out), { recursive: true });
  const boundsOut = args.emitBounds ? out.replace(/\.png$/, '.bounds.json') : null;
  const { out: written, mode } = await renderReference({ ...args, out, boundsOut });
  console.log(`Rendered ${written}${mode ? ` (${mode})` : ''}`);
  if (boundsOut && existsSync(boundsOut)) console.log(`Bounds ${boundsOut}`);

  if (args.probes.length > 0) {
    const buffer = await readFile(written);
    for (const { x, y, rgb } of probePixels(buffer, args.probes, { patch: args.patch })) {
      console.log(`  probe ${x},${y} → rgb(${rgb.join(', ')})`);
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
