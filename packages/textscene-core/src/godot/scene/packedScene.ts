/**
 * The vocabulary of a `[node]` heading: `scene/resources/packed_scene.cpp` and its text loader.
 * It lives here because both node creators spell it, the renderer's `NodeRegistry` and the
 * linter's `StrictTscnParser`, and neither depends on the other. Two copies would let what
 * renders and what lints diverge silently.
 */

import { parseSlotInt } from '../variant/intReader.js';
import { int32Elements } from '../variant/packedInt32.js';
import { INT32_MIN } from '../variant/intWidth.js';
import { packedArrayLiteral } from '../variant/variantParser.js';

/**
 * The class Godot instantiates for an `instance_placeholder=` heading
 * (`packed_scene.cpp:255`). The placeholder is a real node with no children
 * until something replaces it.
 */
export const INSTANCE_PLACEHOLDER_TYPE = 'InstancePlaceholder';

const ID_TRAIL_RE = packedArrayLiteral('PackedInt32Array');

/**
 * An unstorable id (`inf`, `nan`) reads as `INT32_MIN`, which Godot 4.6.3 x86_64 stores for a
 * `unique_id=` and for an id of a `parent_id_path=`.
 */
function storedId(stored: number): number {
  return Number.isNaN(stored) ? INT32_MIN : stored;
}

/**
 * The ids of a `parent_id_path=` literal, in order, or undefined where it is not a
 * `PackedInt32Array(…)` of integers. The text loader reads it as that type
 * (`resource_format_text.cpp:209-211`).
 */
export function parseIdTrail(literal: string | undefined): number[] | undefined {
  if (literal === undefined) return undefined;
  const body = ID_TRAIL_RE.exec(literal)?.[1];
  if (body === undefined) return undefined;
  return int32Elements(body)?.map(storedId);
}

/**
 * The `unique_id=` of a heading, or `0` where it has none or does not hold an integer
 * (`UNIQUE_SCENE_ID_UNASSIGNED`, `node.h:140`). The loader assigns the field's Variant to an
 * `int` (`resource_format_text.cpp:214-215`), so a bool converts as 1 or 0.
 */
export function parseUniqueId(literal: string | undefined): number {
  if (literal === undefined) return 0;
  const stored = parseSlotInt(literal);
  return stored === null ? 0 : storedId(stored);
}

/** What {@link recoverByIdTrail} reads of one `[node]` heading, in file order. */
export interface IdHeading {
  /** The heading's `unique_id=`, or `0` (`UNIQUE_SCENE_ID_UNASSIGNED`, `node.h:140`) where it has none. */
  readonly uniqueId: number;
  /** Whether the heading carries `instance=` or `instance_placeholder=`. */
  readonly instance: 'scene' | 'placeholder' | undefined;
  /** Whether the heading's `parent=` path walked, so its node exists at its authored path. */
  readonly isPlaced: boolean;
}

/**
 * Where `_recover_node_path_index` seats a node whose `parent=` path does not walk
 * (`packed_scene.cpp:1947-2005`): under the heading at `heading` (`lands`), or in the scene
 * that heading instances (`inBase`).
 */
export interface IdTrailEnd {
  readonly kind: 'lands' | 'inBase';
  readonly heading: number;
}

/**
 * Follows `trail` through the headings of a scene that has no base scene, so the first
 * lookup is local (`packed_scene.cpp:1960-1979`). `builtCount` is the number of headings
 * built before the lookup: the headings before a node whose path did not walk, or all of
 * them after the build. Only those can the final `get_node_or_null` find (`:2005`). Undefined where the trail resolves
 * nowhere, so Godot re-roots the node.
 */
export function recoverByIdTrail(
  trail: readonly number[],
  headings: readonly IdHeading[],
  builtCount: number
): IdTrailEnd | undefined {
  const [firstId] = trail;
  // An empty trail builds an empty path, which `get_node_or_null` resolves to null (`node.cpp:1894`).
  if (firstId === undefined) return undefined;
  // `ids.find` returns the first match, so id `0` names the first heading with no `unique_id=`.
  const index = headings.findIndex((heading) => heading.uniqueId === firstId);
  const named = headings[index];
  if (named === undefined) return undefined;
  if (trail.length === 1) {
    return index < builtCount && named.isPlaced ? { kind: 'lands', heading: index } : undefined;
  }
  // A middle hop must be a real instance (`:1996-1997`); its scene holds the rest of the trail.
  // The instance must also be built already, or the final lookup finds nothing (`:2005`).
  const isBuiltInstance = named.instance === 'scene' && index < builtCount && named.isPlaced;
  return isBuiltInstance ? { kind: 'inBase', heading: index } : undefined;
}
