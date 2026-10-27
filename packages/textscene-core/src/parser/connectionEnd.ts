/**
 * Resolves the `from=` or `to=` of a `[connection]` over a seated scene: the node its path walks to,
 * else the heading its id trail lands on. The linter and the language features both ask it here.
 */

import { simplifiedNodePath } from '../godot/string/nodePath.js';
import { builtSceneTrailEnd } from './idTrail.js';
import { isSeatedAtOwnPathIn, UNKNOWABLE, type SceneSeating } from './sceneTreeBuilder.js';
import type { NodeOrigin, NodePathResolution, RawNode } from './types.js';

/**
 * The node a connection end names, from its written path and its `from_uid_path=` or `to_uid_path=`.
 * Unknowable where the path or the trail enters content this file does not list.
 */
export type ConnectionEndResolver<N extends RawNode> = (
  path: string,
  idTrail: readonly number[] | undefined
) => NodePathResolution<N>;

/**
 * The resolver for the `[node]` headings `origins` and the `seating` built from them. It keeps
 * `origins`, so it lives as long as the scan that holds it.
 *
 * @canonical One end of a `[connection]`
 */
export function connectionEndResolver<N extends RawNode>(
  origins: readonly NodeOrigin<N>[],
  seating: Pick<SceneSeating<N>, 'seated' | 'resolve'>
): ConnectionEndResolver<N> {
  // An id trail finds a heading at the path it declares (`packed_scene.cpp:1985-2005`), so an
  // orphan, re-rooted or recovered elsewhere, is not there.
  const isPlaced = isSeatedAtOwnPathIn(seating);
  return (path, idTrail) => {
    // The loader stores the simplified path (`resource_format_text.cpp:370-371`), so `Gone/..` never walks.
    const walked = seating.resolve(simplifiedNodePath(path));
    // A path that misses falls back to the id trail (`packed_scene.cpp:161-163`).
    if (walked.status !== 'missing' || idTrail === undefined) return walked;
    const end = builtSceneTrailEnd(idTrail, origins, isPlaced);
    if (end === undefined) return walked;
    // An `inBase` trail continues in a scene this file does not open.
    if (end.kind === 'inBase') return UNKNOWABLE;
    return { status: 'found', node: seating.seated.get(origins[end.heading]!.node)! };
  };
}
