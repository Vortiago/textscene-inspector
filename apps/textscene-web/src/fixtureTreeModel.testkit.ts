/**
 * Test-only helpers over the fixture tree for the r3f-main.*.test.tsx suites.
 * Only test files import it, so it stays out of the app bundle.
 */
import type { SceneLeaf, TreeBranch } from './fixtureTreeModel';

/** Every scene leaf under `branches`, depth first: the scenes a test can switch to. */
export function flattenLeaves(branches: readonly TreeBranch[]): SceneLeaf[] {
  const leaves: SceneLeaf[] = [];
  const walk = (branch: TreeBranch) => {
    for (const child of branch.children) {
      if (child.kind === 'branch') walk(child);
      else leaves.push(child);
    }
  };
  branches.forEach(walk);
  return leaves;
}
