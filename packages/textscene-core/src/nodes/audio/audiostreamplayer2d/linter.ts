/**
 * Semantic linter rules for AudioStreamPlayer2D
 *
 * Note: Format validation is handled by linterParser.ts during strict parsing.
 * This file focuses on semantic validation requiring full context (e.g., logical consistency).
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../linter/linterUtils.js';
import { checkResourceExists, resourceSlotIsEmpty } from '../../../linter/resourceChecker.js';
import { rangeAdvisories } from '../../../linter/rangeAdvisory.js';
import {
  player2DVolumeArms,
  player2DPitchArms,
  isDrivenByAnimationAudioTrack,
} from '../sharedLinterChecks.js';

// audio_stream_player_2d.cpp:436, max_distance PROPERTY_HINT_RANGE
// "1,4096,1,or_greater,exp,suffix:px": the top end is open, so only the bottom
// is advisory. set_max_distance (:299) ERR_FAILs at <= 0, which linterParser.ts
// reports as an error, so the advisory floors at 0.
const MAX_DISTANCE_HINT_MIN = 1;

/**
 * Validate AudioStreamPlayer2D semantic rules
 */
function checkAudioStreamPlayer2D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node, scene } = context;


  // Type guard for properties
  if (!isValidProperties(node.properties)) {
    return diagnostics;
  }

  const rawProps = node.properties as Record<string, string>;

  // A stream can also arrive through an AnimationPlayer audio track that
  // targets this node (animation_mixer.cpp:889-897 builds its own polyphonic
  // playback and never reads the node's `stream`), so a node driven that way
  // is not silent despite having no `stream` of its own.
  const streamEmpty = resourceSlotIsEmpty(rawProps.stream);
  const drivenByAnimation = streamEmpty && isDrivenByAnimationAudioTrack(scene, node);

  // A player with no `stream` at all gets no diagnostic: that is the serialised
  // default, audio_stream_player_2d.cpp defines no configuration warning, and a
  // script may assign one at runtime.

  // ERROR: stream resource doesn't exist
  if (rawProps.stream !== undefined && !checkResourceExists(scene, rawProps.stream)) {
    diagnostics.push({
      severity: 'error',
      message: `Stream resource "${rawProps.stream}" does not exist in scene. AudioStreamPlayer2D will not play audio.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'audiostreamplayer2d-missing-stream-resource',
    });
  }

  // WARNING: autoplay enabled but no stream set
  if (rawProps.autoplay === 'true' && streamEmpty && !drivenByAnimation) {
    diagnostics.push({
      severity: 'warning',
      message: `Property 'autoplay' is enabled but no 'stream' is set. Audio will not play automatically.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'audiostreamplayer2d-autoplay-without-stream',
    });
  }

  // Range advisories: distance / volume / pitch bands. `attenuation` carries
  // none: audio_stream_player_2d.cpp:437 declares it PROPERTY_HINT_EXP_EASING,
  // which states no range, and set_attenuation (:308) is a bare assignment.
  diagnostics.push(
    ...rangeAdvisories(node, {
      max_distance: [
        {
          under: MAX_DISTANCE_HINT_MIN,
          floor: 0,
          ruleName: 'audiostreamplayer2d-small-max-distance',
          cite: 'audio_stream_player_2d.cpp:436',
          message: (maxDistance) =>
            `Property 'max_distance' is ${maxDistance}. The editor range starts at ${MAX_DISTANCE_HINT_MIN} px.`,
        },
      ],
      volume_db: player2DVolumeArms('audiostreamplayer2d'),
      pitch_scale: player2DPitchArms('audiostreamplayer2d'),
    })
  );

  return diagnostics;
}

/**
 * AudioStreamPlayer2D semantic validation rule
 */
const audioStreamPlayer2DValidationRule: LintRule = {
  meta: {
    name: 'valid-audiostreamplayer2d-properties',
    description: 'Validates AudioStreamPlayer2D property values, resource references, and logical consistency',
    category: 'validation',
    applicableNodeTypes: ['AudioStreamPlayer2D'],
    emits: [
      {
        ruleName: 'audiostreamplayer2d-missing-stream-resource',
        severity: 'error',
        grounding: {
          kind: 'no-engine-counterpart',
          scope: 'dangling-reference',
          because: 'the file declares no ExtResource or SubResource carrying that id',
        },
      },
      {
        ruleName: 'audiostreamplayer2d-autoplay-without-stream',
        severity: 'warning',
        grounding: {
          kind: 'engine-inert',
          at: 'audio_stream_player_internal.cpp:139',
          unused: 'play_basic returns an empty playback, so autoplay produces no sound',
        },
      },
      {
        ruleName: 'audiostreamplayer2d-small-max-distance',
        severity: 'warning',
        grounding: { kind: 'engine', at: 'audio_stream_player_2d.cpp:436' },
      },
      {
        ruleName: 'audiostreamplayer2d-extreme-volume',
        severity: 'warning',
        grounding: { kind: 'engine', at: 'audio_stream_player_2d.cpp:430' },
      },
      {
        ruleName: 'audiostreamplayer2d-unusual-pitch',
        severity: 'warning',
        grounding: { kind: 'engine', at: 'audio_stream_player_2d.cpp:432' },
      },
    ],
  },
  check: checkAudioStreamPlayer2D,
};

// Self-register the rule
ruleRegistry.register(audioStreamPlayer2DValidationRule);

// Export for testing
export { audioStreamPlayer2DValidationRule };
