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
import { basePlayerVolumeArms } from '../sharedLinterChecks.js';

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
