/**
 * Godot's default 2D project viewport size (`display/window/size/viewport_*`).
 * The single source of truth for the 2D stage frame and Camera2D framing — the
 * one seam to feed from a scene's project.godot once that is threaded through.
 */
export const CANVAS_2D_WIDTH = 1152;
export const CANVAS_2D_HEIGHT = 648;

/**
 * Whether the 2D stage fits the viewport rectangle to the stage when a scene
 * opens. ON by default (the whole frame is visible however small the panel is);
 * off opens at zoom 1 with the rectangle's top-left at the stage's top-left,
 * i.e. Godot's canvas transform untouched — one canvas pixel per screen pixel,
 * at the same place every time. The 2D counterpart of `FRAME_ON_OPEN_STORAGE_KEY`,
 * and what makes the previewer's frame comparable to a Godot render of the same
 * scene (`scripts/compare-docs/capture.mjs` seeds it off).
 */
export const FIT_ON_OPEN_2D_STORAGE_KEY = 'tsi.fitOnOpen2D';

/**
 * Whether the 2D stage draws Control nodes natively in the WebGL canvas
 * instead of as the DOM overlay. ON by default — the native canvas is the 2D
 * Control renderer now, and setting this key to `false` opts back into the
 * DOM overlay for as long as that still exists. Deliberately not on the
 * viewport-mode seam: everything there is a display
 * preference with a toolbar affordance, whereas this selects a rendering path
 * and has no UI at all — Godot has no such concept, so exposing one would
 * misrepresent the preview as offering a choice a real scene never makes.
 * Read once at mount like `FIT_ON_OPEN_2D_STORAGE_KEY`; flipped from devtools,
 * or seeded by a harness before load.
 */
export const NATIVE_CONTROLS_STORAGE_KEY = 'tsi.native2dUi';
