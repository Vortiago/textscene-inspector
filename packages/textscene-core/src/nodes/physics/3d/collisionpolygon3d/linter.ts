/**
 * Semantic linter rule for CollisionPolygon3D.
 *
 * Format validation is in linterParser.ts. This covers the CONTEXTUAL
 * configuration warnings collision_polygon_3d.cpp's get_configuration_warnings()
 * (:235-252) emits: none of them refuses a load (Godot only shows the
 * editor's warning icon), so every one here is a WARNING.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { isValidProperties, findParentNode } from '../../../../linter/linterUtils.js';
import { descendsFrom } from '../../../../linter/nodeBaseTypes.js';
import { parseTransform3D } from '../../../../utils/transform.js';
import { isZeroApprox } from '../../../../godot/math.js';

const TYPE = 'CollisionPolygon3D';
const COLLISION_OBJECT = 'CollisionObject3D';
const ADVICE =
  `${TYPE} only serves to provide a collision shape to a ${COLLISION_OBJECT} derived node. ` +
  'Please only use it as a child of Area3D, StaticBody3D, RigidBody3D, CharacterBody3D, etc. to give them a shape.';

/**
 * The literal wrapper, compiled once. A regex literal inside the function below
 * would be rebuilt on every node this rule visits; the 2D sibling hoists the
 * identical pattern for the same reason. No `g` flag, so the shared instance is
 * stateless under `.exec`.
 */
const POLYGON_WRAPPER = /^\s*PackedVector2Array\s*\(([\s\S]*)\)\s*$/;

/**
 * True for a `PackedVector2Array(...)` with zero vertices, or an absent key —
 * collision_polygon_3d.cpp:242-244, `polygon.is_empty()`. Godot's own default is
 * an empty `PackedVector2Array()` (doc/classes/CollisionPolygon3D.xml), so an
 * absent key means the same empty polygon as an explicit one.
 */
function polygonIsEmpty(raw: string | undefined): boolean {
  if (raw === undefined) return true;
  const match = POLYGON_WRAPPER.exec(raw);
  if (!match) return false; // malformed literal is linterParser.ts's job, not this rule's
  return match[1]!.trim() === '';
}

/**
 * Unsigned basis-COLUMN magnitudes of a `Transform3D(...)` literal, or null when
 * it does not parse — collision_polygon_3d.cpp:246, `get_transform().get_basis()`.
 * `parseTransform3D` returns Godot's Basis ROWS (utils/transform.ts docblock), so
 * column `i` is the `i`-th component picked from each of the three rows.
 */
function basisColumnScales(raw: string): [number, number, number] | null {
  try {
    const { basis_x, basis_y, basis_z } = parseTransform3D(raw);
    return [
      Math.hypot(basis_x.x, basis_y.x, basis_z.x),
      Math.hypot(basis_x.y, basis_y.y, basis_z.y),
      Math.hypot(basis_x.z, basis_y.z, basis_z.z),
    ];
  } catch {
    return null; // malformed literal is linterParser.ts's job, not this rule's
  }
}

function check(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node, scene } = context;
  if (!isValidProperties(node.properties)) return diagnostics;
  const rawProps = node.properties;

  // collision_polygon_3d.cpp:238-240 — Object::cast_to<CollisionObject3D>(get_parent())
  const parent = findParentNode(scene.nodes, node);
  if (!parent) {
    diagnostics.push({
      severity: 'warning',
      message: `${TYPE} '${node.name}' has no parent node. ${ADVICE}`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'collisionpolygon3d-no-parent',
    });
  } else if (!descendsFrom(parent.type, COLLISION_OBJECT)) {
    diagnostics.push({
      severity: 'warning',
      message: `${TYPE} '${node.name}' has parent '${parent.name}' of type '${parent.type}', which is not a ${COLLISION_OBJECT}. ${ADVICE}`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'collisionpolygon3d-invalid-parent',
    });
  }

  // collision_polygon_3d.cpp:242-244
  if (polygonIsEmpty(rawProps.polygon)) {
    diagnostics.push({
      severity: 'warning',
      message: `${TYPE} '${node.name}' has an empty polygon. An empty CollisionPolygon3D has no effect on collision.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'collisionpolygon3d-empty-polygon',
    });
  }

  // collision_polygon_3d.cpp:246-249
  if (rawProps.transform !== undefined) {
    const scales = basisColumnScales(rawProps.transform);
    if (scales) {
      const [sx, sy, sz] = scales;
      if (!(isZeroApprox(sx - sy) && isZeroApprox(sy - sz))) {
        diagnostics.push({
          severity: 'warning',
          message:
            `${TYPE} '${node.name}' has a non-uniformly scaled transform ` +
            `(${sx.toFixed(3)}, ${sy.toFixed(3)}, ${sz.toFixed(3)}), which will probably not ` +
            "function as expected. Keep its scale uniform and adjust the polygon's vertices instead.",
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'collisionpolygon3d-non-uniform-scale',
        });
      }
    }
  }

  return diagnostics;
}

const collisionPolygon3DValidationRule: LintRule = {
  meta: {
    name: 'valid-collisionpolygon3d',
    description:
      'Validates CollisionPolygon3D parent node type, polygon emptiness, and transform scale uniformity',
    category: 'validation',
    applicableNodeTypes: [TYPE],
    emits: [
      { ruleName: 'collisionpolygon3d-no-parent', severity: 'warning' },
      { ruleName: 'collisionpolygon3d-invalid-parent', severity: 'warning' },
      { ruleName: 'collisionpolygon3d-empty-polygon', severity: 'warning' },
      { ruleName: 'collisionpolygon3d-non-uniform-scale', severity: 'warning' },
    ],
  },
  check,
};

ruleRegistry.register(collisionPolygon3DValidationRule);

export { collisionPolygon3DValidationRule };
