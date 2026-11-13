/** Viewport size facts shared by the SubViewport slice's linter and its render passes. */

/**
 * The smallest axis a viewport holds. `Viewport::_set_size` stores `p_size.maxi(2)`
 * (`viewport.cpp:1120`), so `get_size()` never reports less.
 */
export const VIEWPORT_MIN_SIZE = 2;

/**
 * The canvas layer an embedder draws its windows on: `viewport_set_canvas_stacking(viewport,
 * subwindow_canvas, SUBWINDOW_CANVAS_LAYER, 0)` (`viewport.h:219`, `viewport.cpp:317`).
 */
export const SUBWINDOW_CANVAS_LAYER = 1024;
