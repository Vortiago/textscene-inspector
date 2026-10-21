/**
 * Which owner a node's `%Name` lands on. `_acquire_unique_name_in_owner` (node.cpp:2222) registers
 * `"%" + name` on the node's owner and refuses to overwrite an entry (node.cpp:2225-2231), so the
 * first claimant in declaration order wins. The seating records every owner's claims.
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
  /** The node's path below the instance, ending in its name. */
  readonly pathInInstance: string;
  readonly isUnique: boolean;
  /** An explicit `owner=` below the instance, `''` for the instance itself. Absent: the nearest owner. */
  readonly ownerInInstance?: string;
}

/** A `unique_name_in_owner` on a heading another owner than the root holds. */
export interface UniqueNameSetting extends UniqueNameClaim {
  /**
   * The live path of the instance node whose sub-scene root owns the heading, or of the node an
   * explicit `owner=` names.
   */
  readonly owner: string;
  readonly isUnique: boolean;
}

/**
 * Every owner's `%Name` claims in one seated file: the root's table, plus the two facts a per-owner
 * table over composed instanced content is built from.
 */
export interface UniqueNameOwnership {
  /** `%Name` to claim, for the nodes this file's root owns, the first claimant kept. */
  readonly claims: ReadonlyMap<string, UniqueNameClaim>;
  /**
   * Settings on headings another owner holds, in file order, which is the order instantiate
   * applies them in.
   */
  readonly instanceSettings: readonly UniqueNameSetting[];
  /** Live paths of nodes this root owns that sit inside instanced content. */
  readonly ownedInsideInstances: ReadonlySet<string>;
}
