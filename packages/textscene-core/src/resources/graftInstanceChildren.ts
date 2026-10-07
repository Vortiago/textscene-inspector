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
      const deeper = graftAt(target.children, rest, child, targetScope);
      replacement = deeper ? { ...target, children: deeper } : null;
    }
  } else {
    replacement = { ...target, children: attach(target.children, child, targetScope) };
  }
  if (!replacement) return null;

  const copy = [...siblings];
  copy[index] = replacement;
  return copy;
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
 * or `null` when none has it. Each reference resolves in the scene that wrote it:
 * the override's in its own scope, the node's own and its children's in theirs.
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
  const { raw, scope } = override.rawProperties
    ? rehomeOverride(override.rawProperties, scopeOf(override, existingScope), existingScope)
    : { raw: undefined, scope: existingScope };
  const layered = layerRawOverride(existing, raw);
  const copy = [...siblings];
  copy[index] = scope === siblingScope ? layered : { ...layered, scope };
  return copy;
}
