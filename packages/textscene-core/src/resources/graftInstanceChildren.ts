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
import { UNIQUE_NODE_PREFIX } from '../godot/string/nodePath';
import { holderAfterSetting, type InstanceNameSetting } from '../parser/nodeOwner';

/** The two scopes a graft joins. */
export interface InstanceScopes {
  /** The host scene's, which the host children were authored against. */
  outer: SceneScope;
  /** The sub-scene's, which its own nodes resolve against. */
  content: SceneScope;
}

/**
 * The path below the instanced scene's root that its own table gives a `%Name` key, or undefined
 * where nothing there claims it.
 */
export type ClaimedPath = (key: string) => string | undefined;

/** The `%Name` facts a graft reads for one instance. */
export interface InstanceNames {
  /** The sub-scene's own table. */
  readonly own: ClaimedPath;
  /** The instance node's `instanceNameSettings`, in file order. */
  readonly settings: readonly InstanceNameSetting[];
}

/** A setting inside a nested instance, which that instance's own graft applies. */
interface HandedSetting {
  /** The nested instance's path below the sub-scene root. */
  readonly at: readonly string[];
  readonly setting: InstanceNameSetting;
}

/**
 * The sub-scene root's children with the host's overrides folded in. A grafted node
 * carries the outer scope, and a node an override reached carries its own scope plus
 * the resources the override names (`rehomeOverride`).
 *
 * @param rootChildren the loaded sub-scene root's children (never mutated)
 * @param hostChildren the instancing node's children, deep and direct alike
 * @param names the sub-scene's own `%Name` table and the settings the instance carries
 */
export function graftInstanceChildren(
  rootChildren: readonly LiveNode[],
  hostChildren: readonly LiveNode[],
  scopes: InstanceScopes,
  names: InstanceNames
): LiveNode[] {
  if (hostChildren.length === 0) return [...rootChildren];

  let grafted = [...rootChildren];
  const appendedAtRoot: LiveNode[] = [];
  const { claims, handed } = instanceTable(rootChildren, names);

  for (const child of hostChildren) {
    // A child re-anchored at a nested instance keeps the scene it was authored in.
    const stamped = child.scope ? child : { ...child, scope: scopes.outer };
    if (!child.instanceSubPath) {
      const folded = child.overridesExistingNode ? foldOrWarn(grafted, stamped, scopes.content) : null;
      if (folded) grafted = folded;
      else appendedAtRoot.push(stamped);
      continue;
    }

    const segments = expandUniqueNames(child.instanceSubPath.split('/'), grafted, claims);
    const next = graftAt(grafted, segments, stamped, scopes.content);
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

  return handDown([...grafted, ...appendedAtRoot], handed);
}

/**
 * The instance's `%Name` table once its settings land, and the settings it hands to a nested
 * instance. Instantiate acquires the sub-scene's own names first (packed_scene.cpp:565-570), then
 * applies each setting in file order: a set acquires a free name, and the first claimant keeps it
 * (node.cpp:2225-2231). A clear releases the node's own name (node.cpp:2236-2249).
 */
function instanceTable(
  rootChildren: readonly LiveNode[],
  { own, settings }: InstanceNames
): { claims: ClaimedPath; handed: HandedSetting[] } {
  const changed = new Map<string, string | undefined>();
  const claims: ClaimedPath = (key) => (changed.has(key) ? changed.get(key) : own(key));
  const handed: HandedSetting[] = [];
  for (const setting of settings) {
    const authored = setting.pathInInstance.split('/');
    const segments = [...expandUniqueNames(authored.slice(0, -1), rootChildren, claims), authored.at(-1)!];
    const owner = tableOwner(rootChildren, segments, setting.ownerInInstance);
    if (owner === null) continue;
    if (owner !== THIS_INSTANCE) {
      handed.push({
        at: segments.slice(0, owner.nestedAt + 1),
        setting: rebased(setting, segments, owner.nestedAt),
      });
      continue;
    }
    const key = UNIQUE_NODE_PREFIX + segments.at(-1)!;
    changed.set(key, holderAfterSetting(claims(key), segments.join('/'), setting.isUnique));
  }
  return { claims, handed };
}

const THIS_INSTANCE = 'this instance';

/** Whose table a setting lands in: the instance this graft composes, or a nested one along its path. */
type TableOwner = typeof THIS_INSTANCE | { readonly nestedAt: number };

/**
 * Whose table a setting at `segments` lands in, or null for a node the sub-scene lacks or a table
 * no instance reads. Without an explicit owner, a node inside a nested instance keeps that
 * instance's owner (resource_format_text.cpp:264-265).
 */
function tableOwner(
  rootChildren: readonly LiveNode[],
  segments: readonly string[],
  ownerInInstance: string | undefined
): TableOwner | null {
  const nestedAt = instanceDepth(rootChildren, segments.slice(0, -1));
  if (nestedAt === null || (nestedAt === undefined && !nodeAt(rootChildren, segments))) return null;
  if (ownerInInstance === '') return THIS_INSTANCE;
  if (ownerInInstance === undefined) return nestedAt === undefined ? THIS_INSTANCE : { nestedAt };
  const ownerSegments = ownerInInstance.split('/');
  if (!ownerSegments.every((name, index) => segments[index] === name)) return null;
  const ownerAt = instanceDepth(rootChildren, ownerSegments);
  return typeof ownerAt === 'number' ? { nestedAt: ownerAt } : null;
}

/**
 * The depth of the first instance node along `path`: undefined where none is one, and null where
 * `path` names nothing before one.
 */
function instanceDepth(
  rootChildren: readonly LiveNode[],
  path: readonly string[]
): number | undefined | null {
  let siblings = rootChildren;
  for (const [depth, name] of path.entries()) {
    const found = siblings.find((n) => n.name === name);
    if (!found) return null;
    if (found.instance) return depth;
    siblings = found.children;
  }
  return undefined;
}

/** `setting` spelt below the nested instance at depth `at` of `segments`, its expanded path. */
function rebased(setting: InstanceNameSetting, segments: readonly string[], at: number): InstanceNameSetting {
  const pathInInstance = segments.slice(at + 1).join('/');
  const { ownerInInstance } = setting;
  if (ownerInInstance === undefined) return { ...setting, pathInInstance };
  return {
    ...setting,
    pathInInstance,
    ownerInInstance: ownerInInstance
      .split('/')
      .slice(at + 1)
      .join('/'),
  };
}

/** `tree` with each nested instance's handed settings appended, its spine copied once. */
function handDown(tree: LiveNode[], handed: readonly HandedSetting[]): LiveNode[] {
  const byInstance = new Map<string, { at: readonly string[]; settings: InstanceNameSetting[] }>();
  for (const { at, setting } of handed) {
    const key = at.join('/');
    const group = byInstance.get(key) ?? { at, settings: [] };
    group.settings.push(setting);
    byInstance.set(key, group);
  }
  let handedDown = tree;
  for (const { at, settings } of byInstance.values()) handedDown = withSettingsAt(handedDown, at, settings);
  return handedDown;
}

function withSettingsAt(
  siblings: LiveNode[],
  at: readonly string[],
  settings: readonly InstanceNameSetting[]
): LiveNode[] {
  const [head, ...rest] = at;
  const index = siblings.findIndex((n) => n.name === head);
  const target = siblings[index]!;
  const copy = [...siblings];
  copy[index] =
    rest.length > 0
      ? { ...target, children: withSettingsAt(target.children, rest, settings) }
      : { ...target, instanceNameSettings: [...(target.instanceNameSettings ?? []), ...settings] };
  return copy;
}

/**
 * `segments` with each `%Name` the sub-scene's own table answers replaced by the path it claims,
 * since the walk restarts there (node.cpp:1930-1938). It stops at a nested instance, whose own
 * graft reads that scene's table, and leaves an unclaimed name for the graft to miss.
 */
function expandUniqueNames(
  segments: readonly string[],
  rootChildren: readonly LiveNode[],
  claimedPath: ClaimedPath
): string[] {
  if (!segments.some((segment) => segment.startsWith(UNIQUE_NODE_PREFIX))) return [...segments];
  let path: string[] = [];
  for (const [index, segment] of segments.entries()) {
    if (segment.startsWith(UNIQUE_NODE_PREFIX)) {
      const claimed = claimedPath(segment);
      if (claimed === undefined) return [...path, ...segments.slice(index)];
      path = claimed.split('/');
    } else if (segment === '..') {
      path.pop();
    } else if (segment !== '.') {
      path.push(segment);
    }
    if (nodeAt(rootChildren, path)?.instance) return [...path, ...segments.slice(index + 1)];
  }
  return path;
}

/** The node at `path` below the sub-scene root, or undefined where none sits there. */
function nodeAt(rootChildren: readonly LiveNode[], path: readonly string[]): LiveNode | undefined {
  let siblings = rootChildren;
  let found: LiveNode | undefined;
  for (const name of path) {
    found = siblings.find((n) => n.name === name);
    if (!found) return undefined;
    siblings = found.children;
  }
  return found;
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
  const { raw, scope } = rehomeOverride(override.rawProperties, overrideScope, existingScope);
  const layered =
    Object.keys(raw).length === 0 ? existing : { ...existing, ...layerRawOverride(existing, existing, raw) };
  const children = attachAll(layered.children, override.children, overrideScope, scope);
  const copy = [...siblings];
  copy[index] = scope === siblingScope ? { ...layered, children } : { ...layered, children, scope };
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
