/**
 * The engine-side constants the reference harness renders at, read by both
 * sides of a parity comparison: a one-sided edit frames two different pictures.
 */

import { CANVAS_CAPTURE } from '../visual/previewServer.mjs';

/**
 * The frame `capture-ours.mjs` produces, from its one definition, so probe
 * coordinates address one surface point: at a shared vertical fov, a wider
 * frame covers a wider frustum and no rescaling maps probes 1:1.
 */
export const DEFAULT_WIDTH = CANVAS_CAPTURE.width;
export const DEFAULT_HEIGHT = CANVAS_CAPTURE.height;

/** `editors/3d/default_fov`. A `Camera3D` node's own default is 75. */
export const EDITOR_FOV = 70;

/**
 * `Node3DEditorViewport::Cursor()`, where the editor opens every scene. Mirrors
 * the previewer's `godotEditorCamera.ts`, which plain node cannot import, so
 * `run.test.mjs` asserts the two agree.
 */
export const EDITOR_CAMERA_DIRECTION = [0.4207355, 0.4794255, 0.7701512];
export const EDITOR_CAMERA_DISTANCE = 4;

/** `frameSceneBounds.ts`'s margin, for the opt-in framed mode. */
export const FRAME_MARGIN = 1.6;

/** The render modes, and what `--mode` accepts. */
export const RENDER_MODES = ['auto', '2d', '3d'];
