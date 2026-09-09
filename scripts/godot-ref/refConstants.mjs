/**
 * The engine-side constants the reference harness renders at. They are here
 * rather than beside their use because BOTH sides of a parity comparison read
 * them: a one-sided edit leaves `ref:godot` and `ref:ours` framing different
 * pictures while both appear to work.
 */

import { CANVAS_CAPTURE } from '../visual/previewServer.mjs';

/**
 * The frame `capture-ours.mjs` produces, taken from the one definition of it.
 * Matching it is what makes the two harnesses' probe coordinates address the
 * same surface point with no arguments — differing aspect ratios alone would
 * break that, since at a shared vertical fov the wider frame covers a wider
 * horizontal frustum and no rescaling maps probes 1:1.
 */
export const DEFAULT_WIDTH = CANVAS_CAPTURE.width;
export const DEFAULT_HEIGHT = CANVAS_CAPTURE.height;

/** `editors/3d/default_fov`. A `Camera3D` node's own default is 75. */
export const EDITOR_FOV = 70;

/**
 * `Node3DEditorViewport::Cursor()` — where the editor opens EVERY scene,
 * whatever is in it. Mirrors `godotEditorCamera.ts`, which is what the
 * previewer opens at, so a bare `ref:godot` and a bare `ref:ours` frame the
 * same picture with no arguments. This file generates GDScript and runs under
 * plain node, so it cannot import the TypeScript — `run.test.mjs` asserts these
 * against `godotEditorCamera.ts` instead, because a one-sided edit here would
 * leave both harnesses "working" while framing different pictures, and every
 * probe measured after that would be quietly wrong.
 */
export const EDITOR_CAMERA_DIRECTION = [0.4207355, 0.4794255, 0.7701512];
export const EDITOR_CAMERA_DISTANCE = 4;

/** `frameSceneBounds.ts`'s margin, for the opt-in framed mode. */
export const FRAME_MARGIN = 1.6;

/** The render modes, and what `--mode` accepts. */
export const RENDER_MODES = ['auto', '2d', '3d'];
