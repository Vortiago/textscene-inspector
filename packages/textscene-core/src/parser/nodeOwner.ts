/**
 * Which owner a node's `%Name` lands on. `_acquire_unique_name_in_owner` (node.cpp:2222) registers
 * `"%" + name` on the node's owner and refuses to overwrite an entry (node.cpp:2225-2231), so the
 * first claimant in declaration order wins. The seating records the root's claims, and hands each
 * setting another owner holds to the instance node that owner reads it from.
 */

import type { RawNode } from './types.js';
import { boolSlotValue } from '../godot/variant/variantBool.js';

/**
 * The heading's `unique_name_in_owner` as written, or undefined where it writes none. It is read from
 * `rawProperties` alone, which both parsers publish alike (`parser/rawPropertyParity.test.ts`). No
 * slice models the flag, so typed `properties` lacks it. `PROPERTY_USAGE_NO_EDITOR` hides it and
 * still serialises it (node.cpp:4050).
 */
export function uniqueNameSetting(node: RawNode): boolean | undefined {
  return boolSlotValue(node.rawProperties.unique_name_in_owner);
}

/**
 * Who holds a `%Name` once the heading at `path` writes `unique_name_in_owner`: a set takes a free
 * name and the first claimant keeps it (node.cpp:2225-2231), and a clear releases only the node's
 * own name (node.cpp:2236-2249). Undefined where nobody holds it.
 */
export function holderAfterSetting(
  holder: string | undefined,
  path: string,
  isUnique: boolean
): string | undefined {
  if (isUnique) return holder ?? path;
  return holder === path ? undefined : holder;
}

/**
 * Whether a node is an instance that hides its sub-scene's owner from the nodes below it. An
 * instanced root is the scene's own root, so only an instance below the root does.
 */
export function isInstanceBelowRoot(node: RawNode, isRoot: boolean): boolean {
  return !isRoot && Boolean(node.instance);
}

/**
 * Whether a heading's `owner=` names a node other than the root: the saver writes it only then
 * (resource_format_text.cpp:2024-2025), for a node that instanced content owns.
 */
export function hasForeignOwner(node: RawNode): boolean {
  return node.owner !== undefined && node.owner !== '.';
}

/**
 * Whether the scene root owns a node, so its `%Name` lands in the root's table. An explicit `owner=`
 * decides. Without one, an override heading inside an instance keeps the sub-scene's owner
 * (resource_format_text.cpp:264-265 zeroes `owner` only when `!(type == TYPE_INSTANTIATED &&
 * instance == -1)`), and every other node is the root's.
 */
export function isOwnedByRoot(node: RawNode, insideInstance: boolean): boolean {
  if (node.owner !== undefined) return !hasForeignOwner(node);
  return !(insideInstance && node.overridesExistingNode === true);
}

/** The node a `%Name` addresses, with the two spellings of the path that reaches it. */
export interface UniqueNameClaim {
  readonly node: RawNode;
  /** Where the heading sits in the authored tree, from the root's own name: what a `.tscn`-only walk sees. */
  readonly path: string;
  /**
   * Where the node sits once the instanced content its `parent=` addresses into is composed in:
   * `path` with each ancestor's `instanceSubPath` restored, as the render tree spells paths.
   */
  readonly livePath: string;
}

/**
 * A `unique_name_in_owner` a heading writes inside an instance this file seats, as that instance
 * reads it: true acquires a free name, and false releases the node's own (node.cpp:2236-2249).
 */
export interface InstanceNameSetting {
  /**
   * The node's path below the instance, ending in its name. A node outside the instance that an
   * explicit `owner=` gives to it climbs out with `..`.
   */
  readonly pathInInstance: string;
  readonly isUnique: boolean;
  /** An explicit `owner=` below the instance, `''` for the instance itself. Absent: the nearest owner. */
  readonly ownerInInstance?: string;
  /**
   * How many of the instance node's children the file seats before the setting lands, its own
   * heading included: a host child's `%Name` parent reads the table as of its heading.
   */
  readonly hostChildrenBefore: number;
}

/**
 * Whether the setting is on a node outside the instance, which its explicit `owner=` gives to
 * the instance. No owner walk applies, since the instance itself holds the name.
 */
export function isOutsideInstance(setting: Pick<InstanceNameSetting, 'pathInInstance'>): boolean {
  return setting.pathInInstance.startsWith('../');
}

/**
 * The root's `%Name` claims in one seated file, and where its own nodes sit inside instanced
 * content. Each instance node carries the settings for its own table (`instanceNameSettings`).
 */
export interface UniqueNameOwnership {
  /** `%Name` to claim, for the nodes this file's root owns, the first claimant kept. */
  readonly claims: ReadonlyMap<string, UniqueNameClaim>;
  /** Live paths of nodes this root owns that sit inside instanced content. */
  readonly ownedInsideInstances: ReadonlySet<string>;
  /** Live paths of every heading this file seats inside instanced content, whoever owns it. */
  readonly headingsInsideInstances: ReadonlySet<string>;
}
