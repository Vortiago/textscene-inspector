/**
 * Semantic linter rules for AnimatedSprite2D
 *
 * Format validation is handled by linterParser.ts during strict parsing.
 * This file focuses on semantic validation requiring full scene context.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { checkResourceExists, heldResource, resourceSlotIsEmpty } from '../../../linter/resourceChecker.js';
import { DEFAULT_ANIMATION_NAME, literalText } from '../../../godot/index.js';

/**
 * Validate AnimatedSprite2D semantic rules (resource references, animation properties, etc.)
 */
function checkAnimatedSprite2D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node, scene } = context;


  // Access raw properties from the node (Record<string, string>)
  const rawProps = node.properties as unknown as Record<string, string>;

  // Check if sprite_frames resource exists (REQUIRED - AnimatedSprite2D is useless without SpriteFrames)
  const spriteFrames = heldResource(rawProps.sprite_frames);
  if (spriteFrames === undefined) {
    diagnostics.push({
      severity: 'warning',
      message: `AnimatedSprite2D requires a 'sprite_frames' property. AnimatedSprite2D cannot play animations without a SpriteFrames resource.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'animatedsprite2d-requires-spriteframes',
    });
  } else {
    // sprite_frames is specified - check if it exists
    const resourceExists = checkResourceExists(scene, spriteFrames);
    if (!resourceExists) {
      diagnostics.push({
        severity: 'error',
        message: `SpriteFrames resource not found: ${rawProps.sprite_frames}`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'valid-animatedsprite2d-resources',
      });
    }
  }

  // `sprite_frames` is declared ahead of `animation` (animated_sprite_2d.cpp:671-672),
  // so a null SpriteFrames at this point is the authored absence, not load order.
  //
  // Not `"default"`, though: `set_animation` opens with
  // `if (animation == p_name) { return; }` (animated_sprite_2d.cpp:554-556) and the
  // field already holds that name (animated_sprite_2d.h:43), so the clearing branch
  // this reports is never reached and Godot loads the scene in silence.
  if (
    rawProps.animation &&
    literalText(rawProps.animation) !== DEFAULT_ANIMATION_NAME &&
    resourceSlotIsEmpty(rawProps.sprite_frames)
  ) {
    diagnostics.push({
      severity: 'error',
      message: `Property 'animation' is set to "${literalText(rawProps.animation)}" but 'sprite_frames' is not set. Godot clears 'animation' back to empty, so the authored name never applies.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'animatedsprite2d-animation-no-spriteframes',
    });
  }

  // `speed_scale` and `frame_progress` get no diagnostic: both are
  // PROPERTY_HINT_NONE behind a bare setter, so no value is out of range (0
  // speed_scale is a legal paused state, and frame_progress is not clamped).
  // `playing` gets none either: AnimatedSprite2D declares no such property.

  return diagnostics;
}

/**
 * AnimatedSprite2D semantic validation rule
 */
const animatedSprite2DValidationRule: LintRule = {
  meta: {
    name: 'valid-animatedsprite2d-resources',
    description: 'Validates AnimatedSprite2D sprite_frames resources and animation references',
    category: 'validation',
    applicableNodeTypes: ['AnimatedSprite2D'],
    emits: [
      { ruleName: 'animatedsprite2d-requires-spriteframes', severity: 'warning', grounding: { kind: 'configuration-warning' } },
      {
        ruleName: 'valid-animatedsprite2d-resources',
        severity: 'error',
        grounding: {
          kind: 'no-engine-counterpart',
          scope: 'dangling-reference',
          because: 'the file declares no ExtResource or SubResource carrying that id',
        },
      },
      {
        ruleName: 'animatedsprite2d-animation-no-spriteframes',
        severity: 'error',
        grounding: { kind: 'engine', at: 'animated_sprite_2d.cpp:563' },
      },
    ],
  },
  check: checkAnimatedSprite2D,
};

// Self-register the rule
ruleRegistry.register(animatedSprite2DValidationRule);

// Export for testing
export { animatedSprite2DValidationRule };
