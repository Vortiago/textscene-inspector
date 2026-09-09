/**
 * Semantic linter rule for SpringBoneCollisionCapsule3D: the capsule invariant
 * `radius <= height * 0.5`, which each setter restores by rewriting the OTHER
 * property (`scene/3d/spring_bone_collision_capsule_3d.cpp`):
 *
 *     void set_radius(float p_radius) {
 *         radius = p_radius;                          // :36
 *         if (radius > height * 0.5) { height = radius * 2.0; }   // :37-38
 *     }
 *     void set_height(float p_height) {
 *         height = p_height;                          // :50
 *         if (radius > height * 0.5) { radius = height * 0.5; }   // :51-52
 *     }
 *
 * Why this is the ERROR tier. ADR-0032's error row is "the setter refuses or
 * alters the value: an `ERR_FAIL*`, or a clamp/mask that silently changes what
 * was written" — it says nothing about the altered value having to be the
 * setter's own property, and `height = radius * 2.0` silently changes an
 * authored `height`. Which half of the pair moves depends on which setter runs
 * last, i.e. on the order the two keys appear in the file, so the message names
 * neither; but one of the two authored numbers is always discarded. No hint can
 * express it either — both `radius` and `height` carry `,or_greater`, so a
 * scene like `radius = 4.0, height = 1.0` violates neither bound.
 *
 * BOTH keys must be present. With only one written, the setter moves the other
 * away from its constructor default and the written value survives intact, so
 * there is nothing to report: `radius = 4.0` alone loads as radius 4.0 (height
 * follows to 8.0), and `height = 0.02` alone loads as height 0.02.
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
  if (rawRadius === undefined || rawHeight === undefined) return [];

  // `parseGodotFloat`, not `parseFloat`: `inf` is a real point on the number
  // line here rather than an unreadable property, and `nan` reads as NaN and
  // trips nothing, since every comparison against it is false.
  const radius = parseGodotFloat(rawRadius);
  const height = parseGodotFloat(rawHeight);
  if (radius === null || height === null) return [];
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
