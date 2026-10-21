/**
 * The `parent_id_path=` recovery for a heading whose `parent=` path does not walk, over the
 * headings of one scan. Both the tree builder, which re-roots a node the trail does not seat, and
 * the linter, which names where the trail lands, ask it here.
 */

import type { NodeOrigin, RawNode } from './types.js';
import {
  INSTANCE_PLACEHOLDER_TYPE,
  recoverByIdTrail,
  type IdHeading,
  type IdTrailEnd,
} from '../godot/scene/packedScene.js';

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

/** Where `trail` lands over the first `builtCount` headings, as instantiate has built them. */
function trailEnd<N extends RawNode>(
  trail: readonly number[],
  origins: readonly NodeOrigin<N>[],
  isPlaced: (origin: NodeOrigin<N>) => boolean,
  builtCount: number
): IdTrailEnd | undefined {
  return recoverByIdTrail(trail, idHeadingsOf(origins, isPlaced), builtCount);
}

/** Each heading as `recoverByIdTrail` reads it, placed where `isPlaced` says. */
export function idHeadingsOf<N extends RawNode>(
  origins: readonly NodeOrigin<N>[],
  isPlaced: (origin: NodeOrigin<N>) => boolean
): IdHeading[] {
  return origins.map((origin) => ({
    uniqueId: origin.uniqueId,
    instance: instanceKind(origin.node),
    isPlaced: isPlaced(origin),
  }));
}

function instanceKind(node: RawNode): IdHeading['instance'] {
  if (node.type === INSTANCE_PLACEHOLDER_TYPE) return 'placeholder';
  return node.instance === undefined ? undefined : 'scene';
}
