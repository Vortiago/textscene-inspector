/**
 * Semantic linter rules for AnimatedSprite2D: the checks that need the whole node.
 * linterParser.ts validates each value's format during strict parsing.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { heldResource } from '../../../linter/resourceChecker.js';
import { DEFAULT_ANIMATION_NAME, literalText, ruleInt } from '../../../godot/index.js';

/**
 * The SpriteFrames reference in effect when Godot replays `key`: properties apply
 * in file order (packed_scene.cpp:369-492), so a `sprite_frames` line below `key` is
 * still null, and `set_frame_and_progress` writes nothing (animated_sprite_2d.cpp:360-362).
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

/** The AnimatedSprite2D rules that read `sprite_frames` beside another key. */
function checkAnimatedSprite2D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node } = context;

  const rawProps = node.properties as unknown as Record<string, string>;

  if (heldResource(rawProps.sprite_frames) === undefined) {
    diagnostics.push({
      severity: 'warning',
      message: `AnimatedSprite2D requires a 'sprite_frames' property. AnimatedSprite2D cannot play animations without a SpriteFrames resource.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'animatedsprite2d-requires-spriteframes',
    });
  }

  // `set_animation` clears the name and ERR_FAIL_MSGs whenever the SpriteFrames
  // slot is null at that line (animated_sprite_2d.cpp:562-565), and a slot written
  // below `animation` is null there too. Measured on 4.6.3: `animation = &"walk"`
  // above `sprite_frames` loads as the default name, below it as "walk".
  if (
    rawProps.animation &&
    // `"default"` never reaches that branch: `set_animation` opens with
    // `if (animation == p_name) { return; }` (animated_sprite_2d.cpp:554-556), and
    // the field already holds that name (animated_sprite_2d.h:43).
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

  // With a null SpriteFrames, `set_frame_and_progress` drops every frame
  // (animated_sprite_2d.cpp:360-362). Measured on 4.6.3: `frame = 2` above
  // `sprite_frames` loads as frame 0, below it as frame 2. Above 0 only: the validator already errors on
  // a negative frame, and 0 is the value the node holds anyway.
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
  // PROPERTY_HINT_NONE behind a bare setter: 0 speed_scale is a legal paused state,
  // and frame_progress is not clamped. `playing` is no property at all, so
  // linterParser.ts gives it a key verdict.

  return diagnostics;
}

const animatedSprite2DValidationRule: LintRule = {
  meta: {
    name: 'valid-animatedsprite2d-resources',
    description: 'Validates AnimatedSprite2D sprite_frames presence and animation references',
    category: 'validation',
    applicableNodeTypes: ['AnimatedSprite2D'],
    emits: [
      { ruleName: 'animatedsprite2d-requires-spriteframes', severity: 'warning', grounding: { kind: 'configuration-warning' } },
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

ruleRegistry.register(animatedSprite2DValidationRule);

export { animatedSprite2DValidationRule };
