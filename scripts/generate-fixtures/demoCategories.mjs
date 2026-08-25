/**
 * The `scenes/demos/` top-level directories the fixture manifest covers, and
 * the label each carries in the scene selector.
 *
 * Its own module because two sides read it: the generator, which skips a
 * top-level directory outside this set, and the manifest guard, which walks the
 * same set to ask what is on disk but unlisted. Written out twice, the guard
 * would report clean over a category the generator had started emitting —
 * upstream godot-demo-projects ships mono, audio and navigation too.
 */
export const DEMO_CATEGORY_LABELS = { '2d': '2D', '3d': '3D', gui: 'GUI', viewport: 'Viewport' };
