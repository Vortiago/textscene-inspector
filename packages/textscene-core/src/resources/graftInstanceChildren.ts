/**
 * Graft a host scene's deep children into the `.tscn` sub-scene it instanced, where
 * `sceneTreeBuilder` stopped at the instance node with an `instanceSubPath`. The GLB
 * flavour needs its own tolerant matcher. It must stay pure: the sub-scene is a shared
 * cache entry, so this copies along the changed spine and shares everything else.
 */

import type { SceneScope } from '../parser/types';
import { scopeOf, type LiveNode } from './liveNode';
import { layerRawOverride } from './layerRawOverride';
import { rehomeOverride } from './rehomeOverride';
import { composeAuthoredIds, unionAuthoredIds } from './authoredIds';
import { warn } from '../logger';

/** The two scopes a graft joins. */
export interface InstanceScopes {
  /** The host scene's, which the host children were authored against. */
  outer: SceneScope;
  /** The sub-scene's, which its own nodes resolve against. */
  content: SceneScope;
}

/**
 * The sub-scene root's children with the host's overrides folded in. A grafted node
 * carries the outer scope, and a node an override reached carries its own scope plus
 * the resources the override names (`rehomeOverride`).
 *
 * @param rootChildren the loaded sub-scene root's children (never mutated)
 * @param hostChildren the instancing node's children, deep and direct alike
 */
export function graftInstanceChildren(
  rootChildren: readonly LiveNode[],
  hostChildren: readonly LiveNode[],
  scopes: InstanceScopes
): LiveNode[] {
  if (hostChildren.length === 0) return [...rootChildren];

  let grafted = [...rootChildren];
  const appendedAtRoot: LiveNode[] = [];

  for (const child of hostChildren) {
    // A child re-anchored at a nested instance keeps the scene it was authored in.
    const stamped = child.scope ? child : { ...child, scope: scopes.outer };
    if (!child.instanceSubPath) {
      const folded = child.overridesExistingNode ? foldOrWarn(grafted, stamped, scopes.content) : null;
      if (folded) grafted = folded;
      else appendedAtRoot.push(stamped);
      continue;
    }

    const next = graftAt(grafted, child.instanceSubPath.split('/'), stamped, scopes.content);
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
 * names nothing. Only the nodes along the path are new objects. `siblingScope` is
 * the scope `siblings` resolve against unless a node carries its own.
 */
function graftAt(
  siblings: readonly LiveNode[],
  segments: readonly string[],
  child: LiveNode,
  siblingScope: SceneScope
): LiveNode[] | null {
  const [head, ...rest] = segments;
  const index = siblings.findIndex((n) => n.name === head);
  if (index === -1) return null;

  const target = siblings[index]!;
  const targetScope = scopeOf(target, siblingScope);
  let replacement: LiveNode | null;

  if (target.instance) {
    // The path reaches another instance, whose sub-scene is not merged yet. Re-anchor
    // here with the remaining path, or as a direct child where none remains: when that
    // node collapses, it runs this same graft and resolves the rest.
    replacement = { ...target, children: [...target.children, reanchored(child, rest)] };
  } else if (rest.length > 0) {
    const deeper = graftAt(target.children, rest, child, targetScope);
    replacement = deeper ? { ...target, children: deeper } : null;
  } else {
    replacement = { ...target, children: attach(target.children, child, targetScope) };
  }
  if (!replacement) return null;

  const copy = [...siblings];
  copy[index] = replacement;
  return copy;
}

/** `child` with `rest` as its sub-path below the instance it re-anchors at, or none when `rest` is empty. */
function reanchored(child: LiveNode, rest: readonly string[]): LiveNode {
  const { instanceSubPath: _authored, ...direct } = child;
  return rest.length > 0 ? { ...direct, instanceSubPath: rest.join('/') } : direct;
}

/**
 * `siblings` with `child` attached as a new node, or with an override folded onto
 * the node already there. Appending an override would leave two nodes of one name
 * where Godot has one, with the properties on a duplicate nothing references.
 */
function attach(siblings: readonly LiveNode[], child: LiveNode, siblingScope: SceneScope): LiveNode[] {
  const folded = child.overridesExistingNode ? foldOrWarn(siblings, child, siblingScope) : null;
  return folded ?? [...siblings, child];
}

/**
 * {@link foldOverride}, warning when no sibling has the override's name. The caller
 * then adds the override as a node: visible beats silently dropped.
 */
function foldOrWarn(
  siblings: readonly LiveNode[],
  override: LiveNode,
  siblingScope: SceneScope
): LiveNode[] | null {
  const folded = foldOverride(siblings, override, siblingScope);
  if (!folded) {
    warn(
      `[graftInstanceChildren] override "${override.name}" matches no node inside the instanced scene — adding it instead`
    );
  }
  return folded;
}

/**
 * `siblings` with the override's raw properties layered onto the node of its name,
 * and the override's children attached under it, or `null` when none has the name.
 * Each reference resolves in the scene that wrote it: the override's and its
 * children's in the override's scope, the node's own and its children's in theirs.
 */
function foldOverride(
  siblings: readonly LiveNode[],
  override: LiveNode,
  siblingScope: SceneScope
): LiveNode[] | null {
  const index = siblings.findIndex((n) => n.name === override.name);
  if (index === -1) return null;

  const existing = siblings[index]!;
  const existingScope = scopeOf(existing, siblingScope);
  const overrideScope = scopeOf(override, existingScope);
  const { raw, scope, authoredIds } = override.rawProperties
    ? rehomeOverride(override.rawProperties, overrideScope, existingScope)
    : { raw: undefined, scope: existingScope, authoredIds: undefined };
  const layered = layerRawOverride(existing, raw);
  const children = attachAll(layered.children, override.children, overrideScope, scope);
  // The node's own renames and the override's share one scope but trace to different files.
  const ids = unionAuthoredIds(existing.authoredIds, composeAuthoredIds(override.authoredIds, authoredIds));
  const folded: LiveNode = { ...layered, children, ...(ids ? { authoredIds: ids } : {}) };
  const copy = [...siblings];
  copy[index] = scope === siblingScope ? folded : { ...folded, scope };
  return copy;
}

/**
 * `siblings` with each of `children` attached. The host's parser seats a node whose
 * `parent=` names an override under that override, so it arrives as the override's child,
 * written in `childScope`.
 */
function attachAll(
  siblings: readonly LiveNode[],
  children: readonly LiveNode[],
  childScope: SceneScope,
  siblingScope: SceneScope
): LiveNode[] {
  let attached = [...siblings];
  for (const child of children) {
    attached = attach(attached, child.scope ? child : { ...child, scope: childScope }, siblingScope);
  }
  return attached;
}
