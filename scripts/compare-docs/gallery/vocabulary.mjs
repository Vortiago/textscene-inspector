/**
 * The words the gallery sorts and labels by: the status vocabulary, the
 * category order of the nav, and the two fixed destinations a panel links to.
 */

/**
 * Status vocabulary, worst first: a node's badge rolls up to its worst section.
 * `done` needs an explicit `status=done`, and one `unreviewed` section keeps a
 * node out of green. `linter-only` is the finished state of a node that draws
 * nothing. It is last, so a real visual assessment beside it wins the rollup.
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
// (useFixtureSelection.ts) opens on a scene. A new fixture resolves only once it
// reaches main and the site redeploys.
export const PREVIEW_URL = 'https://textscene-inspector.pages.dev/';
