/**
 * The id-trail recovery over the headings of one scan: the `parent_id_path=` for a heading whose
 * `parent=` path does not walk, and the `owner_uid_path=` for one whose `owner=` path does not.
 * The tree builder and the linter both ask it here.
 */

import type { NodeOrigin, RawNode } from './types.js';
import {
  INSTANCE_PLACEHOLDER_TYPE,
  recoverByIdTrail,
  type IdHeading,
  type IdTrailEnd,
} from '../godot/scene/packedScene.js';
import { firstIndexWith } from '../utils/keyedLookup.js';

/** The first heading of a scan carrying an id, the one index the builder and the linter share. */
const firstOriginWithId = firstIndexWith((origin: NodeOrigin<RawNode>) => origin.uniqueId);

/** Where the trail of `origins[index]` seats it, or undefined where it resolves nowhere or has no trail. */
export function idTrailEnd<N extends RawNode>(
  origins: readonly NodeOrigin<N>[],
  index: number,
  isPlaced: (origin: NodeOrigin<N>) => boolean
): IdTrailEnd | undefined {
  const trail = origins[index]?.idTrail;
  if (trail === undefined) return undefined;
  return trailEnd(trail, origins, isPlaced, index);
}

/**
 * Where the `owner_uid_path=` of `origins[index]` finds its owner, or undefined where it finds
 * nothing or there is none. Instantiate sets the owner once the node itself is built
 * (`packed_scene.cpp:565-568`), so the heading counts among the built ones.
 */
export function ownerTrailEnd<N extends RawNode>(
  origins: readonly NodeOrigin<N>[],
  index: number,
  isPlaced: (origin: NodeOrigin<N>) => boolean
): IdTrailEnd | undefined {
  const trail = origins[index]?.ownerIdTrail;
  if (trail === undefined) return undefined;
  return trailEnd(trail, origins, isPlaced, index + 1);
}

/**
 * Where `trail` lands once every heading is built, as a `[connection]` end looks it up: instantiate
 * makes the connections after the build (`packed_scene.cpp:647-660`).
 */
export function builtSceneTrailEnd<N extends RawNode>(
  trail: readonly number[],
  origins: readonly NodeOrigin<N>[],
  isPlaced: (origin: NodeOrigin<N>) => boolean
): IdTrailEnd | undefined {
  return trailEnd(trail, origins, isPlaced, origins.length);
}

/**
 * Where `trail` lands over the first `builtCount` headings, as instantiate has built them: the
 * headings before a node whose path did not walk, or all of them after the build. Only the heading
 * the trail names is built into an `IdHeading`, so the cost does not grow with the other headings.
 */
function trailEnd<N extends RawNode>(
  trail: readonly number[],
  origins: readonly NodeOrigin<N>[],
  isPlaced: (origin: NodeOrigin<N>) => boolean,
  builtCount: number
): IdTrailEnd | undefined {
  return recoverByIdTrail(
    trail,
    (id) => firstOriginWithId(origins, id),
    (index) => headingOf(origins[index]!, isPlaced),
    builtCount
  );
}

function headingOf<N extends RawNode>(
  origin: NodeOrigin<N>,
  isPlaced: (origin: NodeOrigin<N>) => boolean
): IdHeading {
  return { uniqueId: origin.uniqueId, instance: instanceKind(origin.node), isPlaced: isPlaced(origin) };
}

function instanceKind(node: RawNode): IdHeading['instance'] {
  if (node.type === INSTANCE_PLACEHOLDER_TYPE) return 'placeholder';
  return node.instance === undefined ? undefined : 'scene';
}
