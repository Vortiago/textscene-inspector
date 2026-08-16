/**
 * Tests for AudioStreamPlayer2D linter (strict parser + semantic rules)
 */

import { describe, it, expect } from 'vitest';
import {
  node,
  scene,
  lint,
  audioStream,
  expectClean,
  expectDiagnostic,
  runPropertyValidation,
  type PropValue,
} from '../../../linter/testing/testkit';
import './linterParser';
import './linter';

/** Scene with the player node plus the `1_abc` AudioStream resource it references. */
function withStream(props: Record<string, PropValue> = {}): string {
  return scene(
    audioStream,
    node('AudioStreamPlayer2D', { stream: 'ExtResource("1_abc")', ...props }, { name: 'AudioPlayer' })
  );
}

/** Scene with just the player node (no stream resource present). */
function bare(props: Record<string, PropValue> = {}): string {
  return scene(node('AudioStreamPlayer2D', props, { name: 'AudioPlayer' }));
}

/**
 * An AnimationPlayer with one Animation carrying a single 'audio' track whose
 * NodePath targets `targetName`, plus an AudioStreamPlayer2D of that name with
 * no `stream` of its own — the `coin.tscn` `Pickup` shape (its stream arrives
 * through the track's `clips`, not the node's own `stream`). Uses the
 * empty-name default library (`libraries/ =`), the form Godot actually writes.
 */
function drivenByAudioTrack(targetName: string, playerProps: Record<string, PropValue> = {}): string {
  return scene(
    audioStream,
    `[sub_resource type="Animation" id="anim1"]
tracks/0/type = "audio"
tracks/0/path = NodePath("${targetName}")
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
    node('Node2D', {}, { name: 'Root' }),
    node('AnimationPlayer', { 'libraries/': 'SubResource("lib")' }, { parent: '.' }),
    node('AudioStreamPlayer2D', playerProps, { name: 'Pickup', parent: '.' })
  );
}

describe('AudioStreamPlayer2D Linter', () => {
  describe('Strict Parser Validation (Format)', () => {
    it('should pass validation for valid AudioStreamPlayer2D properties', () => {
      expectClean(
        withStream({
          volume_db: 0.0,
          pitch_scale: 1.0,
          playing: false,
          autoplay: false,
          max_distance: 2000.0,
          attenuation: 1.0,
        })
      );
    });

    it('should accept a valid SubResource stream', () => {
      expectClean(
        scene(
          '[sub_resource type="AudioStreamGenerator" id="1"]',
          node('AudioStreamPlayer2D', { stream: 'SubResource("1")' }, { name: 'AudioPlayer' })
        )
      );
    });

    runPropertyValidation(
      {
        nodeType: 'AudioStreamPlayer2D',
        prefix: [audioStream],
        baseProps: { stream: 'ExtResource("1_abc")' },
      },
      [
        {
          prop: 'stream',
          valid: ['ExtResource("1_abc")'],
          invalid: [{ value: 'invalid_value', contains: ['stream', 'resource reference'] }],
        },
        {
          prop: 'volume_db',
          valid: [-6.0],
          invalid: [{ value: 'invalid', contains: ['volume_db', 'must be a number'] }],
        },
        {
          // audio_stream_player_2d.cpp:430 hints "-80,24,suffix:dB", closed at both
          // ends; outside it warns (set_volume_db :209-211 only refuses NaN).
          prop: 'volume_db',
          valid: [-80.0, 0, 24],
          invalid: [
            { value: -80.1, contains: ['volume_db', 'between -80 and 24'], severity: 'warning' },
            { value: 24.1, contains: ['volume_db', 'between -80 and 24'], severity: 'warning' },
          ],
        },
        {
          // audio_stream_player_internal.cpp:314, ERR_FAIL_COND(p_pitch_scale <= 0),
          // and hint :432 is "0.01,4,0.01,or_greater", so the top end is open.
          prop: 'pitch_scale',
          valid: [0.01, 0.5, 1.0, 1.5, 2.0, 3.0, 10.0],
          invalid: [
            { value: 0, contains: ['pitch_scale', 'greater than 0'] },
            { value: -1.0, contains: ['pitch_scale', 'greater than 0'] },
            { value: 'invalid', contains: ['pitch_scale', 'must be a number'] },
          ],
        },
        {
          prop: 'playing',
          valid: [true, false],
          invalid: [{ value: 'yes', contains: ['playing', 'boolean'] }],
        },
        { prop: 'autoplay', valid: [true] },
        { prop: 'stream_paused', valid: [false] },
        {
          // audio_stream_player_2d.cpp:300, ERR_FAIL_COND(p_pixels <= 0.0); hint
          // :436 is "1,4096,1,or_greater", so the top end is open.
          prop: 'max_distance',
          valid: [1, 10, 100, 1000, 5000, 15000],
          invalid: [
            { value: 0, contains: ['max_distance', 'greater than 0'] },
            { value: -10.0, contains: ['max_distance', 'greater than 0'] },
            { value: 'invalid', contains: ['max_distance', 'must be a number'] },
          ],
        },
        {
          // audio_stream_player_2d.cpp:437 is PROPERTY_HINT_EXP_EASING — no range —
          // and set_attenuation (:308) is a bare assignment, so nothing is invalid.
          prop: 'attenuation',
          valid: [0, 0.05, 0.5, 1.0, 2.0, 5.0, 15, -1.0],
          invalid: [{ value: 'invalid', contains: ['attenuation', 'must be a number'] }],
        },
        {
          // audio_stream_player_2d.cpp:349 enforces the floor only
          // (ERR_FAIL_COND_MSG(p_panning_strength < 0, ...)); the hint's ceiling
          // (:439, "0,3,0.01,or_greater") is open, so values above 1 are legal.
          prop: 'panning_strength',
          valid: [0, 0.5, 1, 1.5, 3, 10],
          invalid: [{ value: -0.1, contains: ['panning_strength', 'must be non-negative'] }],
        },
        {
          prop: 'area_mask',
          valid: [0, 1, 100, 1048575, 2000000, 2147483648, 4294967295],
          invalid: [
{ value: 4294967296, contains: ['cannot be stored in an integer slot'], severity: 'error' },
          ],
        },
        {
          prop: 'playback_type',
          valid: [0, 1, 2],
          invalid: [
            { value: 5, contains: ['playback_type', '0-2'] },
            { value: -1, contains: ['playback_type'] },
          ],
        },
        {
          prop: 'bus',
          valid: ['"Master"', '&"Master"'],
          invalid: [{ value: 'InvalidValue', contains: ['bus', 'must be a string'] }],
        },
        {
          prop: 'max_polyphony',
          valid: [1, 4, 16, 32],
          invalid: [
            { value: 0, contains: ['max_polyphony', 'at least 1'] },
            { value: -1, contains: ['max_polyphony', 'at least 1'] },
            { value: 'invalid', contains: ['max_polyphony', 'must be a number'] },
          ],
        },
      ]
    );
  });

  describe('Semantic Validation', () => {
    it('stays quiet about a streamless player (the stream may arrive at runtime)', () => {
      expectClean(bare({ volume_db: 0.0, pitch_scale: 1.0 }));
    });

    describe('missing stream resource error', () => {
      it('should error when stream resource does not exist', () => {
        expectDiagnostic(bare({ stream: 'ExtResource("nonexistent")' }), {
          ruleName: 'audiostreamplayer2d-missing-stream-resource',
          severity: 'error',
          nodeType: 'AudioStreamPlayer2D',
          contains: ['does not exist', 'ExtResource("nonexistent")'],
        });
      });

      it('should not error when stream resource exists', () => {
        expectClean(withStream());
      });
    });

    describe('autoplay without stream warning', () => {
      it('should warn when autoplay is enabled without stream', () => {
        expectDiagnostic(bare({ autoplay: true }), {
          ruleName: 'audiostreamplayer2d-autoplay-without-stream',
          severity: 'warning',
          nodeType: 'AudioStreamPlayer2D',
          contains: ['autoplay', 'no', 'stream'],
        });
      });

      it('should not warn when autoplay is enabled with stream', () => {
        expectClean(withStream({ autoplay: true }));
      });

      it('stays silent when an AnimationPlayer audio track targets this node', () => {
        // animation_mixer.cpp:889-897 builds its own polyphonic playback for
        // the track's target and never reads the node's `stream`.
        expectClean(drivenByAudioTrack('Pickup', { autoplay: true }));
      });

      it('still warns when the audio track targets a DIFFERENT node', () => {
        expectDiagnostic(drivenByAudioTrack('SomeOtherNode', { autoplay: true }), {
          ruleName: 'audiostreamplayer2d-autoplay-without-stream',
          severity: 'warning',
          nodeType: 'AudioStreamPlayer2D',
        });
      });
    });

    // audio_stream_player_2d.cpp:436 — max_distance PROPERTY_HINT_RANGE
    // "1,4096,1,or_greater,exp,suffix:px": the top end is open, and <= 0 is the
    // setter's own error (:300), so only 0 < x < 1 warns. Both ends live on the
    // validator, which carries the setter's floor and the hint's separately.
    describe('max_distance bands', () => {
      it('errors at or below the setter floor', () => {
        expectDiagnostic(withStream({ max_distance: 0 }), {
          ruleName: 'strict-parser',
          severity: 'error',
          contains: ['max_distance', 'greater than 0'],
        });
      });

      it('warns between the setter floor and the hint floor', () => {
        expectDiagnostic(withStream({ max_distance: 0.5 }), {
          ruleName: 'strict-parser',
          severity: 'warning',
          contains: ['max_distance', '1'],
        });
      });

      it.each([1, 5, 2000, 15000])('says nothing about max_distance %s', (maxDistance) => {
        expectClean(withStream({ max_distance: maxDistance }));
      });
    });

    // audio_stream_player_2d.cpp:437 — attenuation is PROPERTY_HINT_EXP_EASING,
    // which states no range at all.
    describe('attenuation carries no advisory', () => {
      it.each([0.05, 1.0, 15])('says nothing about attenuation %s', (attenuation) => {
        expectClean(withStream({ attenuation }));
      });
    });

    // volume_db's band is the validator's (linterParser.ts), not a rule's — the
    // accept/reject table above covers it.

    // audio_stream_player_internal.cpp:314 rejects pitch_scale <= 0; the hint
    // (:432, "0.01,4,0.01,or_greater") leaves the top open, so only 0 < x < 0.01 warns.
    describe('pitch_scale bands', () => {
      it('errors at or below the setter floor', () => {
        expectDiagnostic(withStream({ pitch_scale: 0 }), {
          ruleName: 'strict-parser',
          severity: 'error',
          contains: ['pitch_scale', 'greater than 0'],
        });
      });

      it('warns between the setter floor and the hint floor', () => {
        expectDiagnostic(withStream({ pitch_scale: 0.005 }), {
          ruleName: 'strict-parser',
          severity: 'warning',
          contains: ['pitch_scale', '0.01'],
        });
      });

      it.each([0.01, 0.3, 1.2, 3.0])('says nothing about pitch_scale %s', (pitchScale) => {
        expectClean(withStream({ pitch_scale: pitchScale }));
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle all properties together', () => {
      expectClean(
        withStream({
          volume_db: 0.0,
          pitch_scale: 1.0,
          playing: false,
          autoplay: false,
          stream_paused: false,
          max_distance: 2000.0,
          attenuation: 1.0,
          panning_strength: 1.0,
          area_mask: 1,
          playback_type: 0,
          bus: '&"Master"',
          max_polyphony: 1,
        })
      );
    });

    it('should handle multiple validation errors', () => {
      const diagnostics = lint(bare({ pitch_scale: 0, attenuation: -1.0, max_polyphony: 0 }));
      // Errors for pitch_scale and max_polyphony, both of which the engine refuses;
      // attenuation = -1 is legal (PROPERTY_HINT_EXP_EASING, no range).
      expect(diagnostics.length).toBeGreaterThan(1);
      expect(diagnostics.some(d => d.message.includes('pitch_scale'))).toBe(true);
      expect(diagnostics.some(d => d.message.includes('max_polyphony'))).toBe(true);
      expect(diagnostics.some(d => d.message.includes('attenuation'))).toBe(false);
    });

    it('should handle scientific notation in numeric values', () => {
      expectClean(
        withStream({
          volume_db: '-6e0',
          pitch_scale: '1.5e0',
          max_distance: '2e3',
          attenuation: '1e0',
        })
      );
    });

    it('should validate mixed warnings and errors', () => {
      const diagnostics = lint(
        withStream({ volume_db: -90, pitch_scale: 0.005, max_distance: 0.5 })
      );
      // All three sit below their hints.
      expect(diagnostics).toHaveLength(3);
      expect(diagnostics.every(d => d.severity === 'warning')).toBe(true);
    });

    it('should handle SubResource references', () => {
      expectClean(
        scene(
          '[sub_resource type="AudioStreamGenerator" id="gen_1"]',
          node(
            'AudioStreamPlayer2D',
            { stream: 'SubResource("gen_1")', volume_db: 0.0 },
            { name: 'AudioPlayer' }
          )
        )
      );
    });

    it('should handle boundary values for panning_strength', () => {
      expectClean(withStream({ panning_strength: 1.0 }));
    });

    it('should handle extreme combinations', () => {
      const diagnostics = lint(
        withStream({ volume_db: -90, pitch_scale: 0.005, max_distance: 0.5, attenuation: 15 })
      );
      // Three warnings, all three the validators' own hint bands; attenuation
      // has no hint band (EXP_EASING) and stays silent.
      expect(diagnostics.map(d => d.ruleName).sort()).toEqual([
        'strict-parser',
        'strict-parser',
        'strict-parser',
      ]);
      expect(diagnostics.every(d => d.severity === 'warning')).toBe(true);
    });

    it('should handle zero pitch_scale semantic validation', () => {
      const diagnostics = lint(withStream({ pitch_scale: 0 }));
      expect(diagnostics.length).toBeGreaterThan(0);
      // Should have error from both format validator and semantic validator
      const pitchErrors = diagnostics.filter(d => d.message.includes('pitch_scale'));
      expect(pitchErrors.length).toBeGreaterThan(0);
    });
  });
});
