/**
 * Dimension-parameterized semantic linter rule for CharacterBody2D / CharacterBody3D.
 *
 * The two slices were ~85% identical; what remains dimension-specific is the
 * collision-shape family and one engine citation. Format validation, and every
 * per-property bound, stays in each slice's linterParser.ts.
 */

import { ruleInt } from '../validators/commonValidators.js';
import type { LintRule, Diagnostic, RuleContext } from '../types.js';
import {
  hasCollisionShapeChild,
  collisionShapeTypesPhrase,
} from './hasCollisionShapeChild.js';
import type { PhysicsDim } from './dim.js';
import { dimSuffix } from './dim.js';

export function makeCharacterBodyLinterRule(dim: PhysicsDim): LintRule {
  const type = `CharacterBody${dim}`;
  const prefix = `characterbody${dimSuffix(dim)}`;
  // `_validate_property` strips PROPERTY_USAGE_EDITOR from every `floor_` key
  // while motion_mode is FLOATING, so the inspector offers none of them there.
  const floorPropsCite = dim === '2D' ? 'character_body_2d.cpp:672' : 'character_body_3d.cpp:957';

  function check(context: RuleContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const { node } = context;


    // Access raw properties from the node (Record<string, string>)
    const rawProps = node.properties as unknown as Record<string, string>;

    // Warning: CharacterBody without collision shape is useless
    if (!hasCollisionShapeChild(node, dim)) {
      diagnostics.push({
        severity: 'warning',
        message: `${type} '${node.name}' has no ${collisionShapeTypesPhrase(dim)} children. Character bodies need collision shapes to function in physics.`,
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
    // `ruleInt` truncates the way the INT conversion does, so a float or
    // exponent literal in the enum slot resolves to the constant Godot stores.
    const motionMode =
      ruleInt(rawProps.motion_mode, 0);
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

    // `up_direction` gets no advisory: `set_up_direction` refuses only the zero
    // vector and normalises everything else, and the property carries no hint,
    // so "standard is the screen-space or world-space up vector" is a preference
    // with nothing behind it.

    // `max_slides` gets no advisory: character_body_2d.cpp:741 /
    // character_body_3d.cpp:926 declare it PROPERTY_HINT_NONE with
    // PROPERTY_USAGE_NO_EDITOR, so no range is stated. The setter's
    // ERR_FAIL_COND(< 1) (:613 / :813) is an error in linterParser.ts.

    // `safe_margin` gets no advisory: each slice's linterParser.ts carries the
    // hint's 0.001..256 as a warning-tier bound on the validator.

    return diagnostics;
  }

  return {
    meta: {
      name: `valid-${prefix}`,
      description: `Validates ${type} collision shapes, motion mode settings, floor/wall properties, and physics configuration`,
      category: 'validation',
      applicableNodeTypes: [type],
      emits: [
        {
          ruleName: `${prefix}-needs-collision-shape`,
          severity: 'warning',
          grounding: { kind: 'configuration-warning' },
        },
        {
          ruleName: `${prefix}-floor-props-in-floating-mode`,
          severity: 'warning',
          grounding: {
            kind: 'engine-inert',
            at: floorPropsCite,
            unused: 'floating mode strips every floor_ key from the property list',
          },
        },
      ],
    },
    check,
  };
}
