/**
 * CSGPolygon3D `path_node` resolution pass (Godot MODE_PATH). In PATH mode the outline sweeps
 * along a curve on a different node, reached by a relative NodePath (a sibling or a child) that a
 * render component cannot reach. So this runs once over the parsed tree, after
 * `applyRemoteTransforms` and before the SceneGraph is assembled, as that pass does.
 */

import type { TscnNode, TscnInternalResource } from '../../../../parser/types.js';
import type { CSGPolygon3DProperties } from './types.js';
import type { Path3DProperties } from '../../../../nodes/paths/path3d/types.js';
import { joinPath, resolveNodePathLiteral, unclaimedUniqueNames } from '../../../../utils/nodePath.js';
import { uniqueNamePaths } from '../../../../utils/uniqueNames.js';
import { resolveCurve3D } from '../../../../resources/curves/curve3d/index.js';
import { globalMatrix3D, matrixToTransform3D } from '../../../../r3f/nodeTreeTransforms.js';
import { warn } from '../../../../logger.js';

/** Godot's MODE_PATH. */
const MODE_PATH = 2;
/** A curve needs two points before it describes a direction. */
const MIN_CURVE_POINTS = 2;

/**
 * Resolve every PATH-mode CSGPolygon3D's `path_node` in place, so render, bounds, selection, the
 * tree viewer, the inspector and the evaluator read one answer, testable without a renderer.
 * Returns the same array. Idempotent: a re-run writes the same `resolvedPath`, and the parse it
 * consumes is memoized per content.
 */
export function resolveCsgPolygonPaths(
  nodes: TscnNode[],
  internalResources: readonly TscnInternalResource[]
): TscnNode[] {
  const nodeByPath = new Map<string, TscnNode>();
  const polygons: Array<{ node: TscnNode; path: string }> = [];

  const walk = (node: TscnNode, parentPath: string): void => {
    const path = joinPath(parentPath, node.name);
    nodeByPath.set(path, node);
    if (node.type === 'CSGPolygon3D') {
      const props = node.properties as CSGPolygon3DProperties;
      if (props.mode === MODE_PATH) polygons.push({ node, path });
    }
    for (const child of node.children) walk(child, path);
  };
  for (const node of nodes) walk(node, '');

  if (polygons.length === 0) return nodes;

  // `path_node = NodePath("%Track")` addresses the owner's claim table, not a child.
  const uniquePaths = uniqueNamePaths(nodes);

  for (const { node, path } of polygons) {
    const props = node.properties as CSGPolygon3DProperties;
    delete props.resolvedPath;

    // As in `applyRemoteTransforms`, an absolute path (`/root/…`, the live tree) and a `path_node`
    // across an instanced sub-scene boundary (composed later by the live tree, ADR-0013) stay
    // unresolved.
    const targetPath = resolveNodePathLiteral(path, props.pathNode, uniquePaths);
    if (!targetPath) {
      // A unique name nothing claims is a dangling reference, not a path that deliberately
      // addresses no node. Report it against the literal, since there is no resolved path to quote.
      const unclaimed = unclaimedUniqueNames(props.pathNode, uniquePaths);
      if (unclaimed.length > 0) {
        warn(
          `[CSGPolygon3D] ${path}: path_node names ${unclaimed.join(', ')}, which no node in this scene claims.`
        );
      }
      continue;
    }

    const target = nodeByPath.get(targetPath);
    if (!target) {
      warn(`[CSGPolygon3D] ${path}: path_node "${targetPath}" does not resolve to a node.`);
      continue;
    }
    // Godot casts to Path3D and bails on failure rather than duck-typing.
    if (target.type !== 'Path3D') {
      warn(`[CSGPolygon3D] ${path}: path_node "${targetPath}" is a ${target.type}, not a Path3D.`);
      continue;
    }

    const curveRef = (target.properties as Path3DProperties).curve;
    const curvePoints = resolveCurve3D(curveRef, internalResources);
    if (curvePoints.length < MIN_CURVE_POINTS) continue;

    // `path_local` builds the sweep in the polygon's own space. Otherwise Godot uses the Path3D's
    // global transform as the base, builds the brush there and consumes it as local geometry, so a
    // non-local sweep lands doubly transformed. That Godot quirk is kept for parity. Scenes in
    // practice set path_local = true.
    const baseTransform = props.pathLocal
      ? null
      : matrixToTransform3D(globalMatrix3D(targetPath, nodeByPath));

    // Plain serialisable data, no closures or `THREE.Matrix4`, because the inspector walks
    // `node.properties` directly. The component turns it into a sampler and a matrix.
    props.resolvedPath = { curvePoints, baseTransform };
  }

  return nodes;
}
