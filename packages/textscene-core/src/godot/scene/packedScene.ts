/**
 * The vocabulary of a `[node]` heading: `scene/resources/packed_scene.cpp` and its text loader.
 * It lives here because both node creators spell it, the renderer's `NodeRegistry` and the
 * linter's `StrictTscnParser`, and neither depends on the other. Two copies would let what
 * renders and what lints diverge silently.
 */

import { nodePathNames } from '../string/nodePath.js';
import { validateNodeName } from '../string/nodeName.js';
import { parseGodotInt } from '../variant/intReader.js';
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
 * The integer an `int32` slot stores for `literal`, or undefined where the tokenizer cannot read it.
 * An unstorable value (`inf`, `nan`) reads as `INT32_MIN`, which Godot 4.6.3 x86_64 stores for a
 * `unique_id=` and for an id of a `parent_id_path=`.
 */
function readInt32(literal: string): number | undefined {
  const stored = parseGodotInt(literal);
  if (stored === null) return undefined;
  return Number.isNaN(stored) ? INT32_MIN : stored;
}

/**
 * The ids of a `parent_id_path=` literal, in order, or undefined where it is not a
 * `PackedInt32Array(…)` of integers. The text loader reads it as that type
 * (`resource_format_text.cpp:209-211`).
 */
export function parseIdTrail(literal: string | undefined): number[] | undefined {
  if (literal === undefined) return undefined;
  const body = ID_TRAIL_RE.exec(literal)?.[1]?.trim();
  if (body === undefined) return undefined;
  if (body === '') return [];
  const ids = body.split(',').map(readInt32);
  return ids.every((id) => id !== undefined) ? ids : undefined;
}

/**
 * The `unique_id=` of a heading, or `0` where it has none or does not hold an integer
 * (`UNIQUE_SCENE_ID_UNASSIGNED`, `node.h:140`; the loader reads it at `resource_format_text.cpp:214-215`).
 */
export function parseUniqueId(literal: string | undefined): number {
  return (literal === undefined ? undefined : readInt32(literal)) ?? 0;
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
 * lookup is local (`packed_scene.cpp:1960-1979`). `orphan` is the index of the heading
 * whose path did not walk. The nodes built so far are the headings before it, which is
 * all the final `get_node_or_null` can find (`:2005`). Undefined where the trail resolves
 * nowhere, so Godot re-roots the node.
 */
export function recoverByIdTrail(
  trail: readonly number[],
  headings: readonly IdHeading[],
  orphan: number
): IdTrailEnd | undefined {
  const [firstId] = trail;
  // An empty trail builds an empty path, which `get_node_or_null` resolves to null (`node.cpp:1894`).
  if (firstId === undefined) return undefined;
  // `ids.find` returns the first match, so id `0` names the first heading with no `unique_id=`.
  const index = headings.findIndex((heading) => heading.uniqueId === firstId);
  const named = headings[index];
  if (named === undefined) return undefined;
  if (trail.length === 1) {
    return index < orphan && named.isPlaced ? { kind: 'lands', heading: index } : undefined;
  }
  // A middle hop must be a real instance (`:1996-1997`); its scene holds the rest of the trail.
  // The instance must also be built already, or the final lookup finds nothing (`:2005`).
  const isBuiltInstance = named.instance === 'scene' && index < orphan && named.isPlaced;
  return isBuiltInstance ? { kind: 'inBase', heading: index } : undefined;
}

/**
 * Godot's name for a re-parented orphan: the vanished path with `./` stripped, every
 * `/` turned into `@`, then `#` and the node's name (`packed_scene.cpp:212`, `:561-563`).
 * `set_name` stores the validated form, replacing `.`, `:`, `@`, `/`, `"` and `%` with
 * `_` (`node.cpp:1441`), so `Gone/Deeper` renames to `Gone_Deeper#Name`.
 */
export function reparentedName(parentPath: string, name: string): string {
  // The prefix is the NodePath's spelling, not the heading's: `:212` reads
  // `String(node_paths[…])`, stored through `prepend_period()` (`resource_format_text.cpp:207`),
  // which inserts a `.` unless one is first and ignores `absolute` (`node_path.cpp:43-49`).
  const names = nodePathNames(parentPath);
  // `prepend_period` skips a NodePath holding no names at all, so `/` stays `/`.
  const withPeriod = names.length === 0 || names[0] === '.' ? names : ['.', ...names];
  // `trim_prefix` removes the added `./` from a relative path. An absolute one keeps
  // its `/` and the period, so `/root/Gone` spells `/./root/Gone`.
  const spelled = (parentPath.startsWith('/') ? '/' : '') + withPeriod.join('/');
  const prefix = spelled.replace(/^\.\//, '').replaceAll('/', '@');
  return validateNodeName(`${prefix}#${name}`);
}
