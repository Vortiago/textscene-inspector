/**
 * Whether the 2D stage fits the viewport rectangle when a scene opens, on by
 * default. Off opens at zoom 1 with the rectangle at the stage's top-left, one
 * canvas pixel per screen pixel, comparable to a Godot render: that is how
 * `scripts/compare-docs/capture.mjs` seeds it.
 */
export const FIT_ON_OPEN_2D_STORAGE_KEY = 'tsi.fitOnOpen2D';
