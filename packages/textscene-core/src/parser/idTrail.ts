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
  return recoverByIdTrail(trail, idHeadingsOf(origins, isPlaced), index);
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
