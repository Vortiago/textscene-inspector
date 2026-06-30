/**
 * Tests for AudioStreamPlayer semantic linter rules.
 *
 * Mirrors the AudioStreamPlayer2D/3D semantic rules for the non-positional
 * AudioStreamPlayer, minus the positional ones (max_distance / attenuation).
 * A streamless player is VALID (the stream can be set at runtime), so it is
 * NOT an error; the advisory cases (autoplay with no stream, extreme volume)
 * are WARNINGS — which the bulk fixtureLint guard allows. Only a dangling
 * stream reference is an error. (Format validation of volume_db / pitch_scale
 * / max_polyphony types already lives in linterParser.ts.)
 */

import { describe, it } from 'vitest';
import { node, scene, expectClean, expectDiagnostic, expectNoErrors } from '../../../linter/testing/testkit';
import './linterParser';
import './linter';

describe('AudioStreamPlayer semantic rules', () => {
  it('passes a player whose stream resolves and values are normal', () => {
    const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://sound.ogg" id="1_a"]

[node name="Player" type="AudioStreamPlayer"]
stream = ExtResource("1_a")
volume_db = 0.0
pitch_scale = 1.0
`;

    expectClean(content);
  });

  it('does NOT error on a streamless player (stream may be set at runtime)', () => {
    expectNoErrors(scene(node('AudioStreamPlayer', { volume_db: '0.0' }, { name: 'Player' })));
  });

  it('errors when the stream reference does not resolve', () => {
    expectDiagnostic(
      scene(node('AudioStreamPlayer', { stream: 'ExtResource("9_missing")' }, { name: 'Player' })),
      {
        ruleName: 'audiostreamplayer-missing-stream-resource',
        severity: 'error',
        nodeType: 'AudioStreamPlayer',
      }
    );
  });

  it('warns when autoplay is on but no stream is set', () => {
    expectDiagnostic(scene(node('AudioStreamPlayer', { autoplay: true }, { name: 'Player' })), {
      ruleName: 'audiostreamplayer-autoplay-without-stream',
      severity: 'warning',
    });
  });

  it('warns on an extreme volume_db (stream present)', () => {
    const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://sound.ogg" id="1_a"]

[node name="Player" type="AudioStreamPlayer"]
stream = ExtResource("1_a")
volume_db = -100.0
`;

    expectDiagnostic(content, {
      ruleName: 'audiostreamplayer-extreme-volume',
      severity: 'warning',
    });
  });
});
