/**
 * Semantic linter rules for AnimatedSprite3D.
 *
 * Format validation is handled by linterParser.ts, one property at a time.
 * This file holds only the checks a single `PropertyValidator` cannot express —
 * absence of a property, or a relationship between two properties on the same
 * node — so it stays intentionally small.
 *
 * An ABSENT `sprite_frames` is a warning: assigning one from a script at runtime
 * is valid Godot, so authoring-time absence is not itself a mistake. A present
 * but unresolvable one is the ADR-0032 error arm, and so is an `animation` named
 * with no SpriteFrames to hold it — Godot clears that name back to empty.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { checkResourceExists } from '../../../linter/resourceChecker.js';
import { DEFAULT_ANIMATION_NAME, literalText } from '../../../godot/index.js';

function checkAnimatedSprite3D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node, scene } = context;
  const rawProps = node.properties as unknown as Record<string, string>;

  if (!rawProps.sprite_frames) {
    diagnostics.push({
      severity: 'warning',
      message: `AnimatedSprite3D requires a 'sprite_frames' property. AnimatedSprite3D cannot play animations without a SpriteFrames resource.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'animatedsprite3d-requires-spriteframes',
    });
  } else if (!checkResourceExists(scene, rawProps.sprite_frames)) {
    diagnostics.push({
      severity: 'error',
      message: `SpriteFrames resource not found: ${rawProps.sprite_frames}`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'valid-animatedsprite3d-resources',
    });
  }

  // `sprite_frames` is declared ahead of `animation` (sprite_3d.cpp:1538-1539),
  // so a null SpriteFrames at this point is the authored absence, not load order.
  //
  // Not `"default"`, though: `set_animation` opens with
  // `if (animation == p_name) { return; }` (sprite_3d.cpp:1432-1434) and the field
  // already holds that name (sprite_3d.h:234), so the clearing branch this reports is
  // never reached and Godot loads the scene in silence.
  if (
    rawProps.animation &&
    literalText(rawProps.animation) !== DEFAULT_ANIMATION_NAME &&
    !rawProps.sprite_frames
  ) {
    diagnostics.push({
      severity: 'error',
      message: `Property 'animation' is set to "${rawProps.animation}" but 'sprite_frames' is not set. Godot clears 'animation' back to empty, so the authored name never applies.`,
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
      "Validates AnimatedSprite3D SpriteFrames references and animation names",
    category: 'validation',
    applicableNodeTypes: ['AnimatedSprite3D'],
    emits: [
      { ruleName: 'animatedsprite3d-requires-spriteframes', severity: 'warning', grounding: { kind: 'configuration-warning' } },
      {
        ruleName: 'valid-animatedsprite3d-resources',
        severity: 'error',
        grounding: {
          kind: 'no-engine-counterpart',
          scope: 'dangling-reference',
          because: 'the file declares no ExtResource or SubResource carrying that id',
        },
      },
      {
        ruleName: 'animatedsprite3d-animation-no-spriteframes',
        severity: 'error',
        grounding: { kind: 'engine', at: 'sprite_3d.cpp:1441' },
      },
    ],
  },
  check: checkAnimatedSprite3D,
};

ruleRegistry.register(animatedSprite3DValidationRule);

export { animatedSprite3DValidationRule };
