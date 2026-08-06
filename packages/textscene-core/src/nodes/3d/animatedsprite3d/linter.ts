/**
 * Semantic linter rules for AnimatedSprite3D.
 *
 * Format validation is handled by linterParser.ts, one property at a time.
 * This file holds only the checks a single `PropertyValidator` cannot express —
 * absence of a property, or a relationship between two properties on the same
 * node — so it stays intentionally small.
 *
 * All warnings, per the settled severity policy (missing-resource advisories,
 * `-spriteframes` named explicitly among them, are warnings, not errors: the
 * runtime-assignment-via-script idiom is valid Godot, so absence at authoring
 * time is not itself a mistake). A dangling `sprite_frames` reference (present
 * but unresolvable) would be the ADR-0032 "error" arm, matching
 * AnimatedSprite2D's `valid-animatedsprite2d-resources` rule — out of scope
 * here; see the task report.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';

function checkAnimatedSprite3D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node } = context;
  const rawProps = node.properties as unknown as Record<string, string>;

  if (!rawProps.sprite_frames) {
    diagnostics.push({
      severity: 'warning',
      message: `AnimatedSprite3D requires a 'sprite_frames' property. AnimatedSprite3D cannot play animations without a SpriteFrames resource.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'animatedsprite3d-requires-spriteframes',
    });
  }

  if (rawProps.autoplay && !rawProps.sprite_frames) {
    diagnostics.push({
      severity: 'warning',
      message: `Property 'autoplay' is set to "${rawProps.autoplay}" but 'sprite_frames' is not set. Autoplay will not work without a SpriteFrames resource.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'animatedsprite3d-autoplay-no-spriteframes',
    });
  }

  if (rawProps.animation && !rawProps.sprite_frames) {
    diagnostics.push({
      severity: 'warning',
      message: `Property 'animation' is set to "${rawProps.animation}" but 'sprite_frames' is not set. Animation cannot play without a SpriteFrames resource.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'animatedsprite3d-animation-no-spriteframes',
    });
  }

  return diagnostics;
}

const animatedSprite3DValidationRule: LintRule = {
  meta: {
    name: 'valid-animatedsprite3d-properties',
    description:
      "Warns when AnimatedSprite3D has no SpriteFrames, or sets animation/autoplay without one",
    category: 'validation',
    applicableNodeTypes: ['AnimatedSprite3D'],
    emits: [
      { ruleName: 'animatedsprite3d-requires-spriteframes', severity: 'warning' },
      { ruleName: 'animatedsprite3d-autoplay-no-spriteframes', severity: 'warning' },
      { ruleName: 'animatedsprite3d-animation-no-spriteframes', severity: 'warning' },
    ],
  },
  check: checkAnimatedSprite3D,
};

ruleRegistry.register(animatedSprite3DValidationRule);

export { animatedSprite3DValidationRule };
