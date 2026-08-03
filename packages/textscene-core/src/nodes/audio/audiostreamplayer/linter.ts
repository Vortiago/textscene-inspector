/**
 * Semantic linter rules for AudioStreamPlayer (non-positional).
 *
 * Unlike the 2D/3D siblings, a streamless player is VALID — the stream can be set
 * at runtime. A dangling stream reference is an error; missing stream is not.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../linter/linterUtils.js';
import { checkResourceExists } from '../../../linter/resourceChecker.js';
import { rangeAdvisories } from '../../../linter/rangeAdvisory.js';
import { extremeVolumeArms } from '../sharedLinterChecks.js';

// audio_stream_player.cpp:282, volume_db PROPERTY_HINT_RANGE "-80,24,suffix:dB":
// both ends closed. set_volume_db (:69) only ERR_FAILs on NaN, so the band is
// advisory, not enforced.
const VOLUME_DB_HINT_MIN = -80;
const VOLUME_DB_HINT_MAX = 24;

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

  // WARNING: autoplay is on but no stream is set
  if (rawProps.autoplay === 'true' && rawProps.stream === undefined) {
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
      volume_db: extremeVolumeArms('audiostreamplayer', VOLUME_DB_HINT_MIN, VOLUME_DB_HINT_MAX),
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
      { ruleName: 'audiostreamplayer-missing-stream-resource', severity: 'error' },
      { ruleName: 'audiostreamplayer-autoplay-without-stream', severity: 'warning' },
      { ruleName: 'audiostreamplayer-extreme-volume', severity: 'warning' },
    ],
  },
  check: checkAudioStreamPlayer,
};

// Self-register the rule
ruleRegistry.register(audioStreamPlayerValidationRule);

export { audioStreamPlayerValidationRule };
