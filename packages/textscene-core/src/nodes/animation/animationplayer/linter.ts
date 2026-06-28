/**
 * Semantic linter rules for AnimationPlayer
 *
 * Note: Format validation is handled by linterParser.ts during strict parsing.
 * This file focuses on semantic validation requiring full context.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../linter/linterUtils.js';
import { extractLibraries, stripQuotes } from './parser.js';
import { resolveAnimations } from './animationResolver.js';

// Thresholds for warnings
const EXTREME_SLOW_SPEED = 0.1;
const EXTREME_FAST_SPEED = 10;

/**
 * Validate AnimationPlayer semantic rules
 */
function checkAnimationPlayer(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node, scene: _scene } = context;

  // Only run for AnimationPlayer nodes
  if (node.type !== 'AnimationPlayer') {
    return diagnostics;
  }

  // Type guard for properties
  if (!isValidProperties(node.properties)) {
    return diagnostics;
  }

  const rawProps = node.properties as Record<string, string>;

  // WARNING: speed_scale extreme values (very slow or very fast)
  if (rawProps.speed_scale !== undefined) {
    const speed = parseFloat(rawProps.speed_scale);
    if (!isNaN(speed)) {
      const absSpeed = Math.abs(speed);
      if (absSpeed > 0 && absSpeed < EXTREME_SLOW_SPEED) {
        diagnostics.push({
          severity: 'warning',
          message: `AnimationPlayer 'speed_scale' is very slow (${speed}). Values below ${EXTREME_SLOW_SPEED} may cause imperceptible animation playback.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'animationplayer-extreme-speed',
        });
      } else if (absSpeed > EXTREME_FAST_SPEED) {
        diagnostics.push({
          severity: 'warning',
          message: `AnimationPlayer 'speed_scale' is very fast (${speed}). Values above ${EXTREME_FAST_SPEED} may cause animation to appear too rapid.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'animationplayer-extreme-speed',
        });
      }
    }
  }

  // WARNING: Negative speed_scale (reverse playback)
  if (rawProps.speed_scale !== undefined) {
    const speed = parseFloat(rawProps.speed_scale);
    if (!isNaN(speed) && speed < 0) {
      diagnostics.push({
        severity: 'info',
        message: `AnimationPlayer 'speed_scale' is negative (${speed}). This will play animations in reverse.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'animationplayer-reverse-playback',
      });
    }
  }

  // WARNING: No animations defined (AnimationPlayer without animations is useless)
  // Note: In TSCN format, animations are typically stored in the anims/ section
  // We can check if there are any properties starting with "anims/"
  const hasAnimations = Object.keys(rawProps).some(key => key.startsWith('anims/'));
  // Godot 4 references AnimationLibraries via `libraries/<name>` keys (the
  // empty-name default library is written `libraries/`); older files used a
  // single `libraries` dict. Accept either form.
  const hasLibraries = Object.keys(rawProps).some(
    key => key === 'libraries' || key.startsWith('libraries/')
  );

  if (!hasAnimations && !hasLibraries) {
    diagnostics.push({
      severity: 'warning',
      message: `AnimationPlayer has no animations defined. Add animations to the 'libraries/' property (or legacy 'anims/' section) to make this node functional.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'animationplayer-no-animations',
    });
  }

  // Build set of all known clip names from both library and legacy sources.
  const internalResources = context.scene?.internalResources ?? [];
  const libraryRefs = extractLibraries(rawProps);
  const libraryClips = new Set(
    resolveAnimations(libraryRefs, internalResources as any).map((a: { name: unknown }) => String(a.name))
  );

  // Legacy anims/ clips (pre-4.0): `anims/<clipname> = SubResource(...)`
  const legacyClips = new Set<string>();
  for (const key of Object.keys(rawProps)) {
    if (key.startsWith('anims/')) {
      legacyClips.add(key.slice('anims/'.length));
    }
  }

  // Merge: a clip is known if it appears in either source.
  const knownClips = new Set<string>([...libraryClips, ...legacyClips]);

  // WARNING: autoplay references animation that may not exist
  if (rawProps.autoplay !== undefined && rawProps.autoplay.trim().length > 0) {
    const autoplayName = stripQuotes(rawProps.autoplay);
    if (!knownClips.has(autoplayName)) {
      diagnostics.push({
        severity: 'warning',
        message: `AnimationPlayer 'autoplay' references animation "${autoplayName}" which may not exist. Ensure this animation is defined in the AnimationLibrary or anims/ section.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'animationplayer-autoplay-missing',
      });
    }
  }

  // WARNING: current_animation references animation that may not exist
  if (rawProps.current_animation !== undefined) {
    const currentName = stripQuotes(rawProps.current_animation);
    if (currentName.length > 0 && !knownClips.has(currentName)) {
      diagnostics.push({
        severity: 'warning',
        message: `AnimationPlayer 'current_animation' references animation "${currentName}" which may not exist. Ensure this animation is defined in the AnimationLibrary or anims/ section.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'animationplayer-current-animation-missing',
      });
    }
  }

  // WARNING: Large blend time
  if (rawProps.playback_default_blend_time !== undefined) {
    const blendTime = parseFloat(rawProps.playback_default_blend_time);
    if (!isNaN(blendTime) && blendTime > 2.0) {
      diagnostics.push({
        severity: 'warning',
        message: `AnimationPlayer 'playback_default_blend_time' is large (${blendTime} seconds). Long blend times may cause noticeable delays between animation transitions.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'animationplayer-large-blend-time',
      });
    }
  }

  // INFO: playback_active is false
  if (rawProps.playback_active === 'false') {
    diagnostics.push({
      severity: 'info',
      message: `AnimationPlayer 'playback_active' is set to false. Animations will not play until this is set to true at runtime.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'animationplayer-inactive',
    });
  }

  // Validate root_node existence
  if (rawProps.root_node !== undefined) {
    const rootPath = rawProps.root_node.trim().replace(/^NodePath\("(.*)"\)$/, '$1');

    // Check if root_node is not default ".."
    if (rootPath !== '..' && rootPath !== '') {
      // Try to resolve the node path
      // For now, just check if it's a reasonable path format
      if (!rootPath.match(/^(\.\.|\.|\/)/) && !rootPath.match(/^[A-Za-z_]/)) {
        diagnostics.push({
          severity: 'warning',
          message: `AnimationPlayer 'root_node' has unusual path format "${rootPath}". Ensure this path resolves correctly at runtime.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'animationplayer-invalid-root-path',
        });
      }
    }
  }

  return diagnostics;
}

/**
 * AnimationPlayer semantic validation rule
 */
const animationPlayerValidationRule: LintRule = {
  meta: {
    name: 'valid-animationplayer-properties',
    description: 'Validates AnimationPlayer property values, animation references, and playback configuration',
    category: 'validation',
    applicableNodeTypes: ['AnimationPlayer'],
  },
  check: checkAnimationPlayer,
};

// Self-register the rule
ruleRegistry.register(animationPlayerValidationRule);

// Export for testing
export { animationPlayerValidationRule };
