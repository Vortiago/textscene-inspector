/**
 * Tests for AudioStreamPlayer semantic linter rules.
 *
 * Mirrors the AudioStreamPlayer2D/3D semantic rules for the non-positional
 * AudioStreamPlayer, minus the positional ones (max_distance / attenuation).
 * A streamless player is VALID (the stream can be set at runtime), so it is
 * NOT an error; the advisory case (autoplay with no stream) is a WARNING —
 * which the bulk fixtureLint guard allows. Only a dangling stream reference is
 * an error. (volume_db's hint band, and format validation of pitch_scale /
 * max_polyphony, live on the validators in linterParser.ts.)
 */

import { describe, it } from 'vitest';
import {
  node,
  scene,
  audioStream,
  expectClean,
  expectDiagnostic,
  expectNoErrors,
} from '../../../linter/testing/testkit';
import './linterParser';
import './linter';

describe('AudioStreamPlayer semantic rules', () => {
  it('passes a player whose stream resolves and values are normal', () => {
    expectClean(
      scene(
        audioStream,
        node(
          'AudioStreamPlayer',
          { stream: 'ExtResource("1_abc")', volume_db: '0.0', pitch_scale: '1.0' },
          { name: 'Player' }
        )
      )
    );
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

  it('stays silent when an AnimationPlayer audio track targets this node', () => {
    // The coin.tscn shape, ported to the non-positional player:
    // animation_mixer.cpp:891-898 builds its own polyphonic playback for the
    // track's target and never reads the node's `stream`.
    expectClean(
      scene(
        audioStream,
        `[sub_resource type="Animation" id="anim1"]
tracks/0/type = "audio"
tracks/0/path = NodePath("Pickup")
tracks/0/keys = {
"clips": [{
"end_offset": 0.0,
"start_offset": 0.0,
"stream": ExtResource("1_abc")
}],
"times": PackedFloat32Array(0)
}`,
        `[sub_resource type="AnimationLibrary" id="lib"]
_data = {
&"picked": SubResource("anim1")
}`,
        node('Node', {}, { name: 'Root' }),
        node('AnimationPlayer', { 'libraries/': 'SubResource("lib")' }, { parent: '.' }),
        node('AudioStreamPlayer', { autoplay: true }, { name: 'Pickup', parent: '.' })
      )
    );
  });
});
