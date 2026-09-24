/**
 * Graft a host scene's deep children into the `.tscn` sub-scene it instanced, where
 * `sceneTreeBuilder` stopped at the instance node with an `instanceSubPath`. The GLB
 * flavour needs its own tolerant matcher. It must stay pure: the sub-scene is a shared
 * cache entry, so this copies along the changed spine and shares everything else.
 */

import type { SceneScope, TscnNode } from '../parser/types';
import { layerRawOverride } from './layerRawOverride';
import { warn } from '../logger';

/**
 * The sub-scene root's children with the host's overrides folded in.
 *
 * @param rootChildren the loaded sub-scene root's children (never mutated)
 * @param hostChildren the instancing node's children, deep and direct alike
 * @param outerScope the host scene's resource tables, both pools (see `SceneScope`),
 *   stamped onto each grafted node so its references resolve against the scene
 *   they were authored in
 */
export function graftInstanceChildren(
  rootChildren: readonly TscnNode[],
  hostChildren: readonly TscnNode[],
  outerScope?: SceneScope
): TscnNode[] {
  if (hostChildren.length === 0) return [...rootChildren];

  let grafted = [...rootChildren];
  const appendedAtRoot: TscnNode[] = [];

  for (const child of hostChildren) {
    const stamped = outerScope ? { ...child, authoredScope: outerScope } : child;
    if (!child.instanceSubPath) {
      appendedAtRoot.push(stamped);
      continue;
    }

    const next = graftAt(grafted, child.instanceSubPath.split('/'), stamped);
    if (next) {
      grafted = next;
    } else {
      // Visible-but-misplaced beats invisible: a sub-path that does not resolve is
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
      // The path continues into another instance, whose sub-scene is not merged
      // yet. Re-anchor here with the remaining path: when that node collapses, it
      // runs this same graft and resolves the rest.
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
 * Attach `child` under `parent` as a new node, or fold an override's raw properties
 * onto the node already there. Appending an override would leave two nodes of one
 * name where Godot has one, with the properties on a duplicate nothing references.
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
  const children = [...parent.children];
  children[index] = {
    ...layerRawOverride(existing, child.rawProperties),
    ...(child.authoredScope ? { authoredScope: child.authoredScope } : {}),
  };
  return { ...parent, children };
}

