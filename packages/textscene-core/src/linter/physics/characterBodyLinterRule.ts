/**
 * Dimension-parameterized semantic linter rule for CharacterBody2D / CharacterBody3D.
 *
 * The two slices were ~85% identical; what remains dimension-specific is the
 * collision-shape family, one engine citation, and the GROUNDED-mode arm only
 * 2D carries. Format validation, and every per-property bound, stays in each
 * slice's linterParser.ts.
 */

import { ruleInt } from '../validators/commonValidators.js';
import type { LintRule, Diagnostic, RuleContext } from '../types.js';
import {
  hasCollisionShapeChild,
  collisionShapeTypesPhrase,
} from './hasCollisionShapeChild.js';
import { armEmits, reportArm, type RuleArm, type RuleArms } from '../ruleArms.js';
import type { PhysicsDim } from './dim.js';
import { dimSuffix } from './dim.js';

/** Stripped together by the FLOATING branch, and read only from the grounded path. */
const FLOOR_PROPERTIES = [
  'floor_stop_on_slope',
  'floor_constant_speed',
  'floor_block_on_wall',
  'floor_max_angle',
  'floor_snap_length',
];

export function makeCharacterBodyLinterRule(dim: PhysicsDim): LintRule {
  const type = `CharacterBody${dim}`;
  const prefix = `characterbody${dimSuffix(dim)}`;
  const is2D = dim === '2D';
  // `_validate_property` strips PROPERTY_USAGE_EDITOR from every `floor_` key,
  // from `up_direction` and from `slide_on_ceiling` while motion_mode is
  // FLOATING, so the inspector offers none of them there.
  const floatingCite = is2D ? 'character_body_2d.cpp:672' : 'character_body_3d.cpp:957';

  // Each arm's enabling condition, stated once (see `ruleArms.ts`).
  const arms: RuleArms<
    | 'needsCollisionShape'
    | 'floorPropsInFloating'
    | 'slideOnCeilingInFloating'
    | 'wallAngleInGrounded'
  > = {
    needsCollisionShape: {
      severity: 'warning',
      ruleName: `${prefix}-needs-collision-shape`,
      grounding: { kind: 'configuration-warning' },
    },
    floorPropsInFloating: {
      severity: 'warning',
      ruleName: `${prefix}-floor-props-in-floating-mode`,
      grounding: {
        kind: 'engine-inert',
        at: floatingCite,
        unused: 'floating mode strips every floor_ key from the property list',
      },
    },
    slideOnCeilingInFloating: {
      severity: 'warning',
      ruleName: `${prefix}-slide-on-ceiling-in-floating-mode`,
      grounding: {
        kind: 'engine-inert',
        at: floatingCite,
        unused: 'the same line strips it, and every read sits in _move_and_slide_grounded',
      },
    },
    // 2D only. `character_body_3d.cpp` has no `else` arm because its :300-303
    // reads `wall_min_slide_angle` in the grounded path too; the 2D twin's only
    // read is `character_body_2d.cpp:313`, inside `_move_and_slide_floating`.
    wallAngleInGrounded: is2D
      ? {
          severity: 'warning',
          ruleName: `${prefix}-wall-min-slide-angle-in-grounded-mode`,
          grounding: {
            kind: 'engine-inert',
            at: 'character_body_2d.cpp:676',
            unused: 'grounded mode strips it, and its only read sits in _move_and_slide_floating',
          },
        }
      : undefined,
  };

  function check(context: RuleContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const { node } = context;
    const report = (arm: RuleArm | undefined, message: string) =>
      reportArm(diagnostics, arm, node, message);

    const rawProps = node.properties as unknown as Record<string, string>;

    if (!hasCollisionShapeChild(node, dim)) {
      report(arms.needsCollisionShape, `${type} '${node.name}' has no ${collisionShapeTypesPhrase(dim)} children. Character bodies need collision shapes to function in physics.`);
    }

    // `floor_snap_length` gets no advisory: its hint (character_body_2d.cpp:749,
    // character_body_3d.cpp:934) ends in `or_greater`, so the high end is open,
    // and the low end coincides with the ERR_FAIL_COND(< 0) in the setter
    // (:631 / :831) that linterParser.ts already reports as an error.

    // `up_direction` gets no advisory: `set_up_direction` refuses only the zero
    // vector, which linterParser.ts reports as an error (:648 / :848), and
    // normalises everything else, so "standard is the screen-space or
    // world-space up vector" is a preference with nothing behind it. The
    // FLOATING branch strips it beside the keys below, but it is NOT inert —
    // `move_and_slide` reads it before either mode branch
    // (character_body_2d.cpp:106-107, character_body_3d.cpp:127-128).

    // `max_slides` gets no advisory: character_body_2d.cpp:741 /
    // character_body_3d.cpp:926 declare it PROPERTY_HINT_NONE with
    // PROPERTY_USAGE_NO_EDITOR, so no range is stated. The setter's
    // ERR_FAIL_COND(< 1) (:613 / :813) is an error in linterParser.ts.

    // `safe_margin` gets no advisory: each slice's linterParser.ts carries the
    // hint's 0.001..256 as a warning-tier bound on the validator.

    // `ruleInt` truncates the way the INT conversion does, so a float or
    // exponent literal in the enum slot resolves to the constant Godot stores;
    // `null` means unreadable, so the write never landed and neither branch is
    // this file's to claim.
    const motionMode = ruleInt(rawProps.motion_mode, 0);
    if (motionMode === 1) {
      const floorProperty = FLOOR_PROPERTIES.find((prop) => rawProps[prop] !== undefined);
      if (floorProperty !== undefined) {
        report(arms.floorPropsInFloating, `${type} '${node.name}' has motion_mode=FLOATING but '${floorProperty}' is set. Floor properties only work in GROUNDED mode (motion_mode=0).`);
      }
      if (rawProps.slide_on_ceiling !== undefined) {
        report(arms.slideOnCeilingInFloating, `${type} '${node.name}' has motion_mode=FLOATING but 'slide_on_ceiling' is set. It is read only in GROUNDED mode (motion_mode=0).`);
      }
    } else if (motionMode === 0 && rawProps.wall_min_slide_angle !== undefined) {
      report(arms.wallAngleInGrounded, `${type} '${node.name}' has motion_mode=GROUNDED but 'wall_min_slide_angle' is set. It is read only in FLOATING mode (motion_mode=1).`);
    }

    return diagnostics;
  }

  return {
    meta: {
      name: `valid-${prefix}`,
      description: `Validates ${type} collision shapes, motion mode settings, floor/wall properties, and physics configuration`,
      category: 'validation',
      applicableNodeTypes: [type],
      emits: armEmits(arms),
    },
    check,
  };
}
