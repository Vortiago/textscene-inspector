/**
 * Semantic linter rules for AnimationPlayer
 *
 * Note: Format validation is handled by linterParser.ts during strict parsing.
 * This file focuses on semantic validation requiring full context.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../linter/linterUtils.js';
import { rangeAdvisories } from '../../../linter/rangeAdvisory.js';
import { extractLibraries, isActive, stripQuotes } from './parser.js';
import { resolveAnimations } from './animationResolver.js';

/**
 * Top of the `playback_default_blend_time` hint, animation_player.cpp:1046 —
 * PROPERTY_HINT_RANGE "0,4096,0.01,suffix:s". Neither end is open and
 * `set_default_blend_time` (:822) is a bare assignment, so both are advisory.
 */
const BLEND_TIME_HINT_MAX = 4096;

/**
 * Validate AnimationPlayer semantic rules
 */
function checkAnimationPlayer(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node, scene } = context;


  // Type guard for properties
  if (!isValidProperties(node.properties)) {
    return diagnostics;
  }

  const rawProps = node.properties as Record<string, string>;

  // `speed_scale` gets no diagnostic at all: animation_player.cpp:1048 hints
  // "-4,4,0.001,or_less,or_greater", so BOTH ends are open, and set_speed_scale
  // (:648) is a bare assignment. Negative is reverse playback; 0 pauses.

  // WARNING: No animations defined (AnimationPlayer without animations is useless).
  // Godot raises no warning for this — AnimationPlayer declares no
  // get_configuration_warnings() override at all. Grounded instead in the
  // node being unable to do anything: with no clip source there is nothing
  // `play()` could ever resolve.
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

  // Build the set of known clip names. Godot references a clip in the default
  // (empty-name) library bare ("walk") but a clip in a NAMED library prefixed
  // ("combat/walk"), so resolve each library separately and prefix accordingly
  // (resolveAnimations flattens the library name away, hence the per-ref loop).
  const knownClips = new Set<string>();
  for (const ref of extractLibraries(rawProps)) {
    const prefix = ref.name ? `${ref.name}/` : '';
    for (const anim of resolveAnimations([ref], scene.internalResources)) {
      knownClips.add(prefix + anim.name);
    }
  }
  // Legacy anims/ clips (pre-4.0): `anims/<clipname> = SubResource(...)`.
  for (const key of Object.keys(rawProps)) {
    if (key.startsWith('anims/')) knownClips.add(key.slice('anims/'.length));
  }

  // Only assert a clip is MISSING when the clip set is FULLY enumerable. An
  // ExtResource-backed library is external (often binary .res) and unresolvable
  // here, so its clips are invisible — flagging then would false-positive (the
  // renderer is deliberately lenient about external libraries). And with no
  // resolvable clip source at all, the no-animations warning above already
  // covers it; existence-checking would only duplicate that noise.
  const hasUnresolvableLibrary = Object.entries(rawProps).some(
    ([key, value]) => (key === 'libraries' || key.startsWith('libraries/')) && value.includes('ExtResource(')
  );
  // A resolvable-but-empty library is still enumerable (a missing clip IS caught); only an
  // unresolvable ExtResource library, or no clip source at all, suppresses the check.
  const canCheckExistence = (hasAnimations || hasLibraries) && !hasUnresolvableLibrary;

  // WARNING: autoplay references animation that may not exist (an empty StringName `&""` means
  // "no autoplay" — guard on the STRIPPED name, like current_animation below, not the raw value).
  // Godot raises no warning for this: `NOTIFICATION_READY`
  // (animation_player.cpp:149-155) gates the whole autoplay dispatch on
  // `animation_set.has(autoplay)`, so a name that resolves to nothing simply
  // never calls `play()` — no error, no log, nothing.
  if (canCheckExistence && rawProps.autoplay !== undefined) {
    const autoplayName = stripQuotes(rawProps.autoplay);
    if (autoplayName.length > 0 && !knownClips.has(autoplayName)) {
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
  if (canCheckExistence && rawProps.current_animation !== undefined) {
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

  // WARNING: blend time outside the range the inspector offers (range advisory)
  diagnostics.push(
    ...rangeAdvisories(node, {
      playback_default_blend_time: [
        {
          under: 0,
          ruleName: 'animationplayer-negative-blend-time',
          message: (blendTime) =>
            `AnimationPlayer 'playback_default_blend_time' is ${blendTime} seconds. The editor range starts at 0.`,
          cite: 'animation_player.cpp:1046',
        },
        {
          over: BLEND_TIME_HINT_MAX,
          ruleName: 'animationplayer-large-blend-time',
          message: (blendTime) =>
            `AnimationPlayer 'playback_default_blend_time' is ${blendTime} seconds. The editor range stops at ${BLEND_TIME_HINT_MAX}.`,
          cite: 'animation_player.cpp:1046',
        },
      ],
    })
  );

  // WARNING: the mixer is switched off. Godot raises no configuration warning
  // for this — AnimationMixer declares no get_configuration_warnings() override
  // — but it is not a style opinion either: seek_internal returns immediately
  // on `!active` (animation_player.cpp:664), so nothing this node declares can
  // ever reach the scene. Read through `isActive` so the advisory and the
  // renderer cannot disagree about which key spells it.
  if (!isActive(rawProps)) {
    diagnostics.push({
      severity: 'warning',
      message: `AnimationPlayer 'active' is set to false. Animations will not play until this is set to true at runtime.`,
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
    emits: [
      { ruleName: 'animationplayer-no-animations', severity: 'warning' },
      { ruleName: 'animationplayer-autoplay-missing', severity: 'warning' },
      { ruleName: 'animationplayer-current-animation-missing', severity: 'warning' },
      { ruleName: 'animationplayer-negative-blend-time', severity: 'warning' },
      { ruleName: 'animationplayer-large-blend-time', severity: 'warning' },
      { ruleName: 'animationplayer-inactive', severity: 'warning' },
      { ruleName: 'animationplayer-invalid-root-path', severity: 'warning' },
    ],
  },
  check: checkAnimationPlayer,
};

// Self-register the rule
ruleRegistry.register(animationPlayerValidationRule);

// Export for testing
export { animationPlayerValidationRule };
