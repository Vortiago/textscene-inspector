/** The order of the categories in the comparison index. */

/** `3D` before `2D` before the rest. */
const CATEGORY_ORDER = ['3D', '2D', 'Resources', 'Other'];

/** A category's place in `CATEGORY_ORDER`, and an unlisted one after them all. */
function categoryRank(category) {
  const rank = CATEGORY_ORDER.indexOf(category);
  return rank === -1 ? CATEGORY_ORDER.length : rank;
}

/**
 * `categories` in index order, an unlisted one after the listed ones and A-Z among them. Sorted
 * first, an unlisted category would land above the index's first heading, so the next run would
 * keep it and append it again.
 */
export function orderedCategories(categories) {
  return [...categories].sort((a, b) => categoryRank(a) - categoryRank(b) || a.localeCompare(b));
}
