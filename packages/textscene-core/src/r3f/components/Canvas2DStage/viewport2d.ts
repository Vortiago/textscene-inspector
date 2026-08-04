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
