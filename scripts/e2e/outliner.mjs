/**
 * Outliner interaction for the web-app E2E gate. A row's node path ends in its
 * name (`joinPath(parentPath, node.name)` in `TreeNode.tsx`), so
 * `data-node-path` alone proves the tree's shape and every row's name.
 */

/** Expands every collapsed row so nested rows are reachable. */
export async function expandAllTreeRows(page, { maxRounds = 60 } = {}) {
  for (let round = 0; round < maxRounds; round++) {
    const collapsed = page.locator('[aria-label="Expand"]');
    if ((await collapsed.count()) === 0) return round;
    await collapsed.first().click({ timeout: 5000 });
    await page.waitForTimeout(80);
  }
  throw new Error(`outliner still has collapsed rows after ${maxRounds} expand rounds`);
}

/** Every row in the DOM, in document order, without collapsed rows' children. */
export async function readOutlinerPaths(page) {
  return page.$$eval('[data-node-path]', (nodes) =>
    nodes.map((node) => node.getAttribute('data-node-path'))
  );
}

/** Clicks a row by its exact node path, as a user selects in the tree. */
export async function selectOutlinerNode(page, nodePath) {
  const row = page.locator(`[data-node-path="${nodePath}"] > [role="treeitem"]`).first();
  await row.waitFor({ state: 'visible', timeout: 10000 });
  await row.click();
}

/**
 * Exact-order equality of two node-path lists: the order is the tree's authored
 * child order, so a swap is a regression.
 */
export function arraysEqual(a, b) {
  return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i]);
}

/** Missing and extra node paths for a failure message, ignoring order. */
export function describeNodePathMismatch(expected, actual) {
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  return {
    missing: expected.filter((path) => !actualSet.has(path)),
    extra: actual.filter((path) => !expectedSet.has(path)),
  };
}
