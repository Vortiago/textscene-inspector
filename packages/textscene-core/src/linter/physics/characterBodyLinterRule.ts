/**
 * Dimension-parameterized semantic linter rule for CharacterBody2D / CharacterBody3D.
 *
 * The two slices were ~85% identical; the genuine dimension-specific seam is the
 * `up_direction` arity and standard value (2D screen-space `Vector2(0, -1)` vs 3D
 * world-space `Vector3(0, 1, 0)`). Format validation stays in each slice's
 * linterParser.ts.
 */

import type { LintRule, Diagnostic, RuleContext } from '../types.js';
import { hasDescendantOfType } from './hasDescendantOfType.js';
import { pushZeroCollisionLayerMaskWarnings } from './collisionLayerMask.js';
import { makeFloatTupleRegex } from '../validators/floatTupleValidator.js';
import type { PhysicsDim } from './dim.js';
import { dimSuffix } from './dim.js';
import { rangeAdvisories } from '../rangeAdvisory.js';

/**
 * `safe_margin` hint, character_body_2d.cpp:757 / character_body_3d.cpp:942 —
 * PROPERTY_HINT_RANGE "0.001,256,0.001". Neither end carries `or_greater` /
 * `or_less`, and both setters (:537 / :636) are bare assignments, so the two
 * ends are advisory bounds rather than enforced ones.
 */
const SAFE_MARGIN_HINT_MIN = 0.001;
const SAFE_MARGIN_HINT_MAX = 256;

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


    // Access raw properties from the node (Record<string, string>)
    const rawProps = node.properties as unknown as Record<string, string>;

    // Warning: CharacterBody without collision shape is useless
    if (!hasDescendantOfType(node, shapeType)) {
      diagnostics.push({
        severity: 'warning',
        message: `${type} '${node.name}' has no ${shapeType} children. Character bodies need collision shapes to function in physics.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: `${prefix}-needs-collision-shape`,
      });
    }

    // `floor_snap_length` gets no advisory: its hint (character_body_2d.cpp:749,
    // character_body_3d.cpp:934) ends in `or_greater`, so the high end is open,
    // and the low end coincides with the ERR_FAIL_COND(< 0) in the setter
    // (:631 / :831) that linterParser.ts already reports as an error.

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

    // `max_slides` gets no advisory: character_body_2d.cpp:741 /
    // character_body_3d.cpp:926 declare it PROPERTY_HINT_NONE with
    // PROPERTY_USAGE_NO_EDITOR, so no range is stated. The setter's
    // ERR_FAIL_COND(< 1) (:613 / :813) is an error in linterParser.ts.

    // Warnings: safe_margin outside the range the inspector offers.
    diagnostics.push(
      ...rangeAdvisories(node, {
        safe_margin: [
          {
            under: SAFE_MARGIN_HINT_MIN,
            ruleName: `${prefix}-safe-margin-too-small`,
            message: (safeMargin) =>
              `${type} '${node.name}' has safe_margin ${safeMargin}. The editor range starts at ${SAFE_MARGIN_HINT_MIN}.`,
          },
          {
            over: SAFE_MARGIN_HINT_MAX,
            ruleName: `${prefix}-safe-margin-too-large`,
            message: (safeMargin) =>
              `${type} '${node.name}' has safe_margin ${safeMargin}. The editor range stops at ${SAFE_MARGIN_HINT_MAX}.`,
          },
        ],
      })
    );

    return diagnostics;
  }

  return {
    meta: {
      name: `valid-${prefix}`,
      description: `Validates ${type} collision shapes, motion mode settings, floor/wall properties, and physics configuration`,
      category: 'validation',
      applicableNodeTypes: [type],
      emits: [
        { ruleName: `${prefix}-needs-collision-shape`, severity: 'warning' },
        { ruleName: `${prefix}-floor-props-in-floating-mode`, severity: 'warning' },
        { ruleName: `${prefix}-zero-collision-layer`, severity: 'warning' },
        { ruleName: `${prefix}-zero-collision-mask`, severity: 'warning' },
        { ruleName: `${prefix}-non-standard-up-direction`, severity: 'warning' },
        { ruleName: `${prefix}-safe-margin-too-small`, severity: 'warning' },
        { ruleName: `${prefix}-safe-margin-too-large`, severity: 'warning' },
      ],
    },
    check,
  };
}
