/**
 * Resolves the `from=` or `to=` of a `[connection]` over a seated scene: the node its path walks to,
 * else the heading its id trail lands on. The linter and the language features both ask it here.
 */

import { recoverByIdTrail, type IdHeading } from '../godot/scene/packedScene.js';
import { simplifiedNodePath } from '../godot/string/nodePath.js';
import { idHeadingsOf } from './idTrail.js';
import { orphanedNodes, UNKNOWABLE, type SceneSeating } from './sceneTreeBuilder.js';
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
 * The resolver for the `[node]` headings `origins` and the `seating` built from them. It reads the
 * headings on the first id trail, not before: most ends walk by path, and a plain parse never
 * resolves one.
 */
export function connectionEndResolver<N extends RawNode>(
  origins: readonly NodeOrigin<N>[],
  { seated, resolve }: Pick<SceneSeating<N>, 'seated' | 'resolve'>
): ConnectionEndResolver<N> {
  let headings: IdHeading[] | undefined;
  return (path, idTrail) => {
    // The loader stores the simplified path (`resource_format_text.cpp:370-371`), so `Gone/..` never walks.
    const walked = resolve(simplifiedNodePath(path));
    if (walked.status !== 'missing' || idTrail === undefined) return walked;
    // A path that misses falls back to the id trail. Every heading is built by the time connections
    // are made (`packed_scene.cpp:161-163`, `:647-660`), so the trail sees them all.
    headings ??= placedHeadings(origins, seated);
    const end = recoverByIdTrail(idTrail, headings, headings.length);
    if (end === undefined) return walked;
    // An `inBase` trail continues in a scene this file does not open.
    if (end.kind === 'inBase') return UNKNOWABLE;
    return { status: 'found', node: seated.get(origins[end.heading]!.node)! };
  };
}

/**
 * Each heading as an id trail reads it. A trail finds a heading at the path it declares
 * (`packed_scene.cpp:1985-2005`), so an orphan, re-rooted or recovered elsewhere, is not there.
 */
function placedHeadings<N extends RawNode>(
  origins: readonly NodeOrigin<N>[],
  seated: SceneSeating<N>['seated']
): IdHeading[] {
  const orphans = new Set(orphanedNodes(origins, { seated }));
  return idHeadingsOf(origins, (origin) => !orphans.has(origin));
}
