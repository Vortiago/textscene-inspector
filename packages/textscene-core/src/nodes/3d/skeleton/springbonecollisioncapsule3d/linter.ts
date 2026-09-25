/**
 * Semantic linter rule for SpringBoneCollisionCapsule3D: the invariant `radius <= height * 0.5`,
 * which each setter restores by rewriting the other property
 * (`scene/3d/spring_bone_collision_capsule_3d.cpp`). set_radius (:36-38) sets
 * `height = radius * 2.0`, and set_height (:50-52) sets `radius = height * 0.5`.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../../linter/linterUtils.js';
import { parseGodotFloat } from '../../../../linter/validators/commonValidators.js';

function checkSpringBoneCollisionCapsule3D(context: RuleContext): Diagnostic[] {
  const { node } = context;
  if (!isValidProperties(node.properties)) return [];
  const props = node.properties as Record<string, string>;

  const rawRadius = props.radius;
  const rawHeight = props.height;
  // Both keys must be present. With one written, the setter moves the other away from its default
  // and the written value survives: `radius = 4.0` alone loads as radius 4.0 and height 8.0.
  if (rawRadius === undefined || rawHeight === undefined) return [];

  // `parseGodotFloat`, not `parseFloat`: `inf` is a real point on the number
  // line here rather than an unreadable property, and `nan` reads as NaN and
  // trips nothing, since every comparison against it is false.
  const radius = parseGodotFloat(rawRadius);
  const height = parseGodotFloat(rawHeight);
  if (radius === null || height === null) return [];
  // The error tier (ADR-0032): a setter alters an authored value, even though not its own. File
  // order decides which half moves, so the message names neither. No hint can express it: both
  // carry `,or_greater`, so `radius = 4.0, height = 1.0` breaks neither bound.
  if (!(radius > height * 0.5)) return [];

  return [
    {
      severity: 'error',
      // The literals as written, not the parsed numbers, so `inf` reads as `inf`.
      message: `SpringBoneCollisionCapsule3D '${node.name}' sets radius ${rawRadius.trim()} on height ${rawHeight.trim()}. Godot keeps a capsule's radius at or below half its height, so loading this scene rewrites one of the two and the shape will not be the one written.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'springbonecollisioncapsule3d-radius-exceeds-half-height',
    },
  ];
}

const springBoneCollisionCapsule3DShapeRule: LintRule = {
  meta: {
    name: 'valid-springbonecollisioncapsule3d-shape',
    description:
      "Reports a SpringBoneCollisionCapsule3D whose radius exceeds half its height, since Godot silently rewrites one of the two on load",
    category: 'validation',
    applicableNodeTypes: ['SpringBoneCollisionCapsule3D'],
    emits: [
      {
        ruleName: 'springbonecollisioncapsule3d-radius-exceeds-half-height',
        severity: 'error',
        grounding: { kind: 'engine', at: 'spring_bone_collision_capsule_3d.cpp:38' },
      },
    ],
  },
  check: checkSpringBoneCollisionCapsule3D,
};

ruleRegistry.register(springBoneCollisionCapsule3DShapeRule);

export { springBoneCollisionCapsule3DShapeRule };
