/**
 * The `dependsOn` a viewport's offscreen pass registers with the ordered
 * pass driver (`../passOrder.ts`): every OTHER viewport boundary nested
 * inside this one's own subtree.
 *
 * Conservative rather than exact: a nested viewport MIGHT be sampled by
 * something in this subtree (a `ViewportTexture` on a `Sprite2D`/`TextureRect`/
 * material anywhere below), and rendering it first is harmless even when it
 * is not — so this walks every descendant looking for one, rather than
 * tracing which resource actually references which target.
 *
 * Stops descending the moment it finds one: a viewport nested inside THAT
 * one is its own pass's concern to declare when IT registers, and the
 * ordered driver already resolves transitive chains (a 3-deep nesting orders
 * innermost first without any pass needing to know about its grandchild).
 *
 * Walks the RAW parsed tree, not the live/instance-resolved one: a nested
 * viewport that only exists inside an as-yet-unloaded instanced sub-scene is
 * missed until that scene resolves and this pass's own re-render picks the
 * dependency up — a brief extra frame of latency at load time, not a
 * persistent one.
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
        continue;
      }
      walk(child.children, childPath);
    }
  };

  walk(node.children, path);
  return found;
}
