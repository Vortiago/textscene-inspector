/**
 * An instance's `%Name` table, composed as instantiate builds it: the sub-scene's own names first
 * (packed_scene.cpp:565-570), then each host setting at its heading, in file order. The graft is
 * the only composer, and the render path reads the finished table off the merged node.
 */

import type { LiveNode } from './liveNode';
import { joinPath, pathBetween } from '../utils/nodePath';
import {
  UNIQUE_NODE_PREFIX,
  nodePathNames,
  walkFromRoot,
  walkedPath,
  type RootWalkTables,
} from '../godot/string/nodePath';
import { holderAfterSetting, isOutsideInstance, type InstanceNameSetting } from '../parser/nodeOwner';

/**
 * Each `%Name` key to the path from the instanced scene's root to the node that holds it. A node
 * outside the instance that its explicit `owner=` gives to it climbs out with `..`.
 */
export type UniqueNamePaths = ReadonlyMap<string, string>;

/**
 * The path from the instanced scene's root that the table gives a `%Name` key, as in
 * {@link UniqueNamePaths}, or undefined where nothing claims it.
 */
export type ClaimedPath = (key: string) => string | undefined;

/** An instance's finished `%Name` table, which the merged node keeps for the render path. */
export interface UniqueNameTable {
  /** Each name the instance holds, to its path from the instanced scene's root. */
  paths(): UniqueNamePaths;
}

/**
 * The finished table of the nested instance node at a path below the sub-scene root, as it
 * collapses now, or undefined where its scene is not known yet.
 */
type NestedTable = (path: string) => UniqueNamePaths | undefined;

/** The `%Name` facts a graft reads for one instance. */
export interface InstanceNames {
  /**
   * The sub-scene's own table, as it instantiates by itself. A thunk: the graft reads it only for
   * a `%Name` sub-path or setting, and the render path only for a node that asks.
   */
  readonly own: () => UniqueNamePaths;
  /** The instance node's `instanceNameSettings`, in file order. */
  readonly settings: readonly InstanceNameSetting[];
  /**
   * Whether the sub-scene root inherits a base that the cache could not compose it over. The table
   * and the children are not final then: a walk that fails here may still succeed over the base.
   */
  readonly hasUnloadedBase?: boolean;
  /**
   * The table of a nested instance node, which a `%Name` walk reads before the owner's
   * (node.cpp:1930-1938). Absent where the graft cannot collapse a nested instance.
   */
  readonly nested?: (node: LiveNode) => UniqueNamePaths | undefined;
}

/**
 * The instance's table while its graft runs. A set acquires a free name and the first claimant
 * keeps it (node.cpp:2225-2231). A clear releases the node's own name (node.cpp:2236-2249).
 */
export class InstanceNameTable implements UniqueNameTable {
  /** Written only by `landOne`: each name a setting moved, undefined where it freed the name. */
  private readonly changed = new Map<string, string | undefined>();
  private readonly own: () => UniqueNamePaths;
  private readonly settings: readonly InstanceNameSetting[];
  private readonly nested?: InstanceNames['nested'];
  /** Written only by `landUpTo`: how many of `settings` have landed. */
  private landed = 0;
  /** Written only by `paths`, read once the graft has landed every setting. */
  private finished?: UniqueNamePaths;

  constructor({ own, settings, nested }: InstanceNames) {
    this.own = own;
    this.settings = settings;
    this.nested = nested;
  }

  /**
   * The sub-path a host child states, walked over `tree` as {@link subPathSegments} walks it, with
   * the table of each nested instance the walk stands on read first.
   */
  walk(subPath: string, tree: readonly LiveNode[]): string[] | null {
    const { nested } = this;
    const nestedTable: NestedTable | undefined =
      nested &&
      ((path) => {
        const node = nodeAt(tree, path.split('/'));
        return node && nested(node);
      });
    return subPathSegments(subPath, tree, this.claimed, nestedTable);
  }

  /** The path from the sub-scene root that holds `key` now, as in {@link UniqueNamePaths}. */
  readonly claimed: ClaimedPath = (key) =>
    this.changed.has(key) ? this.changed.get(key) : this.own().get(key);

  /** The finished table: the sub-scene's own, the same object where no setting moved a name. */
  paths(): UniqueNamePaths {
    this.finished ??= this.changed.size === 0 ? this.own() : withChanges(this.own(), this.changed);
    return this.finished;
  }

  /** `tree` once every setting written before host child `hostChildrenSeen` has landed. */
  landUpTo(tree: LiveNode[], hostChildrenSeen: number): LiveNode[] {
    let landedTree = tree;
    for (; this.landed < this.settings.length; this.landed++) {
      const setting = this.settings[this.landed]!;
      if (setting.hostChildrenBefore > hostChildrenSeen) break;
      landedTree = this.landOne(landedTree, setting);
    }
    return landedTree;
  }

  /**
   * `tree` once `setting` lands in this table, or once it is handed to the nested instance whose
   * table it names. A setting on a node the sub-scene lacks changes nothing.
   */
  private landOne(tree: LiveNode[], authored: InstanceNameSetting): LiveNode[] {
    const setting = withOwnerWalked(tree, authored, this.claimed);
    if (!setting) return tree;
    if (isOutsideInstance(setting)) {
      if (!setting.ownerInInstance) {
        this.land(setting.pathInInstance, setting.isUnique);
        return tree;
      }
      return handOutside(tree, setting.ownerInInstance.split('/'), setting.pathInInstance, setting);
    }
    const segments = settingSegments(tree, setting.pathInInstance, this.claimed);
    if (!segments) return tree;
    const owner = tableOwner(tree, segments, setting.ownerInInstance);
    if (owner === null) return tree;
    if (owner === OUTSIDE_THE_OWNER) {
      return handOutside(tree, setting.ownerInInstance!.split('/'), segments.join('/'), setting);
    }
    if (owner !== THIS_INSTANCE) {
      return handTo(tree, segments.slice(0, owner.nestedAt + 1), rebased(setting, segments, owner.nestedAt));
    }
    this.land(segments.join('/'), setting.isUnique);
    return tree;
  }

  /** The table once the node at `path` sets or clears its name. */
  private land(path: string, isUnique: boolean): void {
    const key = UNIQUE_NODE_PREFIX + nodePathNames(path).at(-1)!;
    const holder = this.claimed(key);
    const next = holderAfterSetting(holder, path, isUnique);
    // A set on a held name or a clear on a free one changes nothing, so `paths` keeps the own table.
    if (next !== holder) this.changed.set(key, next);
  }
}

/** `paths` with each changed name moved to its new holder, or dropped where a clear freed it. */
function withChanges(
  paths: UniqueNamePaths,
  changed: ReadonlyMap<string, string | undefined>
): UniqueNamePaths {
  const moved = new Map(paths);
  for (const [key, path] of changed) {
    if (path === undefined) moved.delete(key);
    else moved.set(key, path);
  }
  return moved;
}

/**
 * `setting` with each `%Name` in its explicit owner replaced through this table, as the loader's
 * walk from the root reads it (packed_scene.cpp:159-161), or null where the owner names nothing.
 */
function withOwnerWalked(
  tree: readonly LiveNode[],
  setting: InstanceNameSetting,
  claimed: ClaimedPath
): InstanceNameSetting | null {
  const { ownerInInstance } = setting;
  if (!ownerInInstance) return setting;
  const segments = subPathSegments(ownerInInstance, tree, claimed);
  return segments && { ...setting, ownerInInstance: segments.join('/') };
}

/** The node a setting names, its parent walked as a host sub-path, or null where that names nothing. */
function settingSegments(
  tree: readonly LiveNode[],
  pathInInstance: string,
  claimed: ClaimedPath
): string[] | null {
  const authored = pathInInstance.split('/');
  const parent = authored.length > 1 ? subPathSegments(authored.slice(0, -1).join('/'), tree, claimed) : [];
  return parent && [...parent, authored.at(-1)!];
}

const THIS_INSTANCE = 'this instance';
const OUTSIDE_THE_OWNER = 'outside the owner';

/**
 * Whose table a setting lands in: the instance this graft composes, a nested one along its path, or
 * the nested instance its explicit owner names off its path.
 */
type TableOwner = typeof THIS_INSTANCE | typeof OUTSIDE_THE_OWNER | { readonly nestedAt: number };

/**
 * Whose table a setting at `segments` lands in, or null for a node the sub-scene lacks or a table
 * no instance reads. Without an explicit owner, a node inside a nested instance keeps that
 * instance's owner (resource_format_text.cpp:264-265).
 */
function tableOwner(
  tree: readonly LiveNode[],
  segments: readonly string[],
  ownerInInstance: string | undefined
): TableOwner | null {
  const nestedAt = instanceDepth(tree, segments.slice(0, -1));
  if (nestedAt === null || (nestedAt === undefined && !nodeAt(tree, segments))) return null;
  if (ownerInInstance === '') return THIS_INSTANCE;
  if (ownerInInstance === undefined) return nestedAt === undefined ? THIS_INSTANCE : { nestedAt };
  const ownerSegments = ownerInInstance.split('/');
  if (!ownerSegments.every((name, index) => segments[index] === name)) {
    return isNestedInstanceAt(tree, ownerSegments) ? OUTSIDE_THE_OWNER : null;
  }
  const ownerAt = instanceDepth(tree, ownerSegments);
  return typeof ownerAt === 'number' ? { nestedAt: ownerAt } : null;
}

/**
 * The depth of the first instance node along `path`: undefined where none is one, and null where
 * `path` names nothing before one.
 */
function instanceDepth(tree: readonly LiveNode[], path: readonly string[]): number | undefined | null {
  let siblings = tree;
  for (const [depth, name] of path.entries()) {
    const found = siblings.find((n) => n.name === name);
    if (!found) return null;
    if (found.instance) return depth;
    siblings = found.children;
  }
  return undefined;
}

/** Whether the node at `path` is an instance with no instance above it, whose graft this one hands to. */
function isNestedInstanceAt(tree: readonly LiveNode[], path: readonly string[]): boolean {
  return instanceDepth(tree, path) === path.length - 1;
}

/**
 * `tree` with `setting` handed to the nested instance at `owner`, on the node at `nodePath` outside
 * it, which that instance's graft lands in its own table. A node `owner` does not name is no table.
 */
function handOutside(
  tree: LiveNode[],
  owner: readonly string[],
  nodePath: string,
  setting: InstanceNameSetting
): LiveNode[] {
  if (!isNestedInstanceAt(tree, owner)) return tree;
  const { isUnique, hostChildrenBefore } = setting;
  return handTo(tree, owner, {
    pathInInstance: pathBetween(owner.join('/'), nodePath),
    isUnique,
    hostChildrenBefore,
  });
}

/** The node at `path` below the sub-scene root, or undefined where none sits there. */
export function nodeAt(tree: readonly LiveNode[], path: readonly string[]): LiveNode | undefined {
  let siblings = tree;
  let found: LiveNode | undefined;
  for (const name of path) {
    found = siblings.find((n) => n.name === name);
    if (!found) return undefined;
    siblings = found.children;
  }
  return found;
}

/**
 * `tree` with the node at `path` swapped for what `replace` returns for it, as a copy along that
 * spine that shares every other node. The caller passes a path that names a node.
 *
 * @canonical A Live tree with the node at a name path replaced
 */
export function replacedAt(
  tree: readonly LiveNode[],
  path: readonly string[],
  replace: (node: LiveNode) => LiveNode
): LiveNode[] {
  const replacedBelow = (siblings: readonly LiveNode[], depth: number): LiveNode[] => {
    const name = path[depth];
    const index = siblings.findIndex((n) => n.name === name);
    if (index === -1) throw new Error(`expected a node at "${path.join('/')}", found none named "${name}"`);
    const target = siblings[index]!;
    const copy = [...siblings];
    copy[index] =
      depth === path.length - 1
        ? replace(target)
        : { ...target, children: replacedBelow(target.children, depth + 1) };
    return copy;
  };
  return replacedBelow(tree, 0);
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

/**
 * `tree` with `setting` appended to the nested instance at `at`. It lands after the children that
 * instance holds now, as file order places it for that instance's graft.
 */
function handTo(tree: readonly LiveNode[], at: readonly string[], setting: InstanceNameSetting): LiveNode[] {
  return replacedAt(tree, at, (target) => ({
    ...target,
    instanceNameSettings: [
      ...(target.instanceNameSettings ?? []),
      { ...setting, hostChildrenBefore: target.children.length },
    ],
  }));
}

/**
 * A sub-path below the sub-scene root, walked as Godot walks a `parent=` path (`walkFromRoot`) over
 * the instance's `%Name` table, or null where it names nothing. A walk into a nested instance
 * keeps the rest as written, for that instance's own graft to resolve. A sub-path with no `%Name`
 * is the path as written, which the seating already walked.
 */
export function subPathSegments(
  subPath: string,
  tree: readonly LiveNode[],
  claimed: ClaimedPath,
  nested?: NestedTable
): string[] | null {
  const segments = subPath.split('/');
  if (!segments.some((segment) => segment.startsWith(UNIQUE_NODE_PREFIX))) return segments;
  const path = walkedPath(walkFromRoot(subPath, subSceneWalkTables(tree, claimed, nested)));
  if (path === null) return null;
  return path === '' ? [] : path.split('/');
}

/** The first segment of a walk that left a tree for the one above it. */
export const OUTSIDE = '..';

/**
 * The end of a walk that found nothing in a tree whose root is an instance root. A `%Name` first
 * step that the root's table lacks reads the table of the root's owner next (node.cpp:1930-1938),
 * which the tree above holds. Null for any other failure: nothing above answers it.
 */
export function endAboveRoot(subPath: string, claimed: ClaimedPath): string | null {
  const [first = ''] = subPath.split('/');
  const isLacking = first.startsWith(UNIQUE_NODE_PREFIX) && claimed(first) === undefined;
  return isLacking ? joinPath(OUTSIDE, subPath) : null;
}

const INSIDE_INSTANCE = 'inside a nested instance';

/** The walk's tables over the sub-scene: a nested instance is opaque, and so is anything below it. */
function subSceneWalkTables(
  tree: readonly LiveNode[],
  claimed: ClaimedPath,
  nested?: NestedTable
): RootWalkTables {
  const reach = (path: string): LiveNode | typeof INSIDE_INSTANCE | undefined => {
    if (path === '') return undefined;
    const segments = path.split('/');
    const nestedAt = instanceDepth(tree, segments.slice(0, -1));
    if (nestedAt === null) return undefined;
    return nestedAt === undefined ? nodeAt(tree, segments) : INSIDE_INSTANCE;
  };
  return {
    exists: (path) => path === '' || reach(path) !== undefined,
    isOpaque: (path) => {
      const at = reach(path);
      return at === INSIDE_INSTANCE || Boolean(at?.instance);
    },
    uniquePaths: { get: claimed },
    // Only an instance root has a table of its own: a node below it reads that instance's.
    instanceTable: (path) => {
      const at = reach(path);
      return at === INSIDE_INSTANCE || !at?.instance ? undefined : nested?.(path);
    },
  };
}
