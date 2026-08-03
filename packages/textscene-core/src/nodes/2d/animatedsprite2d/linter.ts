/**
 * Semantic linter rules for AnimatedSprite2D
 *
 * Format validation is handled by linterParser.ts during strict parsing.
 * This file focuses on semantic validation requiring full scene context.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { checkResourceExists } from '../../../linter/resourceChecker.js';

/**
 * Validate AnimatedSprite2D semantic rules (resource references, animation properties, etc.)
 */
function checkAnimatedSprite2D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node, scene } = context;


  // Access raw properties from the node (Record<string, string>)
  const rawProps = node.properties as unknown as Record<string, string>;

  // Check if sprite_frames resource exists (REQUIRED - AnimatedSprite2D is useless without SpriteFrames)
  if (!rawProps.sprite_frames) {
    diagnostics.push({
      severity: 'warning',
      message: `AnimatedSprite2D requires a 'sprite_frames' property. AnimatedSprite2D cannot play animations without a SpriteFrames resource.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'animatedsprite2d-requires-spriteframes',
    });
  } else {
    // sprite_frames is specified - check if it exists
    const resourceExists = checkResourceExists(scene, rawProps.sprite_frames);
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

  // Warn if autoplay is set but sprite_frames is not set
  if (rawProps.autoplay && !rawProps.sprite_frames) {
    diagnostics.push({
      severity: 'warning',
      message: `Property 'autoplay' is set to "${rawProps.autoplay}" but 'sprite_frames' is not set. Autoplay will not work without a SpriteFrames resource.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'animatedsprite2d-autoplay-no-spriteframes',
    });
  }

  // Warn if animation is set but sprite_frames is not set
  if (rawProps.animation && !rawProps.sprite_frames) {
    diagnostics.push({
      severity: 'warning',
      message: `Property 'animation' is set to "${rawProps.animation}" but 'sprite_frames' is not set. Animation cannot play without a SpriteFrames resource.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'animatedsprite2d-animation-no-spriteframes',
    });
  }

  // Validate speed_scale value
  if (rawProps.speed_scale !== undefined) {
    const speedScale = parseFloat(rawProps.speed_scale);
    if (!isNaN(speedScale)) {
      // Warn if speed_scale is 0 (animation won't play)
      if (speedScale === 0) {
        diagnostics.push({
          severity: 'warning',
          message: `Property 'speed_scale' is 0. Animation will not advance (paused state). Use play()/stop() methods to control playback instead.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'animatedsprite2d-speed-scale-zero',
        });
      }
      // Negative speed_scale is valid for reverse playback — no diagnostic
    }
  }

  // Validate frame_progress range (should be 0-1)
  if (rawProps.frame_progress !== undefined) {
    const frameProgress = parseFloat(rawProps.frame_progress);
    if (!isNaN(frameProgress)) {
      if (frameProgress < 0 || frameProgress > 1) {
        diagnostics.push({
          severity: 'warning',
          message: `Property 'frame_progress' is ${frameProgress}. Expected range is 0.0 to 1.0. Godot will clamp this value automatically.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'animatedsprite2d-frame-progress-range',
        });
      }
    }
  }

  // Warning: deprecated 'playing' property (Godot 4.0+)
  if (rawProps.playing !== undefined) {
    diagnostics.push({
      severity: 'warning',
      message: `Property 'playing' is deprecated in Godot 4.0+. Use play() and stop() methods in code instead of setting this property in scene files.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'animatedsprite2d-playing-deprecated',
    });
  }

  return diagnostics;
}

/**
 * AnimatedSprite2D semantic validation rule
 */
const animatedSprite2DValidationRule: LintRule = {
  meta: {
    name: 'valid-animatedsprite2d-resources',
    description: 'Validates AnimatedSprite2D sprite_frames resources, animation properties, and playback settings',
    category: 'validation',
    applicableNodeTypes: ['AnimatedSprite2D'],
    emits: [
      { ruleName: 'animatedsprite2d-requires-spriteframes', severity: 'warning' },
      { ruleName: 'valid-animatedsprite2d-resources', severity: 'error' },
      { ruleName: 'animatedsprite2d-autoplay-no-spriteframes', severity: 'warning' },
      { ruleName: 'animatedsprite2d-animation-no-spriteframes', severity: 'warning' },
      { ruleName: 'animatedsprite2d-speed-scale-zero', severity: 'warning' },
      { ruleName: 'animatedsprite2d-frame-progress-range', severity: 'warning' },
      { ruleName: 'animatedsprite2d-playing-deprecated', severity: 'warning' },
    ],
  },
  check: checkAnimatedSprite2D,
};

// Self-register the rule
ruleRegistry.register(animatedSprite2DValidationRule);

// Export for testing
export { animatedSprite2DValidationRule };
