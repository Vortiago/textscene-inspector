/**
 * CSGPolygon3D `path_node` resolution pass (Godot MODE_PATH). In PATH mode the outline sweeps
 * along a curve on a different node, reached by a NodePath that a render component cannot reach.
 * It runs on the live stage (ADR-0060), as Godot resolves `path_node` with `get_node_or_null` on the
 * live tree (`csg_shape.cpp:2176`), across an instance border too. It reads where the RemoteTransform
 * pass left the nodes, so it takes that pass's result.
 */

import type { LiveLink, LiveTree } from '../../../../r3f/liveSceneTree.js';
import type { CSGPolygon3DProperties } from './types.js';
import type { Path3DProperties } from '../../../../nodes/paths/path3d/types.js';
import { liveGlobalTransform3D } from '../../../../r3f/liveGlobalTransform.js';
import { nodePathUniquePaths } from '../../../../r3f/nodePathUniqueNames.js';
import type { NodePatch, NodePatches } from '../../../../r3f/nodePatch.js';
import {
  resolveNodePathLiteral,
  unclaimedUniqueNames,
  UNIQUE_NODE_PREFIX,
} from '../../../../godot/string/nodePath.js';
import { resolveCurve3D } from '../../../../resources/curves/curve3d/index.js';
import { warnOnce } from '../../../../utils/warnOnce.js';

/** Godot's MODE_PATH. */
const MODE_PATH = 2;
/** A curve needs two points before it describes a direction. */
const MIN_CURVE_POINTS = 2;

/**
 * The `resolvedPath` of every PATH-mode CSGPolygon3D of `tree` whose `path_node` names a Path3D with
 * a curve, by the polygon's live path, so render, bounds, selection, the tree viewer, the inspector
 * and the evaluator read one answer, testable without a renderer. `placed` holds what the
 * RemoteTransform pass moved, which the Path3D's global transform reads.
 */
export function resolveCsgPolygonPaths(tree: LiveTree, placed: NodePatches): NodePatches {
  const patches = new Map<string, NodePatch>();
  tree.fold<void, void>(undefined, (polygon, _, descend) => {
    const resolvedPath = resolvedPathOf(polygon, tree, placed);
    if (resolvedPath) patches.set(polygon.path, { resolvedPath });
    descend();
  });
  return patches;
}

/** The curve and base of the Path3D that `polygon` sweeps along, or undefined where it sweeps none. */
function resolvedPathOf(
  polygon: LiveLink,
  tree: LiveTree,
  placed: NodePatches
): CSGPolygon3DProperties['resolvedPath'] {
  const { node } = polygon.step;
  const props = node.properties as CSGPolygon3DProperties;
  if (node.type !== 'CSGPolygon3D' || props.mode !== MODE_PATH) return undefined;

  // `path_node = NodePath("%Track")` addresses the owner's claim table, not a child. Only a
  // `%Name` segment reads the table, which allocates for each polygon on each load.
  const uniquePaths = props.pathNode?.includes(UNIQUE_NODE_PREFIX)
    ? nodePathUniquePaths(polygon.path, tree.roots, tree.ctx)
    : undefined;
  const targetPath = resolveNodePathLiteral(polygon.path, props.pathNode, uniquePaths);
  if (!targetPath) {
    // A unique name nothing claims is a dangling reference, not a path that deliberately
    // addresses no node. Report it against the literal, since there is no resolved path to quote.
    const unclaimed = unclaimedUniqueNames(props.pathNode, uniquePaths);
    if (unclaimed.length > 0) {
      warnOnce(
        node,
        `${polygon.path}:unclaimed`,
        `[CSGPolygon3D] ${polygon.path}: path_node names ${unclaimed.join(', ')}, which no node in this scene claims.`
      );
    }
    return undefined;
  }

  const target = tree.at(targetPath);
  if (!target) {
    warnOnce(
      node,
      `${polygon.path}:missing`,
      `[CSGPolygon3D] ${polygon.path}: path_node "${targetPath}" does not resolve to a node.`
    );
    return undefined;
  }
  // Godot casts to Path3D and bails on failure rather than duck-typing.
  if (target.step.node.type !== 'Path3D') {
    warnOnce(
      node,
      `${polygon.path}:type`,
      `[CSGPolygon3D] ${polygon.path}: path_node "${targetPath}" is a ${target.step.node.type}, not a Path3D.`
    );
    return undefined;
  }

  // The Path3D's `curve` names a SubResource of the file that wrote the Path3D.
  const curveRef = (target.step.node.properties as Path3DProperties).curve;
  const curvePoints = resolveCurve3D(curveRef, target.step.scope.internalResources);
  if (curvePoints.length < MIN_CURVE_POINTS) return undefined;

  // `path_local` builds the sweep in the polygon's own space. Otherwise Godot uses the Path3D's
  // global transform as the base, builds the brush there and consumes it as local geometry, so a
  // non-local sweep lands doubly transformed. That Godot quirk is kept for parity. Scenes in
  // practice set path_local = true.
  const baseTransform = props.pathLocal ? null : liveGlobalTransform3D(tree, targetPath, placed);

  // Plain serialisable data, no closures or `THREE.Matrix4`, because the inspector walks
  // `node.properties` directly. The component turns it into a sampler and a matrix.
  return { curvePoints, baseTransform };
}
