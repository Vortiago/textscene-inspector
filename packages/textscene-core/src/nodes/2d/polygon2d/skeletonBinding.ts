/**
 * The Polygon skin scene pass. A Polygon2D attaches the Skeleton2D its `skeleton` path names when
 * `invert_enabled` is off and `bones` is not empty (`polygon_2d.cpp:127-132`). The component cannot
 * reach the skeleton, so this pass hands the polygon its skeleton and its vertex weights by its live
 * path. It runs on the live stage (ADR-0060), as Godot resolves the paths on the live tree.
 */

import { liveScenePassResults } from '../../../r3f/liveScenePass.js';
import type { LiveLink, LiveTree } from '../../../r3f/liveSceneTree.js';
import { resolveLiteralOnLiveTree } from '../../../r3f/nodePathUniqueNames.js';
import { perObject } from '../../../utils/perObject.js';
import { sameData } from '../../../utils/sameData.js';
import { bindSkeleton2DRigs, skeletonOfBone, type Skeleton2DRig } from '../skeleton2d/skeletonRig.js';
import { vertexInfluences, type BoneWeights, type VertexInfluences } from './polygonSkin.js';
import type { Polygon2DProperties } from './types.js';

/** A Polygon2D bound to a Skeleton2D: what its component needs to skin it each frame. */
export interface PolygonSkeletonBinding {
  /** The live path of the Skeleton2D, whose pose holds the bone matrices. */
  skeletonPath: string;
  /** The bones and weights of each vertex the polygon draws, each bone by its skeleton index. */
  influences: VertexInfluences;
}

/** The binding of every Polygon2D in `tree` that a Skeleton2D deforms, by the polygon's live path. */
export function bindPolygonsToSkeletons(tree: LiveTree): ReadonlyMap<string, PolygonSkeletonBinding> {
  const rigs = liveScenePassResults(bindSkeleton2DRigs, tree);
  const bindings = new Map<string, PolygonSkeletonBinding>();
  tree.fold<void, void>(undefined, (link, _, descend) => {
    const binding = bindingOf(link, tree, rigs);
    if (binding) bindings.set(link.path, kept(link, binding));
    descend();
  });
  return bindings;
}

function bindingOf(
  { step, path }: LiveLink,
  tree: LiveTree,
  rigs: ReadonlyMap<string, Skeleton2DRig>
): PolygonSkeletonBinding | null {
  if (step.node.type !== 'Polygon2D') return null;
  const properties = step.node.properties as Polygon2DProperties;
  const vertexCount = drawnVertexCount(properties);
  if (!namesSkeletonToBind(properties) || vertexCount <= 0) return null;
  const skeletonPath = resolveLiteralOnLiveTree(path, properties.skeleton, tree);
  if (skeletonPath === null || !rigs.has(skeletonPath)) return null;
  const entries: BoneWeights[] = [];
  for (const { path: bonePathLiteral, weights } of properties.bones) {
    const bone = boneIndexOf(resolveLiteralOnLiveTree(skeletonPath, bonePathLiteral, tree), tree, rigs);
    if (bone !== null) entries.push({ bone, weights });
  }
  return { skeletonPath, influences: vertexInfluences(vertexCount, entries) };
}

/**
 * Whether the polygon asks for a Skeleton2D: a `skeleton` path, `bones`, and `invert_enabled` off
 * (`polygon_2d.cpp:127-132`). A polygon that does not watches no load of the pass.
 */
export function namesSkeletonToBind({ skeleton, bones, invertEnabled }: Polygon2DProperties): boolean {
  return skeleton !== undefined && bones.length > 0 && !invertEnabled;
}

/**
 * The vertices the polygon draws: the internal ones drop when `polygons` is empty
 * (`polygon_2d.cpp:152-156`). None with fewer than three points (`polygon_2d.cpp:116-118`).
 */
function drawnVertexCount({ polygon, polygons, internalVertexCount }: Polygon2DProperties): number {
  const pointCount = Math.floor(polygon.length / 2);
  if (pointCount < 3) return 0;
  return polygons.length === 0 && internalVertexCount > 0 ? pointCount - internalVertexCount : pointCount;
}

/**
 * `get_index_in_skeleton` of the Bone2D at `bonePath`: its index in the skeleton it joins, which the
 * polygon's skeleton reads even when it is another one. -1 for a Bone2D that joins none, and null
 * for a path that names no Bone2D, whose entry is skipped.
 */
function boneIndexOf(
  bonePath: string | null,
  tree: LiveTree,
  rigs: ReadonlyMap<string, Skeleton2DRig>
): number | null {
  if (bonePath === null || tree.at(bonePath)?.step.node.type !== 'Bone2D') return null;
  const ownSkeleton = skeletonOfBone(bonePath, tree);
  if (ownSkeleton === null) return -1;
  return rigs.get(ownSkeleton)?.indexOf.get(bonePath) ?? -1;
}

/** Written only by {@link kept}: the last binding of each polygon node, by live path. */
const keptBindings = perObject(() => new Map<string, PolygonSkeletonBinding>());

/** `binding`, or the equal one this polygon had before, so a load that changes nothing re-renders nothing. */
function kept(link: LiveLink, binding: PolygonSkeletonBinding): PolygonSkeletonBinding {
  const bindings = keptBindings(link.step.node);
  const previous = bindings.get(link.path);
  if (previous && sameData(previous, binding)) return previous;
  bindings.set(link.path, binding);
  return binding;
}
