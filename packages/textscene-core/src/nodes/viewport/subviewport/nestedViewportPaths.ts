/**
 * The `dependsOn` a viewport's offscreen pass registers with the ordered driver
 * (`../passOrder.ts`): every viewport nested in its subtree, whether or not a
 * `ViewportTexture` samples it, since rendering one first is harmless. It walks
 * the raw parsed tree, so an unloaded sub-scene's viewport joins on re-render.
 */
import type { TscnNode } from '../../../parser/types.js';
import { joinPath } from '../../../utils/nodePath.js';
import { isViewportBoundary } from './viewportBoundary.js';

export function collectNestedViewportPaths(node: TscnNode, path: string): string[] {
  const found: string[] = [];

  const walk = (children: readonly TscnNode[], parentPath: string): void => {
    for (const child of children) {
      const childPath = joinPath(parentPath, child.name);
      if (isViewportBoundary(child.type)) {
        found.push(childPath);
        // A viewport nested in that one is its own pass's dependency, and the
        // driver resolves transitive chains.
        continue;
      }
      walk(child.children, childPath);
    }
  };

  walk(node.children, path);
  return found;
}
