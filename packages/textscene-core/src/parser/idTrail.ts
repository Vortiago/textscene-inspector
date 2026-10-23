/**
 * The id-trail recovery over the headings of one scan: the `parent_id_path=` for a heading whose
 * `parent=` path does not walk, and the `owner_uid_path=` for one whose `owner=` path does not.
 * The tree builder and the linter both ask it here.
 */

import type { NodeOrigin, RawNode } from './types.js';
import {
  INSTANCE_PLACEHOLDER_TYPE,
  idTrailEndAt,
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

/**
 * Written only by {@link firstWithId}, keyed by the origins of one scan, which nothing changes
 * after the scan. An entry clears when nothing holds that array any more.
 */
const firstIndexById = new WeakMap<readonly NodeOrigin<RawNode>[], ReadonlyMap<number, number>>();

/** The index of the first heading carrying `id`, which is the one `recoverByIdTrail` names. */
function firstWithId<N extends RawNode>(origins: readonly NodeOrigin<N>[], id: number): number | undefined {
  let firstIndexes = firstIndexById.get(origins);
  if (!firstIndexes) {
    const built = new Map<number, number>();
    origins.forEach((origin, index) => {
      if (!built.has(origin.uniqueId)) built.set(origin.uniqueId, index);
    });
    firstIndexes = built;
    firstIndexById.set(origins, firstIndexes);
  }
  return firstIndexes.get(id);
}

/**
 * Where `trail` lands over the first `builtCount` headings, as instantiate has built them. Only the
 * heading the trail names is read, so the cost does not grow with the other headings.
 */
function trailEnd<N extends RawNode>(
  trail: readonly number[],
  origins: readonly NodeOrigin<N>[],
  isPlaced: (origin: NodeOrigin<N>) => boolean,
  builtCount: number
): IdTrailEnd | undefined {
  const index = trail[0] === undefined ? undefined : firstWithId(origins, trail[0]);
  const named = index === undefined ? undefined : headingOf(origins[index]!, isPlaced);
  return idTrailEndAt(trail, index ?? -1, named, builtCount);
}

/** Each heading as `recoverByIdTrail` reads it, placed where `isPlaced` says. */
export function idHeadingsOf<N extends RawNode>(
  origins: readonly NodeOrigin<N>[],
  isPlaced: (origin: NodeOrigin<N>) => boolean
): IdHeading[] {
  return origins.map((origin) => headingOf(origin, isPlaced));
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
