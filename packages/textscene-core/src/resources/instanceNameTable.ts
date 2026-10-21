/**
 * An instance's `%Name` table, composed as instantiate builds it: the sub-scene's own names first
 * (packed_scene.cpp:565-570), then each host setting at its heading, in file order. The graft is
 * the only composer, and the render path reads the finished table off the merged node.
 */

import type { LiveNode } from './liveNode';
import { UNIQUE_NODE_PREFIX, walkFromRoot, type RootWalkTables } from '../godot/string/nodePath';
import { holderAfterSetting, type InstanceNameSetting } from '../parser/nodeOwner';

/** Each `%Name` key to the path below the instanced scene's root that holds it. */
export type UniqueNamePaths = ReadonlyMap<string, string>;

/**
 * The path below the instanced scene's root that the table gives a `%Name` key, or undefined
 * where nothing there claims it.
 */
export type ClaimedPath = (key: string) => string | undefined;

/** An instance's finished `%Name` table, which the merged node keeps for the render path. */
export interface UniqueNameTable {
  /** Each name the instance holds, to its path below the instanced scene's root. */
  paths(): UniqueNamePaths;
}

/** The `%Name` facts a graft reads for one instance. */
export interface InstanceNames {
  /**
   * The sub-scene's own table, as it instantiates by itself. A thunk: the graft reads it only for
   * a `%Name` sub-path or setting, and the render path only for a node that asks.
   */
  readonly own: () => UniqueNamePaths;
  /** The instance node's `instanceNameSettings`, in file order. */
  readonly settings: readonly InstanceNameSetting[];
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
  /** Written only by `landUpTo`: how many of `settings` have landed. */
  private landed = 0;
  /** Written only by `paths`, read once the graft has landed every setting. */
  private finished?: UniqueNamePaths;

  constructor({ own, settings }: InstanceNames) {
    this.own = own;
    this.settings = settings;
  }

  /** The path below the sub-scene root that holds `key` now. */
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
  private landOne(tree: LiveNode[], setting: InstanceNameSetting): LiveNode[] {
    const segments = settingSegments(tree, setting.pathInInstance, this.claimed);
    if (!segments) return tree;
    const owner = tableOwner(tree, segments, setting.ownerInInstance);
    if (owner === null) return tree;
    if (owner !== THIS_INSTANCE) {
      return handTo(tree, segments.slice(0, owner.nestedAt + 1), rebased(setting, segments, owner.nestedAt));
    }
    const key = UNIQUE_NODE_PREFIX + segments.at(-1)!;
    this.changed.set(key, holderAfterSetting(this.claimed(key), segments.join('/'), setting.isUnique));
    return tree;
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

/** Whose table a setting lands in: the instance this graft composes, or a nested one along its path. */
type TableOwner = typeof THIS_INSTANCE | { readonly nestedAt: number };

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
  if (!ownerSegments.every((name, index) => segments[index] === name)) return null;
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

/** The node at `path` below the sub-scene root, or undefined where none sits there. */
function nodeAt(tree: readonly LiveNode[], path: readonly string[]): LiveNode | undefined {
  let siblings = tree;
  let found: LiveNode | undefined;
  for (const name of path) {
    found = siblings.find((n) => n.name === name);
    if (!found) return undefined;
    siblings = found.children;
  }
  return found;
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
 * `siblings` with `setting` appended to the nested instance at `at`, copied along that spine. It
 * lands after the children that instance holds now, as file order places it for that instance's graft.
 */
function handTo(
  siblings: readonly LiveNode[],
  at: readonly string[],
  setting: InstanceNameSetting
): LiveNode[] {
  const [head, ...rest] = at;
  const index = siblings.findIndex((n) => n.name === head);
  const target = siblings[index]!;
  const handed = { ...setting, hostChildrenBefore: target.children.length };
  const copy = [...siblings];
  copy[index] =
    rest.length > 0
      ? { ...target, children: handTo(target.children, rest, setting) }
      : { ...target, instanceNameSettings: [...(target.instanceNameSettings ?? []), handed] };
  return copy;
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
  claimed: ClaimedPath
): string[] | null {
  const segments = subPath.split('/');
  if (!segments.some((segment) => segment.startsWith(UNIQUE_NODE_PREFIX))) return segments;
  const end = walkFromRoot(subPath, subSceneWalkTables(tree, claimed));
  if (end === null) return null;
  const path = typeof end === 'string' ? end : end.unlisted;
  return path === '' ? [] : path.split('/');
}

const INSIDE_INSTANCE = 'inside a nested instance';

/** The walk's tables over the sub-scene: a nested instance is opaque, and so is anything below it. */
function subSceneWalkTables(tree: readonly LiveNode[], claimed: ClaimedPath): RootWalkTables {
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
  };
}
