/**
 * Semantic linter rules for AnimatedSprite2D
 *
 * Format validation is handled by linterParser.ts during strict parsing.
 * This file focuses on semantic validation requiring full scene context.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { checkResourceExists, heldResource } from '../../../linter/resourceChecker.js';
import { DEFAULT_ANIMATION_NAME, literalText, ruleInt } from '../../../godot/index.js';

/**
 * The SpriteFrames reference in effect when Godot replays `key`.
 *
 * `SceneState::instantiate` applies a node's stored properties in the order the
 * FILE lists them (packed_scene.cpp:369-492), and `set_frame_and_progress`
 * returns without writing while the slot is null
 * (animated_sprite_2d.cpp:360-362). A `sprite_frames` line written BELOW `frame`
 * therefore leaves the frame where an absent one does. Measured on 4.6.3:
 * `frame = 2` above `sprite_frames` loads as frame 0, below it as frame 2.
 */
function spriteFramesWhenApplied(
  rawProps: Record<string, string>,
  key: string
): string | undefined {
  const written = Object.keys(rawProps);
  const slotAt = written.indexOf('sprite_frames');
  if (slotAt === -1 || slotAt > written.indexOf(key)) return undefined;
  return heldResource(rawProps.sprite_frames);
}

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

  // `set_animation` clears the name and ERR_FAIL_MSGs whenever the SpriteFrames
  // slot is null at that line (animated_sprite_2d.cpp:562-565), which a slot
  // written BELOW `animation` is too. Measured on 4.6.3: `animation = &"walk"`
  // above `sprite_frames` loads as the default name, below it as "walk".
  //
  // Not `"default"`, though: `set_animation` opens with
  // `if (animation == p_name) { return; }` (animated_sprite_2d.cpp:554-556) and the
  // field already holds that name (animated_sprite_2d.h:43), so the clearing branch
  // this reports is never reached and Godot loads the scene in silence.
  if (
    rawProps.animation &&
    literalText(rawProps.animation) !== DEFAULT_ANIMATION_NAME &&
    spriteFramesWhenApplied(rawProps, 'animation') === undefined
  ) {
    diagnostics.push({
      severity: 'error',
      message: `Property 'animation' is set to "${literalText(rawProps.animation)}" with no 'sprite_frames' in effect at that line. Godot clears 'animation', so the authored name never applies.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'animatedsprite2d-animation-no-spriteframes',
    });
  }

  // With a null SpriteFrames `set_frame_and_progress` drops EVERY frame
  // (animated_sprite_2d.cpp:360-362), not only the negative one
  // `linterParser.ts` floors — so this is that guard's cross-property half.
  // Above 0 only: a negative frame is the validator's error already, and 0 is
  // the value the node holds anyway.
  const frame = ruleInt(rawProps.frame);
  if (frame !== null && frame > 0 && spriteFramesWhenApplied(rawProps, 'frame') === undefined) {
    diagnostics.push({
      severity: 'error',
      message: `Property 'frame' is set to ${frame} with no 'sprite_frames' in effect at that line. Godot drops the write, so the node loads on frame 0.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'animatedsprite2d-frame-no-spriteframes',
    });
  }

  // `speed_scale` and `frame_progress` get no diagnostic: both are
  // PROPERTY_HINT_NONE behind a bare setter, so no value is out of range (0
  // speed_scale is a legal paused state, and frame_progress is not clamped).
  // `playing` is not a property at all, so it is a key verdict in
  // linterParser.ts rather than a value rule here.

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
      {
        ruleName: 'animatedsprite2d-frame-no-spriteframes',
        severity: 'error',
        grounding: { kind: 'engine', at: 'animated_sprite_2d.cpp:360' },
      },
    ],
  },
  check: checkAnimatedSprite2D,
};

// Self-register the rule
ruleRegistry.register(animatedSprite2DValidationRule);

// Export for testing
export { animatedSprite2DValidationRule };
