/**
 * The words the gallery sorts and labels by: the status vocabulary, the
 * category order of the nav, and the two fixed destinations a panel links to.
 */

/**
 * Status vocabulary, worst-first — a node's nav badge rolls up to its worst
 * section. `done` (green) means genuinely faithful to Godot and is NEVER the
 * default: a sheet earns it only by an explicit `status=done`. Everything not
 * yet assessed against Godot reads `unreviewed` (grey), so the gallery never
 * over-claims parity. `unreviewed` outranks `done` in the rollup so a single
 * unchecked section keeps the whole node out of green.
 *
 * `linter-only` (blue) is the finished state for a node that draws nothing at
 * runtime — a Timer, a joint, an XR tracker. It is parsed and fully validated
 * and there is no render to assess, so it is not a gap the way `unimplemented`
 * is. It sits LAST because it is the weakest claim in a rollup: such a node has
 * a single sheet and no sections, so if it ever appears beside a real visual
 * assessment that assessment must win rather than be masked as "nothing to see".
 */
export const STATUS_ORDER = ['unimplemented', 'limitation', 'unreviewed', 'done', 'linter-only'];
export const DEFAULT_STATUS = 'unreviewed';
export const STATUS_LABEL = {
  done: 'Done',
  limitation: 'Limitation',
  unimplemented: 'Not implemented',
  unreviewed: 'Unreviewed',
  'linter-only': 'Linter only',
};
export const rollupStatus = (statuses) =>
  STATUS_ORDER.find((s) => statuses.includes(s)) ?? DEFAULT_STATUS;

export const CATEGORY_ORDER = ['3D', '2D', 'Resources', 'Complex Scenes', 'Other'];

/** The nav entry holding the causes shared across sheets. */
export const NOTES_TYPE = 'Reading these sheets';

// The public previewer, deployed from main. Its `?fixture=<file>` deep link
// (useFixtureSelection.ts) opens directly on a scene, so each sheet can link to
// the very fixture it documents. A fixture added in this PR only resolves once
// it reaches main and the site redeploys — the sheets ship in the same PR.
export const PREVIEW_URL = 'https://textscene-inspector.pages.dev/';
