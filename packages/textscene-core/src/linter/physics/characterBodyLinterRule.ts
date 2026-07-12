/**
 * Dimension-parameterized semantic linter rule for CharacterBody2D / CharacterBody3D.
 *
 * The two slices were ~85% identical; the genuine dimension-specific seam is the
 * `up_direction` arity and standard value (2D screen-space `Vector2(0, -1)` vs 3D
 * world-space `Vector3(0, 1, 0)`). Format validation stays in each slice's
 * linterParser.ts.
 */

import type { LintRule, Diagnostic, RuleContext } from '../types.js';
import { hasCollisionShapeChild } from './hasCollisionShapeChild.js';
import { pushZeroCollisionLayerMaskWarnings } from './collisionLayerMask.js';
import { makeFloatTupleRegex } from '../validators/floatTupleValidator.js';
import type { PhysicsDim } from './dim.js';
import { dimSuffix } from './dim.js';

/** Minimum recommended floor_snap_length (below this, floor snapping may not work well) */
const MIN_RECOMMENDED_FLOOR_SNAP = 0.001;

/** Maximum recommended floor_snap_length (above this can cause glitchy behavior) */
const MAX_RECOMMENDED_FLOOR_SNAP = 10;

export function makeCharacterBodyLinterRule(dim: PhysicsDim): LintRule {
  const type = `CharacterBody${dim}`;
  const shapeType = `CollisionShape${dim}`;
  const prefix = `characterbody${dimSuffix(dim)}`;

  // up_direction seam: 2D is Vector2(0, -1) (screen space), 3D is Vector3(0, 1, 0).
  const upDirRegex = dim === '2D' ? makeFloatTupleRegex('Vector2', 2) : makeFloatTupleRegex('Vector3', 3);
  const upStandard = dim === '2D' ? 'Vector2(0, -1)' : 'Vector3(0, 1, 0)';

  function check(context: RuleContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const { node } = context;

    if (node.type !== type) {
      return diagnostics;
    }

    // Access raw properties from the node (Record<string, string>)
    const rawProps = node.properties as unknown as Record<string, string>;

    // Warning: CharacterBody without collision shape is useless
    if (!hasCollisionShapeChild(node, shapeType)) {
      diagnostics.push({
        severity: 'warning',
        message: `${type} '${node.name}' has no ${shapeType} children. Character bodies need collision shapes to function in physics.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: `${prefix}-needs-collision-shape`,
      });
    }

    // Warning: Extreme floor_snap_length values
    if (rawProps.floor_snap_length !== undefined) {
      const snapLength = parseFloat(rawProps.floor_snap_length);
      if (!isNaN(snapLength)) {
        if (snapLength > 0 && snapLength < MIN_RECOMMENDED_FLOOR_SNAP) {
          diagnostics.push({
            severity: 'warning',
            message: `${type} '${node.name}' has very small floor_snap_length (${snapLength}). Values below ${MIN_RECOMMENDED_FLOOR_SNAP} may not work reliably for floor snapping.`,
            nodeName: node.name,
            nodeType: node.type,
            ruleName: `${prefix}-floor-snap-too-small`,
          });
        }
        if (snapLength > MAX_RECOMMENDED_FLOOR_SNAP) {
          diagnostics.push({
            severity: 'warning',
            message: `${type} '${node.name}' has very large floor_snap_length (${snapLength}). Values above ${MAX_RECOMMENDED_FLOOR_SNAP} can cause glitchy behavior or unwanted floor attachment.`,
            nodeName: node.name,
            nodeType: node.type,
            ruleName: `${prefix}-floor-snap-too-large`,
          });
        }
      }
    }

    // Warning: Floor-specific properties set but motion_mode is FLOATING (1)
    const motionMode = rawProps.motion_mode !== undefined ? parseInt(rawProps.motion_mode, 10) : 0;
    if (motionMode === 1) {
      // FLOATING mode
      const floorProperties = [
        'floor_stop_on_slope',
        'floor_constant_speed',
        'floor_block_on_wall',
        'floor_max_angle',
        'floor_snap_length',
      ];

      for (const prop of floorProperties) {
        if (rawProps[prop] !== undefined) {
          diagnostics.push({
            severity: 'warning',
            message: `${type} '${node.name}' has motion_mode=FLOATING but '${prop}' is set. Floor properties only work in GROUNDED mode (motion_mode=0).`,
            nodeName: node.name,
            nodeType: node.type,
            ruleName: `${prefix}-floor-props-in-floating-mode`,
          });
          break; // Only warn once for all floor properties
        }
      }
    }

    pushZeroCollisionLayerMaskWarnings(diagnostics, node, rawProps, type, prefix);

    // Warning: Unusual up_direction (not the standard value for this dimension)
    if (rawProps.up_direction !== undefined) {
      const match = upDirRegex.exec(rawProps.up_direction);
      if (match) {
        const x = parseFloat(match[1] || '0');
        const y = parseFloat(match[2] || '0');
        const isStandard =
          dim === '2D' ? x === 0 && y === -1 : x === 0 && y === 1 && parseFloat(match[3] || '0') === 0;
        if (!isStandard) {
          diagnostics.push({
            severity: 'warning',
            message: `${type} '${node.name}' has non-standard up_direction: ${rawProps.up_direction}. Standard is ${upStandard}. Ensure this is intentional for your game's orientation.`,
            nodeName: node.name,
            nodeType: node.type,
            ruleName: `${prefix}-non-standard-up-direction`,
          });
        }
      }
    }

    // Warning: max_slides too low (may cause jittery movement)
    if (rawProps.max_slides !== undefined) {
      const maxSlides = parseInt(rawProps.max_slides, 10);
      if (!isNaN(maxSlides) && maxSlides > 0 && maxSlides < 4) {
        diagnostics.push({
          severity: 'warning',
          message: `${type} '${node.name}' has max_slides=${maxSlides}. Values below 4 may cause jittery movement on complex geometry. Recommended: 4-6.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: `${prefix}-max-slides-too-low`,
        });
      }
    }

    // Warning: Very large safe_margin can cause tunneling or unwanted collisions
    if (rawProps.safe_margin !== undefined) {
      const safeMargin = parseFloat(rawProps.safe_margin);
      if (!isNaN(safeMargin) && safeMargin > 0.1) {
        diagnostics.push({
          severity: 'warning',
          message: `${type} '${node.name}' has large safe_margin (${safeMargin}). Values above 0.1 may cause collision detection issues. Typical range: 0.001-0.1.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: `${prefix}-safe-margin-too-large`,
        });
      }
    }

    return diagnostics;
  }

  return {
    meta: {
      name: `valid-${prefix}`,
      description: `Validates ${type} collision shapes, motion mode settings, floor/wall properties, and physics configuration`,
      category: 'validation',
      applicableNodeTypes: [type],
    },
    check,
  };
}
