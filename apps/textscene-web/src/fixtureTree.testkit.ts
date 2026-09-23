/**
 * Test-only helpers over the fixture tree for the r3f-main.*.test.tsx suites.
 * Only test files import it, so it stays out of the app bundle.
 */
import type { SceneLeaf, TreeBranch } from './fixtureTree';

/** The tree's own leaf shape, aliased rather than re-declared. */
export type Leaf = SceneLeaf;

/** Depth-first leaf collection: "any switchable scene" for palette-driving tests. */
export function flattenLeaves(branches: readonly TreeBranch[]): Leaf[] {
  const out: Leaf[] = [];
  const walk = (b: TreeBranch) => {
    for (const child of b.children) {
      if (child.kind === 'branch') walk(child);
      else out.push(child);
    }
  };
  branches.forEach(walk);
  return out;
}
