import { GEOMETRY_SCENES } from './scenes/geometry.mjs';
import { LIGHTING_SCENES } from './scenes/lighting.mjs';
import { SCENE_COMPOSITION_SCENES } from './scenes/composition.mjs';
import { GIZMO_SCENES } from './scenes/gizmos.mjs';
import { PRIMITIVE_SCENES } from './scenes/primitives.mjs';
import { CANVAS_2D_SCENES } from './scenes/canvas2d.mjs';
import { CONTROL_TEXT_SCENES } from './scenes/controlText.mjs';
import { CONTROL_WIDGET_SCENES } from './scenes/controlWidgets.mjs';
import { LIGHTING_2D_SCENES } from './scenes/lighting2d.mjs';
import { PARTICLES_2D_SCENES } from './scenes/particles2d.mjs';
import { MATERIAL_SCENES } from './scenes/materials.mjs';
import { TILE_AND_TARGET_SCENES } from './scenes/targets.mjs';
import { IN_GAME_SCENES } from './scenes/inGame.mjs';

/** The 2D chapters list scenes that all capture in 2D mode, so a chapter entry leaves `mode` out. */
const in2dMode = (scenes) => scenes.map((scene) => ({ mode: '2d', ...scene }));

/**
 * A golden: a WebGL-canvas scene with no 2D DOM overlay, whose loads resolve from local fixtures.
 * @typedef {object} GoldenScene
 * @property {string} name the baseline's name
 * @property {string} file the fixture filename exactly as in apps/textscene-web/src/fixtures.ts
 * @property {'2d' | 'in-game'} [mode] the workspace the capture opens, 3D when absent
 * @property {boolean} [collisions] turn the collision shapes on
 * @property {boolean} [navigation] turn the navigation meshes on
 * @property {boolean} [gizmos] turn the Gizmos toggle on, off in every other capture
 * @property {string} [select] the node path to select
 * @property {string} [camera] the Camera3D node path the previewer looks through, as `?camera=` opens it
 * @property {{ width: number, height: number }} [canvas] the 3D canvas size a small frame renders at,
 *   or the In-game window
 * @property {number} [settleTimeout] each screenshot's limit in ms where one frame outlasts
 *   Playwright's default, which `pnpm recapture` takes for the sheet image too
 * @property {number} [animationTime] the seconds to seek the AnimationPlayer `select` names to
 * @property {'nodes'} [litSurface] capture a branch only the node lit surface draws, with the switch on
 * @property {({ path: string, property: string, text: string } | { path: string, method: string, args: string[] })[]} [hostCalls]
 *   host writes and calls through the open scene, each value a Variant text or `Resource("res://…")`,
 *   applied in order before the settle
 */

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
  'animationTime',
  'litSurface',
  'hostCalls',
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
  ...in2dMode(CANVAS_2D_SCENES),
  ...in2dMode(CONTROL_TEXT_SCENES),
  ...in2dMode(CONTROL_WIDGET_SCENES),
  ...in2dMode(LIGHTING_2D_SCENES),
  ...in2dMode(PARTICLES_2D_SCENES),
  ...MATERIAL_SCENES,
  ...TILE_AND_TARGET_SCENES,
  ...IN_GAME_SCENES,
];
