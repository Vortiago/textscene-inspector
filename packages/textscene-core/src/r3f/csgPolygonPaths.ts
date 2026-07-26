/**
 * CSGPolygon3D `path_node` resolution pass (Godot MODE_PATH).
 *
 * A CSGPolygon3D in PATH mode sweeps its outline along a curve that belongs to a
 * DIFFERENT node. That node is reached by a relative NodePath — a sibling or a child — and a
 * render component can reach neither.
 *
 * So this runs once over the parsed tree, right after `applyRemoteTransforms` and before
 * the SceneGraph is assembled, exactly like that pass and for the same reason: every
 * downstream consumer (3D render, bounds, selection, the tree viewer, the inspector, and
 * the boolean evaluator) then reads one resolved answer instead of each recomputing it,
 * and the resolution itself stays unit-testable without a renderer.
 *
 * It writes PLAIN SERIALISABLE data onto the node: control points, a point count and an
 * optional Transform3D. No closures and no `THREE.Matrix4`, because the inspector walks
 * `node.properties` directly. The component turns that into a sampler and a matrix.
 *
 * Scope limits, matching `applyRemoteTransforms`:
 *   - absolute paths (`/root/…`) address the live tree and are not modelled;
 *   - a `path_node` crossing an instanced sub-scene boundary is not resolved, because
 *     instances are composed later by the live scene tree (ADR-0013).
 */

import type { TscnNode, TscnInternalResource } from '../parser/types.js';
import type { CSGPolygon3DProperties } from '../nodes/3d/csg/csgpolygon3d/types.js';
import type { Path3DProperties } from '../nodes/paths/path3d/types.js';
import { joinPath, resolveNodePathLiteral } from '../utils/nodePath.js';
import { findSubResource, parseResourceReference } from '../resources/SubResourceResolver.js';
import { parseCurve3DPoints } from '../resources/shapes/curve3d.js';
import { globalMatrix3D, matrixToTransform3D } from './nodeTreeTransforms.js';
import { warn } from '../logger.js';

/** Godot's MODE_PATH. */
const MODE_PATH = 2;
/** A curve needs two points before it describes a direction. */
const MIN_CURVE_POINTS = 2;

/**
 * Resolve every PATH-mode CSGPolygon3D's `path_node`, mutating the nodes in place.
 * Returns the same array for call-site convenience.
 *
 * Idempotent: re-running overwrites `resolvedPath` with the same value, and the parse it
 * consumes is memoized per content anyway.
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

  for (const { node, path } of polygons) {
    const props = node.properties as CSGPolygon3DProperties;
    delete props.resolvedPath;

    const targetPath = resolveNodePathLiteral(path, props.pathNode);
    if (!targetPath) continue;

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
    if (!curveRef) continue;
    const ref = parseResourceReference(curveRef);
    if (!ref || ref.type !== 'SubResource') continue;
    const sub = findSubResource(internalResources, ref.id);
    if (!sub) continue;

    const curvePoints = parseCurve3DPoints(sub.data['_data']);
    if (curvePoints.length < MIN_CURVE_POINTS) continue;

    // `path_local` builds the sweep in the polygon's own space; otherwise Godot uses the
    // Path3D's GLOBAL transform as the base. That combination is a Godot quirk worth
    // knowing about rather than fixing: the brush is built in the path's global frame but
    // consumed as the polygon's local geometry, so a non-local sweep lands
    // doubly-transformed. Scenes in practice set path_local = true, which is why
    // nobody trips over it.
    const baseTransform = props.pathLocal
      ? null
      : matrixToTransform3D(globalMatrix3D(targetPath, nodeByPath));

    props.resolvedPath = { curvePoints, baseTransform };
  }

  return nodes;
}
