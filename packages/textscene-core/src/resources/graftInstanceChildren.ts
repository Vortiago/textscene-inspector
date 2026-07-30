/**
 * Graft a host scene's deep children into the sub-scene it instanced.
 *
 * `sceneTreeBuilder` can get a node whose parent path descends into an instance
 * as far as the INSTANCE node, recording the remainder as `instanceSubPath`; it
 * cannot go further, because only the loaded sub-scene knows what
 * `Sprite2D/Pivot` names. This closes that gap for the `.tscn` flavour, where
 * the target is an ordinary `TscnNode` tree and matching is exact.
 *
 * The GLB flavour cannot share this: its target is a `THREE.Object3D` graph
 * produced by a different importer, which needs its own tolerant matcher.
 *
 * PURITY IS LOAD-BEARING. The loaded sub-scene is a shared cache entry — the
 * two pause menus instance the same file — so this copies along the mutated
 * spine and structurally shares everything else. Writing into the cached tree
 * would corrupt every other instance of it, and only when a second consumer
 * happened to render.
 */

import type { TscnExternalResource, TscnNode } from '../parser/types';
import { warn } from '../logger';

/**
 * The sub-scene root's children with the host's overrides folded in.
 *
 * @param rootChildren the loaded sub-scene root's children (never mutated)
 * @param hostChildren the instancing node's children, deep and direct alike
 * @param outerResources the HOST scene's ExtResource table, stamped onto each
 *   grafted node so its resource references keep resolving against the table
 *   they were authored against rather than the sub-scene's
 */
export function graftInstanceChildren(
  rootChildren: readonly TscnNode[],
  hostChildren: readonly TscnNode[],
  outerResources?: readonly TscnExternalResource[]
): TscnNode[] {
  if (hostChildren.length === 0) return [...rootChildren];

  let grafted = [...rootChildren];
  const appendedAtRoot: TscnNode[] = [];

  for (const child of hostChildren) {
    const stamped = stamp(child, outerResources);
    if (!child.instanceSubPath) {
      appendedAtRoot.push(stamped);
      continue;
    }

    const next = graftAt(grafted, child.instanceSubPath.split('/'), stamped);
    if (next) {
      grafted = next;
    } else {
      // Visible-but-misplaced beats invisible: a sub-path we cannot resolve is
      // a matching failure worth seeing, not a reason to drop the node.
      warn(
        `[graftInstanceChildren] "${child.name}" targets "${child.instanceSubPath}", which the instanced scene does not contain — appending at its root`
      );
      appendedAtRoot.push(stamped);
    }
  }

  return [...grafted, ...appendedAtRoot];
}

/**
 * Copy `siblings` with `child` grafted at `segments`, or `null` when the path
 * names nothing. Only the nodes along the path are new objects.
 */
function graftAt(
  siblings: readonly TscnNode[],
  segments: readonly string[],
  child: TscnNode
): TscnNode[] | null {
  const [head, ...rest] = segments;
  const index = siblings.findIndex((n) => n.name === head);
  if (index === -1) return null;

  const target = siblings[index]!;
  let replacement: TscnNode | null;

  if (rest.length > 0) {
    if (target.instance) {
      // The path continues INTO another instance, whose own sub-scene has not
      // been merged yet — `Pivot` lives inside whatever `Sprite2D` instances.
      // Re-anchor here with the remaining path: when that node collapses in
      // turn it runs this same graft and resolves the rest. Recursion through
      // the existing mechanism rather than a second one.
      replacement = {
        ...target,
        children: [...target.children, { ...child, instanceSubPath: rest.join('/') }],
      };
    } else {
      const deeper = graftAt(target.children, rest, child);
      replacement = deeper ? { ...target, children: deeper } : null;
    }
  } else {
    replacement = attach(target, child);
  }
  if (!replacement) return null;

  const copy = [...siblings];
  copy[index] = replacement;
  return copy;
}

/**
 * Attach `child` under `parent` — as a new node, or, when it only overrides
 * properties, by folding its raw properties onto the node already there.
 *
 * The override case is why `overridesExistingNode` exists: appending would
 * leave two nodes of the same name where Godot has one, and the authored
 * properties would land on a duplicate nothing else references.
 */
function attach(parent: TscnNode, child: TscnNode): TscnNode {
  if (!child.overridesExistingNode) {
    return { ...parent, children: [...parent.children, child] };
  }

  const index = parent.children.findIndex((n) => n.name === child.name);
  if (index === -1) {
    // An override naming a node the sub-scene does not have. Keep it visible
    // rather than dropping it silently.
    warn(
      `[graftInstanceChildren] override "${child.name}" matches no node inside the instanced scene — adding it instead`
    );
    return { ...parent, children: [...parent.children, child] };
  }

  const existing = parent.children[index]!;
  const merged: TscnNode = {
    ...existing,
    rawProperties: { ...existing.rawProperties, ...child.rawProperties },
    ...(child.authoredResources ? { authoredResources: child.authoredResources } : {}),
  };
  const children = [...parent.children];
  children[index] = merged;
  return { ...parent, children };
}

function stamp(node: TscnNode, outerResources?: readonly TscnExternalResource[]): TscnNode {
  return outerResources ? { ...node, authoredResources: outerResources } : node;
}
