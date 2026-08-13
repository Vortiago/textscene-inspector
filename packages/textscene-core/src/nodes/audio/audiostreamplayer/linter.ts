/**
 * Semantic linter rules for AudioStreamPlayer (non-positional).
 *
 * Unlike the 2D/3D siblings, a streamless player is VALID — the stream can be set
 * at runtime. A dangling stream reference is an error; missing stream is not.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../linter/linterUtils.js';
import { checkResourceExists, resourceSlotIsEmpty } from '../../../linter/resourceChecker.js';
import { rangeAdvisories } from '../../../linter/rangeAdvisory.js';
import { basePlayerVolumeArms, isDrivenByAnimationAudioTrack } from '../sharedLinterChecks.js';

function checkAudioStreamPlayer(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node, scene } = context;


  if (!isValidProperties(node.properties)) {
    return diagnostics;
  }

  const rawProps = node.properties as Record<string, string>;

  // ERROR: stream is set but does not resolve
  if (rawProps.stream !== undefined && !checkResourceExists(scene, rawProps.stream)) {
    diagnostics.push({
      severity: 'error',
      message: `Stream resource "${rawProps.stream}" does not exist in scene. AudioStreamPlayer will not play audio.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'audiostreamplayer-missing-stream-resource',
    });
  }

  // WARNING: autoplay is on but no stream is set. Godot raises no warning for
  // this: `play_basic()` (audio_stream_player_internal.cpp:137-141) returns a
  // null playback the instant `stream` is null and never logs anything, so
  // autoplay silently does nothing. Suppressed when some AnimationPlayer
  // audio track drives this node instead (its own `stream` is then beside
  // the point).
  if (
    rawProps.autoplay === 'true' &&
    resourceSlotIsEmpty(rawProps.stream) &&
    !isDrivenByAnimationAudioTrack(scene, node)
  ) {
    diagnostics.push({
      severity: 'warning',
      message: `Autoplay is enabled but no stream is set. The player will have no audio source.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'audiostreamplayer-autoplay-without-stream',
    });
  }

  diagnostics.push(
    ...rangeAdvisories(node, {
      volume_db: basePlayerVolumeArms('audiostreamplayer'),
    })
  );

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
        ruleName: 'audiostreamplayer-missing-stream-resource',
        severity: 'error',
        grounding: {
          kind: 'no-engine-counterpart',
          scope: 'dangling-reference',
          because: 'the file declares no ExtResource or SubResource carrying that id',
        },
      },
      {
        ruleName: 'audiostreamplayer-autoplay-without-stream',
        severity: 'warning',
        grounding: {
          kind: 'engine-inert',
          at: 'audio_stream_player_internal.cpp:139',
          unused: 'play_basic returns an empty playback, so autoplay produces no sound',
        },
      },
      {
        ruleName: 'audiostreamplayer-extreme-volume',
        severity: 'warning',
        grounding: { kind: 'engine', at: 'audio_stream_player.cpp:282' },
      },
    ],
  },
  check: checkAudioStreamPlayer,
};

// Self-register the rule
ruleRegistry.register(audioStreamPlayerValidationRule);

export { audioStreamPlayerValidationRule };
