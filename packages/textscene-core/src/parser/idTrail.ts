/**
 * The id-trail recovery over the headings of one scan: the `parent_id_path=` for a heading whose
 * `parent=` path does not walk, and the `owner_uid_path=` for one whose `owner=` path does not.
 * The tree builder, the placement facts and the connection-end resolver ask it here.
 */

import type { NodeOrigin, RawNode } from './types.js';
import {
  INSTANCE_PLACEHOLDER_TYPE,
  recoverByIdTrail,
  type IdHeading,
  type IdTrailEnd,
  type TrailHeading,
} from '../godot/scene/packedScene.js';
import { simplifiedNodePath } from '../godot/string/nodePath.js';
import { firstIndexWith } from '../utils/keyedLookup.js';
import { joinPath } from '../utils/nodePath.js';

/**
 * The path segment that stands for the node an id trail finds inside an instance, which only that
 * instance's graft can name. No heading writes it, since `:` ends a name in a NodePath.
 *
 * @canonical The path segment of a node a content trail finds
 */
export function contentTrailSegment(trail: readonly number[]): string {
  return CONTENT_TRAIL_MARK + trail.join(',');
}

const CONTENT_TRAIL_MARK = ':';

/** Whether `path` passes through the segment of a content trail ({@link contentTrailSegment}). */
export function passesContentTrail(path: string): boolean {
  return path.includes(CONTENT_TRAIL_MARK);
}

/** Stands in for a content trail's segment while a path simplifies: a name no NodePath spells. */
const TRAIL_STAND_IN = '\u0000';

/**
 * `path` simplified as `simplifiedNodePath` simplifies it, with the segment of a content trail kept
 * as a name, where a NodePath would read `:` as the start of its subnames.
 */
export function simplifiedLivePath(path: string): string {
  if (!passesContentTrail(path)) return simplifiedNodePath(path);
  const trails: string[] = [];
  const standIns = path
    .split('/')
    .map((segment) => (passesContentTrail(segment) ? TRAIL_STAND_IN + (trails.push(segment) - 1) : segment));
  return simplifiedNodePath(standIns.join('/'))
    .split('/')
    .map((segment) => (segment.startsWith(TRAIL_STAND_IN) ? trails[Number(segment.slice(1))]! : segment))
    .join('/');
}

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
 * Where `trail` lands over the first `builtCount` headings, as instantiate has built them. Only the
 * heading the trail names is read, so the cost does not grow with the other headings.
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

/**
 * What a trail that enters the scene reads of each heading, in file order: the headings a seating
 * leaves out of its tree too, since `ids.find` reads them all (`packed_scene.cpp:1960`).
 */
export function trailHeadingsOf<N extends RawNode>(origins: readonly NodeOrigin<N>[]): TrailHeading[] {
  return origins.map(({ node, declaredParent, uniqueId }) => ({
    uniqueId,
    path: declaredParent === undefined ? '' : authoredPath(declaredParent, node.name),
    instance: instanceKind(node),
    instanceRef: node.instance,
  }));
}

/** The `parent=` a heading writes for a child of the root. */
const ROOT_PARENT = '.';

/** The simplified path of a heading below `parent`. A child of the root, most headings, needs no simplifying. */
function authoredPath(parent: string, name: string): string {
  return parent === ROOT_PARENT ? name : simplifiedNodePath(joinPath(parent, name));
}

function instanceKind(node: RawNode): IdHeading['instance'] {
  if (node.type === INSTANCE_PLACEHOLDER_TYPE) return 'placeholder';
  return node.instance === undefined ? undefined : 'scene';
}
