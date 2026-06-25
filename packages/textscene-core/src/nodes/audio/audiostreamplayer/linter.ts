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

// Thresholds for extreme-volume warning (same as AudioStreamPlayer2D)
const EXTREME_VOLUME_DB_MIN = -60;
const EXTREME_VOLUME_DB_MAX = 20;

function checkAudioStreamPlayer(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node, scene } = context;

  if (node.type !== 'AudioStreamPlayer') {
    return diagnostics;
  }

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

  // WARNING: extreme volume_db values
  if (rawProps.volume_db !== undefined) {
    const volumeDb = parseFloat(rawProps.volume_db);
    if (!isNaN(volumeDb)) {
      if (volumeDb < EXTREME_VOLUME_DB_MIN) {
        diagnostics.push({
          severity: 'warning',
          message: `Volume is very low (${volumeDb} dB). Values below ${EXTREME_VOLUME_DB_MIN} dB are rarely intentional.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'audiostreamplayer-extreme-volume',
        });
      } else if (volumeDb > EXTREME_VOLUME_DB_MAX) {
        diagnostics.push({
          severity: 'warning',
          message: `Volume is very high (${volumeDb} dB). Values above ${EXTREME_VOLUME_DB_MAX} dB can cause distortion.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'audiostreamplayer-extreme-volume',
        });
      }
    }
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
  },
  check: checkAudioStreamPlayer,
};

// Self-register the rule
ruleRegistry.register(audioStreamPlayerValidationRule);

export { audioStreamPlayerValidationRule };
