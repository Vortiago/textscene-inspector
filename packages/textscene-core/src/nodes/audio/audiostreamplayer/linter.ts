/**
 * Semantic linter rules for AudioStreamPlayer (non-positional).
 *
 * A streamless player is valid, since the stream can be set at runtime, so only
 * autoplay over an empty slot is reported.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../linter/linterUtils.js';
import { resourceSlotIsEmpty } from '../../../linter/resourceChecker.js';
import { isDrivenByAnimationAudioTrack } from '../sharedLinterChecks.js';
import { boolSlotValue } from '../../../godot/index.js';

function checkAudioStreamPlayer(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node, scene } = context;


  if (!isValidProperties(node.properties)) {
    return diagnostics;
  }

  const rawProps = node.properties as Record<string, string>;

  // Autoplay with no stream. Godot raises no warning: `play_basic()`
  // (audio_stream_player_internal.cpp:137-141) returns a null playback when `stream` is null and
  // logs nothing. Suppressed when an AnimationPlayer audio track drives this node instead.
  if (
    boolSlotValue(rawProps.autoplay) === true &&
    resourceSlotIsEmpty(rawProps.stream) &&
    !isDrivenByAnimationAudioTrack(scene, node)
  ) {
    diagnostics.push({
      severity: 'info',
      message: `Autoplay is enabled but no stream is set. The player will have no audio source.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'audiostreamplayer-autoplay-without-stream',
    });
  }

  return diagnostics;
}

const audioStreamPlayerValidationRule: LintRule = {
  meta: {
    name: 'valid-audiostreamplayer-properties',
    description:
      'Validates AudioStreamPlayer property values and logical consistency (non-positional node)',
    category: 'validation',
    applicableNodeTypes: ['AudioStreamPlayer'],
    emits: [
      {
        ruleName: 'audiostreamplayer-autoplay-without-stream',
        severity: 'info',
        grounding: {
          kind: 'engine-inert',
          at: 'audio_stream_player_internal.cpp:139',
          unused: 'play_basic returns an empty playback, so autoplay produces no sound',
        },
      },
    ],
  },
  check: checkAudioStreamPlayer,
};

ruleRegistry.register(audioStreamPlayerValidationRule);

export { audioStreamPlayerValidationRule };
