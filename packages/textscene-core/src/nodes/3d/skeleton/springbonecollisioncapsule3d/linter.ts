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
 * Why this is a WARNING and not the error tier. ADR-0032's error row is about a
 * setter refusing or altering the value written to ITS OWN property, and neither
 * of these does: `radius = p_radius` and `height = p_height` both assign
 * straight through. The alteration is cross-field, and which of the pair ends up
 * rewritten depends on which setter runs last, i.e. on the order the two keys
 * happen to appear in the file, a property of the text, not of any setter's
 * enforcement. The scene loads either way, so this reports that the pair as
 * written is not the pair that will exist, and says nothing about which half
 * moves.
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
      severity: 'warning',
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
      "Warns when a SpringBoneCollisionCapsule3D's radius exceeds half its height, which Godot resolves by rewriting one of the two on load",
    category: 'validation',
    applicableNodeTypes: ['SpringBoneCollisionCapsule3D'],
    emits: [
      {
        ruleName: 'springbonecollisioncapsule3d-radius-exceeds-half-height',
        severity: 'warning',
        grounding: { kind: 'engine', at: 'spring_bone_collision_capsule_3d.cpp:38' },
      },
    ],
  },
  check: checkSpringBoneCollisionCapsule3D,
};

ruleRegistry.register(springBoneCollisionCapsule3DShapeRule);

export { springBoneCollisionCapsule3DShapeRule };
