/**
 * Describes what a CSG root's boolean result is made of, without evaluating anything.
 *
 * Pure and React-free so the semantics can be tested without a renderer and without
 * loading the CSG library at all. `evaluateCsgPlan` turns a plan into geometry.
 *
 * Godot's rules, reproduced (`modules/csg/csg_shape.cpp`):
 *   - a CSG ROOT is a CSG node whose DIRECT parent is not one (`is_root_shape()`), and
 *     only the root draws;
 *   - contributions fold bottom-up in child order, each applying its own `operation`;
 *   - a CSGCombiner3D has no solid of its own: its subtree folds to one contribution,
 *     which then combines into ITS parent by its own operation;
 *   - invisible children are skipped entirely (`!child->is_visible()`);
 *   - a root's own `operation` is inert, since it has nothing to combine into.
 *
 * Descending ONLY into CSG-typed children is what makes root detection correct without a
 * flag: `CSGBox3D > Node3D > CSGSphere3D` leaves the sphere its own root, exactly as
 * Godot's `parent_shape` (set only for a direct CSG parent) does. A boolean
 * "inside a CSG subtree" flag would get that wrong and would need every non-CSG
 * component to reset it.
 */

import * as THREE from 'three';
import type { TscnNode } from '../../parser/types';
import type { Node3DProperties } from '../../nodes/base/node3d/types';
import { joinPath } from '../../utils/nodePath';
import { localMatrix3D } from '../nodeTreeTransforms';

/** Godot `CSGShape3D.Operation`. */
export const CsgOperation = { UNION: 0, INTERSECTION: 1, SUBTRACTION: 2 } as const;

export interface CsgContribution {
  /** Full node path, so the renderer can prune exactly these nodes. */
  path: string;
  type: string;
  /** How this folds into the accumulator. Inert on the root. */
  operation: number;
  /** Baked into CSG-ROOT-LOCAL space. */
  matrix: THREE.Matrix4;
  /** Index into `CsgPlan.surfaces`. */
  surface: number;
  /** The node, so the evaluator can call its registered geometry builder. */
  node: TscnNode;
}

export interface CsgPlan {
  rootPath: string;
  contributions: CsgContribution[];
  /**
   * Distinct material paths in first-seen order, with `undefined` for "no material".
   * Godot interns materials per root the same way and emits one surface each.
   */
  surfaces: (string | undefined)[];
  /** Node paths the root absorbs, so those components render no mesh of their own. */
  absorbedPaths: Set<string>;
  /**
   * CSG paths skipped for invisibility, and their CSG descendants. `_get_brush()` never
   * reaches them (`modules/csg/csg_shape.cpp:469`), so their `node_aabb` is never written
   * and Godot frames a POINT at each origin rather than its solid.
   */
  invisiblePaths: Set<string>;
  /** Stable over everything the evaluation depends on. */
  cacheKey: string;
}

/** What the plan needs to know about one CSG type. */
export interface CsgPlanShape {
  /** False for a grouping node like CSGCombiner3D, which has no solid of its own. */
  hasGeometry: boolean;
  /** Stable string over the properties the geometry builder reads. */
  key: (node: TscnNode) => string;
}

interface BuildOptions {
  /** Paths hidden via the scene-tree eye toggle; treated exactly like `visible = false`. */
  hiddenPaths?: ReadonlySet<string>;
  /**
   * The one thing the plan asks about a node type; null means "not a CSG shape". Injected
   * as a single lookup so the builder stays testable without the r3f registry, and so a
   * caller cannot answer the three questions inconsistently.
   */
  lookup: (type: string) => CsgPlanShape | null;
}

function isVisible(node: TscnNode, path: string, hidden?: ReadonlySet<string>): boolean {
  if ((node.properties as Node3DProperties).visible === false) return false;
  return !hidden?.has(path);
}

/**
 * The CSG children of `node`, with their paths. Descending ONLY into CSG-typed children is
 * the rule the header explains, so both walks below read it from here.
 */
function csgChildren(
  node: TscnNode,
  path: string,
  lookup: BuildOptions['lookup']
): [TscnNode, string][] {
  const out: [TscnNode, string][] = [];
  for (const child of node.children) {
    if (lookup(child.type) !== null) out.push([child, joinPath(path, child.name)]);
  }
  return out;
}

/** NaN or Infinity anywhere in a matrix would propagate into the BVH builder. */
function isFinite4(m: THREE.Matrix4): boolean {
  return m.elements.every((n) => Number.isFinite(n));
}

/**
 * Build the plan for the CSG root at `rootPath`.
 *
 * Returns null when the node is not a CSG shape at all. A root with no usable
 * contributions still returns a plan, with an empty `contributions` list: "this root
 * legitimately draws nothing" is a different answer from "this is not a CSG root".
 */
export function buildCsgPlan(
  root: TscnNode,
  rootPath: string,
  options: BuildOptions
): CsgPlan | null {
  const { lookup, hiddenPaths } = options;
  if (lookup(root.type) === null) return null;

  const contributions: CsgContribution[] = [];
  const surfaces: (string | undefined)[] = [];
  const absorbedPaths = new Set<string>();
  const invisiblePaths = new Set<string>();

  /** The skipped node and every CSG node under it — the recursion stopped at all of them. */
  const markInvisible = (node: TscnNode, path: string): void => {
    invisiblePaths.add(path);
    for (const [child, childPath] of csgChildren(node, path, lookup)) markInvisible(child, childPath);
  };
  const keyParts: string[] = [`root:${root.type}`];

  const surfaceIndex = (materialPath: string | undefined): number => {
    const existing = surfaces.indexOf(materialPath);
    if (existing !== -1) return existing;
    surfaces.push(materialPath);
    return surfaces.length - 1;
  };

  const visit = (node: TscnNode, path: string, parentMatrix: THREE.Matrix4, isRoot: boolean): void => {
    // A ROOT builds whatever its own visibility — update_shape() is gated on
    // is_root_shape() alone (csg_shape.cpp:568-570) — so only a CHILD stops the walk, and
    // an invisible root's subtree resolves exactly as a visible one's does.
    if (!isRoot && !isVisible(node, path, hiddenPaths)) {
      markInvisible(node, path);
      return;
    }

    // The root's own transform is NOT baked in: the result mesh is mounted inside the
    // root's own transform group, so including it here would apply it twice.
    const matrix = isRoot ? new THREE.Matrix4() : parentMatrix.clone().multiply(localMatrix3D(node));

    if (!isRoot) absorbedPaths.add(path);

    const shape = lookup(node.type);
    if (shape?.hasGeometry) {
      if (!isFinite4(matrix)) {
        keyParts.push(`${path}:nonfinite`);
      } else {
        const props = node.properties as Record<string, unknown>;
        const materialPath = typeof props.materialPath === 'string' ? props.materialPath : undefined;
        // A root's operation is inert; Godot has nothing to fold it into.
        const operation = isRoot
          ? CsgOperation.UNION
          : typeof props.operation === 'number'
            ? props.operation
            : CsgOperation.UNION;

        contributions.push({
          path,
          type: node.type,
          operation,
          matrix,
          surface: surfaceIndex(materialPath),
          node,
        });
        keyParts.push(
          `${path}|${node.type}|${operation}|${shape.key(node)}|${materialPath ?? ''}|` +
            matrix.elements.map((n) => n.toFixed(6)).join(',')
        );
      }
    }

    for (const [child, childPath] of csgChildren(node, path, lookup)) {
      visit(child, childPath, matrix, false);
    }
  };

  visit(root, rootPath, new THREE.Matrix4(), true);

  return {
    rootPath,
    contributions,
    surfaces,
    absorbedPaths,
    invisiblePaths,
    cacheKey: keyParts.join('\n'),
  };
}

