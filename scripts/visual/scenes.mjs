/**
 * The golden-scene manifest: WebGL-canvas scenes only, with no 2D DOM overlay, so the image depends
 * on the renderer alone. A resource load must resolve from local fixtures and settle (`arraymesh`,
 * `decal`). `file` is the fixture filename exactly as in apps/textscene-web/src/fixtures.ts. An
 * entry may set `mode: '2d'`, `collisions: true`, `navigation: true`, `gizmos: true`, which turns the
 * Gizmos toggle on (off in every other capture), `select: <node path>`,
 * `camera: <Camera3D node path>`, which the previewer looks through as `?camera=` opens it, or
 * `canvas: { width, height }`, the 3D canvas size a small frame renders at, or `settleTimeout: <ms>`,
 * each screenshot's limit where one frame outlasts Playwright's default. `pnpm recapture` takes the
 * same limit for the sheet image of the scene's fixture.
 */

import { GEOMETRY_SCENES } from './scenes/geometry.mjs';
import { LIGHTING_SCENES } from './scenes/lighting.mjs';
import { SCENE_COMPOSITION_SCENES } from './scenes/composition.mjs';
import { GIZMO_SCENES } from './scenes/gizmos.mjs';
import { PRIMITIVE_SCENES } from './scenes/primitives.mjs';
import { CANVAS_2D_SCENES } from './scenes/canvas2d.mjs';
import { MATERIAL_SCENES } from './scenes/materials.mjs';
import { TILE_AND_TARGET_SCENES } from './scenes/targets.mjs';

/** The options an entry may set. The capture reads no other, so `scenes.test.mjs` refuses one. */
export const SCENE_OPTIONS = [
  'name',
  'file',
  'mode',
  'collisions',
  'navigation',
  'gizmos',
  'select',
  'camera',
  'canvas',
  'settleTimeout',
];

/**
 * Not in the set until fixed: unit-label3d.tscn, whose labels render near invisible after
 * auto-framing (pixel_size 0.005 is about 0.08 world units tall). unit-animation-player*.tscn
 * stays out: the fixtures exist to be played, and playback never reaches a byte-stable frame.
 */
export const GOLDEN_SCENES = [
  // The `scenes/` chapters run in the order they are concatenated here.
  ...GEOMETRY_SCENES,
  ...LIGHTING_SCENES,
  ...SCENE_COMPOSITION_SCENES,
  // The scenes with `gizmos: true` are the only real-browser guard for the editor gizmos.
  ...GIZMO_SCENES,
  ...PRIMITIVE_SCENES,
  ...CANVAS_2D_SCENES,
  ...MATERIAL_SCENES,
  ...TILE_AND_TARGET_SCENES,
];
