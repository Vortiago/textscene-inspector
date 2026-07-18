/**
 * Test-only helpers over the fixture tree, shared by the r3f-main.*.test.tsx
 * suites (each previously carried its own copy). Not part of the app bundle —
 * only test files import it.
 */
import type { SceneLeaf, TreeBranch } from './fixtureTree';

/** The tree's own leaf shape — aliased, not re-declared, so it can't drift. */
export type Leaf = SceneLeaf;

/** Depth-first leaf collection — "any switchable scene" for palette-driving tests. */
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
