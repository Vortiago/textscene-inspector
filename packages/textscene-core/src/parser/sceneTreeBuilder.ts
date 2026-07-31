/**
 * Builds hierarchical scene tree from flat TSCN node list.
 */

import type { TscnNode } from './types';
import { warn } from '../logger';

/**
 * Build scene tree from flat node list using parent path references.
 * Parent paths in TSCN are relative to root: "." = root, "Foo/Bar" = root/Foo/Bar
 */
export function buildSceneTree(nodes: TscnNode[]): TscnNode[] {
  if (nodes.length === 0) return [];

  // Find root node (has no parent)
  const rootNode = nodes.find(n => !n.parent);
  if (!rootNode) {
    return nodes;
  }

  // Map from relative path to node (paths don't include root name)
  const pathMap = new Map<string, TscnNode>();
  pathMap.set('', rootNode); // Root is at empty path

  // Track remaining nodes to place
  let remaining = placeResolvable(nodes.filter((n) => n !== rootNode), rootNode, pathMap);

  // A node whose parent path descends INTO instanced content can never resolve
  // here: the intermediate names live in the instanced scene or GLB, not in
  // this file. Godot only lets you address into a sub-scene you INSTANCED, so
  // the nearest enclosing instance node is the anchor, and the rest of the path
  // is that content's business to match.
  //
  // Requiring the anchor to be instance-bearing is what separates these from
  // genuinely malformed paths: a scene that says `parent="Level2"` when the
  // root has no such child is a mistake Godot also drops, and re-rooting it
  // under the nearest resolvable ancestor would hide that.
  //
  // One node is deferred per pass, then the ordinary resolution above is
  // re-run, so a deferred node's own descendants resolve through their declared
  // paths and never pick up a marker of their own.
  while (remaining.length > 0) {
    const deferred = firstAnchorable(remaining, pathMap);
    if (!deferred) break;

    const { node, anchor } = deferred;
    anchor.node.children.push(node);
    node.instanceSubPath = anchor.subPath;
    pathMap.set(`${node.parent}/${node.name}`, node);

    remaining = placeResolvable(
      remaining.filter((n) => n !== node),
      rootNode,
      pathMap
    );
  }

  // Warn about any orphaned nodes
  if (remaining.length > 0) {
    warn(`WARNING: ${remaining.length} orphaned nodes will be dropped from scene tree!`);
    for (const node of remaining) {
      warn(`  Orphaned: "${node.name}" (type: ${node.type}, parent: "${node.parent}", instance: ${node.instance || 'none'})`);
    }
  }

  return [rootNode];
}

/**
 * Attach every node whose parent path resolves against `pathMap`, repeating
 * until a pass places nothing.
 *
 * Iterates FORWARD (declaration order) and rebuilds the unplaced list each pass
 * — this preserves sibling order, so `children` matches the `.tscn` declaration
 * order, which is the 2D paint order (earlier siblings draw behind), and it
 * avoids the index-shifting hazards of splicing mid-iteration. Repeating places
 * children whose parent appears later in the file.
 *
 * Returns the nodes that still did not resolve.
 */
function placeResolvable(
  nodes: TscnNode[],
  rootNode: TscnNode,
  pathMap: Map<string, TscnNode>
): TscnNode[] {
  let remaining = nodes;
  let lastRemainingCount = remaining.length + 1;

  while (remaining.length > 0 && remaining.length < lastRemainingCount) {
    lastRemainingCount = remaining.length;
    const stillRemaining: TscnNode[] = [];

    for (const node of remaining) {
      if (!node.parent) {
        // No parent and not the root → drop it (handled by the orphan warning
        // only if it never resolves; a parentless non-root is simply skipped).
        continue;
      }

      // "." means a direct child of root; otherwise resolve by parent path.
      const parentNode = node.parent === '.' ? rootNode : pathMap.get(node.parent);
      if (parentNode) {
        parentNode.children.push(node);
        const nodePath = node.parent === '.' ? node.name : `${node.parent}/${node.name}`;
        pathMap.set(nodePath, node);
      } else {
        stillRemaining.push(node);
      }
    }

    remaining = stillRemaining;
  }

  return remaining;
}

/** The first node that has an instance anchor, paired with that anchor. */
function firstAnchorable(
  remaining: readonly TscnNode[],
  pathMap: Map<string, TscnNode>
): { node: TscnNode; anchor: { node: TscnNode; subPath: string } } | null {
  for (const node of remaining) {
    const anchor = findInstanceAnchor(node, pathMap);
    if (anchor) return { node, anchor };
  }
  return null;
}

/**
 * The nearest INSTANCE node enclosing this node's parent path, and the
 * remainder of that path below it — or `null` when the path names no instanced
 * content, which makes it a malformed path rather than an override.
 *
 * Prefixes are walked longest-first so nested instances anchor at the innermost
 * one: the sub-path has to be measured from the scene that will actually
 * resolve it.
 */
function findInstanceAnchor(
  node: TscnNode,
  pathMap: Map<string, TscnNode>
): { node: TscnNode; subPath: string } | null {
  if (!node.parent || node.parent === '.') return null;

  const segments = node.parent.split('/');
  // Start one short of the full path: had the whole thing resolved, ordinary
  // placement would already have used it.
  for (let depth = segments.length - 1; depth >= 0; depth--) {
    const candidate = pathMap.get(segments.slice(0, depth).join('/'));
    if (candidate?.instance) {
      return { node: candidate, subPath: segments.slice(depth).join('/') };
    }
  }
  return null;
}
