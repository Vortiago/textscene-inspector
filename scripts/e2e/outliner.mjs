/**
 * Outliner (scene-tree) interaction for the web-app E2E gate.
 *
 * A row's full node path IS its name for the last path segment
 * (`joinPath(parentPath, node.name)` in `TreeNode.tsx`), so reading names
 * needs no CSS-module-fragile text scraping — `data-node-path` alone proves
 * both the tree's shape and every row's name.
 */

/** Expand every collapsed row so nested rows (e.g. children of the root) are reachable. */
export async function expandAllTreeRows(page, { maxRounds = 60 } = {}) {
  for (let round = 0; round < maxRounds; round++) {
    const collapsed = page.locator('[aria-label="Expand"]');
    if ((await collapsed.count()) === 0) return round;
    await collapsed.first().click({ timeout: 5000 });
    await page.waitForTimeout(80);
  }
  throw new Error(`outliner still has collapsed rows after ${maxRounds} expand rounds`);
}

/** Every row currently in the DOM, in document order — collapsed rows' children excluded. */
export async function readOutlinerPaths(page) {
  return page.$$eval('[data-node-path]', (nodes) =>
    nodes.map((node) => node.getAttribute('data-node-path'))
  );
}

/** Click a row by its exact node path (selects it — mirrors a user's tree click). */
export async function selectOutlinerNode(page, nodePath) {
  const row = page.locator(`[data-node-path="${nodePath}"] > [role="treeitem"]`).first();
  await row.waitFor({ state: 'visible', timeout: 10000 });
  await row.click();
}

/**
 * Exact-order equality of two node-path lists. Order matters here on
 * purpose: it is the tree's authored child order, so a swap is as much a
 * regression as a missing or extra row.
 */
export function arraysEqual(a, b) {
  return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i]);
}

/** Missing/extra node paths for a failure message — set-based, order-agnostic. */
export function describeNodePathMismatch(expected, actual) {
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  return {
    missing: expected.filter((path) => !actualSet.has(path)),
    extra: actual.filter((path) => !expectedSet.has(path)),
  };
}
