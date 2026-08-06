/**
 * Semantic linter rules for CollisionPolygon2D.
 *
 * Format validation is in linterParser.ts. This file mirrors
 * CollisionPolygon2D::get_configuration_warnings() (collision_polygon_2d.cpp:232-257)
 * exactly: every check below is one `warnings.push_back(RTR(...))` branch there,
 * so every diagnostic is a WARNING, never an error — Godot itself never refuses
 * to load or run any of these configurations.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { isValidProperties, findParentNode } from '../../../../linter/linterUtils.js';
import { descendsFrom } from '../../../../linter/nodeBaseTypes.js';

/** Matches the same wrapper `v.packedVector2Array` accepts; malformed values are that validator's job, not this rule's. */
const POLYGON_WRAPPER = /^\s*PackedVector2Array\s*\(([\s\S]*)\)\s*$/;

/**
 * Number of vertices `polygon` carries, mirroring `polygon.size()`
 * (collision_polygon_2d.cpp:239). Godot omits the property at its
 * `PackedVector2Array()` default, so an absent key means zero points, same as
 * an explicit empty array. Returns null for a value this rule cannot read —
 * `linterParser.ts`'s format validator owns reporting that.
 */
function polygonPointCount(raw: string | undefined): number | null {
  if (raw === undefined) return 0;
  const match = POLYGON_WRAPPER.exec(raw);
  if (!match) return null;
  const body = match[1]!.trim();
  if (body === '') return 0;
  const parts = body.split(',').filter((part) => part.trim().length > 0);
  // `_build_polygon` pairs consecutive components (collision_polygon_2d.cpp:65-71);
  // a trailing odd component is not a whole vertex.
  return Math.floor(parts.length / 2);
}

function checkCollisionPolygon2D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node, scene } = context;
  if (!isValidProperties(node.properties)) return diagnostics;

  const rawProps = node.properties as Record<string, string>;

  // collision_polygon_2d.cpp:235-237 — `!Object::cast_to<CollisionObject2D>(get_parent())`.
  const parent = findParentNode(scene.nodes, node);
  if (!parent) {
    diagnostics.push({
      severity: 'warning',
      message: `CollisionPolygon2D '${node.name}' has no parent node. CollisionPolygon2D only serves to provide a collision shape to a CollisionObject2D derived node. Please only use it as a child of Area2D, StaticBody2D, RigidBody2D, CharacterBody2D, etc. to give them a shape.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'collisionpolygon2d-no-parent',
    });
  } else if (!descendsFrom(parent.type, 'CollisionObject2D')) {
    diagnostics.push({
      severity: 'warning',
      message: `CollisionPolygon2D '${node.name}' has parent '${parent.name}' of type '${parent.type}', which is not a CollisionObject2D. CollisionPolygon2D only serves to provide a collision shape to a CollisionObject2D derived node. Please only use it as a child of Area2D, StaticBody2D, RigidBody2D, CharacterBody2D, etc. to give them a shape.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'collisionpolygon2d-invalid-parent',
    });
  }

  // collision_polygon_2d.cpp:239-250 — empty polygon, then a build-mode-dependent
  // minimum vertex count. The two are mutually exclusive branches in the source
  // (the count check is in the `else` of the emptiness check), so at most one
  // of these two diagnostics fires.
  const pointCount = polygonPointCount(rawProps.polygon);
  if (pointCount !== null) {
    if (pointCount === 0) {
      diagnostics.push({
        severity: 'warning',
        message: `CollisionPolygon2D '${node.name}' has an empty polygon, which has no effect on collision.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'collisionpolygon2d-empty-polygon',
      });
    } else {
      // build_mode default BUILD_SOLIDS = 0 (collision_polygon_2d.h:48); absent
      // key means the default, same as every other property this codebase omits
      // at default.
      const buildMode = rawProps.build_mode === undefined ? 0 : parseInt(rawProps.build_mode, 10);
      if (!Number.isNaN(buildMode)) {
        if (buildMode === 0 && pointCount < 3) {
          diagnostics.push({
            severity: 'warning',
            message: `CollisionPolygon2D '${node.name}' has an invalid polygon: at least 3 points are needed in 'Solids' build mode, got ${pointCount}.`,
            nodeName: node.name,
            nodeType: node.type,
            ruleName: 'collisionpolygon2d-insufficient-points',
          });
        } else if (buildMode !== 0 && pointCount < 2) {
          diagnostics.push({
            severity: 'warning',
            message: `CollisionPolygon2D '${node.name}' has an invalid polygon: at least 2 points are needed in 'Segments' build mode, got ${pointCount}.`,
            nodeName: node.name,
            nodeType: node.type,
            ruleName: 'collisionpolygon2d-insufficient-points',
          });
        }
      }
    }
  }

  // collision_polygon_2d.cpp:252-254 — `one_way_collision && Object::cast_to<Area2D>(get_parent())`.
  if (rawProps.one_way_collision === 'true' && parent && descendsFrom(parent.type, 'Area2D')) {
    diagnostics.push({
      severity: 'warning',
      message: `CollisionPolygon2D '${node.name}' has 'one_way_collision' set, but its parent '${parent.name}' is an Area2D. The One Way Collision property will be ignored when the collision object is an Area2D.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'collisionpolygon2d-one-way-ignored',
    });
  }

  return diagnostics;
}

const collisionPolygon2DValidationRule: LintRule = {
  meta: {
    name: 'valid-collisionpolygon2d',
    description:
      'Validates CollisionPolygon2D parent type, polygon vertex count against build mode, and one-way collision applicability',
    category: 'validation',
    applicableNodeTypes: ['CollisionPolygon2D'],
    emits: [
      { ruleName: 'collisionpolygon2d-no-parent', severity: 'warning' },
      { ruleName: 'collisionpolygon2d-invalid-parent', severity: 'warning' },
      { ruleName: 'collisionpolygon2d-empty-polygon', severity: 'warning' },
      { ruleName: 'collisionpolygon2d-insufficient-points', severity: 'warning' },
      { ruleName: 'collisionpolygon2d-one-way-ignored', severity: 'warning' },
    ],
  },
  check: checkCollisionPolygon2D,
};

ruleRegistry.register(collisionPolygon2DValidationRule);

export { collisionPolygon2DValidationRule };
