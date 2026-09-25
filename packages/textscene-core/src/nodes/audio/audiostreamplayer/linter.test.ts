/**
 * AudioStreamPlayer semantic rules: the 2D and 3D rules minus the positional ones. A streamless
 * player is valid, since the stream can be set at runtime. Autoplay with no stream warns, and only
 * a dangling stream reference errors. volume_db's hint band and the pitch_scale and max_polyphony
 * format checks live on the validators in linterParser.ts.
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
        ruleName: 'dangling-resource-reference',
        severity: 'error',
        nodeType: 'AudioStreamPlayer',
      }
    );
  });

  it('reports when autoplay is on but no stream is set', () => {
    expectDiagnostic(scene(node('AudioStreamPlayer', { autoplay: true }, { name: 'Player' })), {
      ruleName: 'audiostreamplayer-autoplay-without-stream',
      severity: 'info',
    });
  });

  it('stays silent when an AnimationPlayer audio track targets this node', () => {
    // A node an AnimationPlayer audio track drives:
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
