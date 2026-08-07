/**
 * Tests for AudioStreamPlayer3D linter (strict parser + semantic rules)
 */

import { describe, it, expect } from 'vitest';
import {
  node,
  scene,
  lint,
  audioStream,
  expectClean,
  expectDiagnostic,
  expectNoErrors,
  runPropertyValidation,
  type PropValue,
} from '../../../linter/testing/testkit';
import './linterParser';
import './linter';

/** Scene with the ext_resource + an AudioStreamPlayer3D whose `stream` is pre-wired. */
const withStream = (props: Record<string, PropValue> = {}): string =>
  scene(
    audioStream,
    node('AudioStreamPlayer3D', { stream: 'ExtResource("1_abc")', ...props }, { name: 'AudioPlayer' })
  );

/** Bare scene with a single AudioStreamPlayer3D (no stream). */
const bare = (props: Record<string, PropValue> = {}): string =>
  scene(node('AudioStreamPlayer3D', props, { name: 'AudioPlayer' }));

/**
 * An AnimationPlayer with one Animation carrying a single 'audio' track whose
 * NodePath targets `targetName`, plus an AudioStreamPlayer3D of that name with
 * no `stream` of its own (the `coin.tscn` `Pickup` shape, ported to 3D).
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
    node('Node3D', {}, { name: 'Root' }),
    node('AnimationPlayer', { 'libraries/': 'SubResource("lib")' }, { parent: '.' }),
    node('AudioStreamPlayer3D', playerProps, { name: 'Pickup', parent: '.' })
  );
}

describe('AudioStreamPlayer3D Linter', () => {
  describe('Strict Parser Validation (Format)', () => {
    it('should pass validation for valid AudioStreamPlayer3D properties', () => {
      expectClean(
        withStream({
          volume_db: 0.0,
          pitch_scale: 1.0,
          playing: false,
          autoplay: false,
          unit_size: 10.0,
          max_distance: 100.0,
          attenuation_model: 0,
        })
      );
    });

    it('should accept a valid SubResource stream', () => {
      expectClean(
        scene(
          '[sub_resource type="AudioStreamGenerator" id="1"]',
          node('AudioStreamPlayer3D', { stream: 'SubResource("1")' }, { name: 'AudioPlayer' })
        )
      );
    });

    runPropertyValidation(
      {
        nodeType: 'AudioStreamPlayer3D',
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
          // audio_stream_player_3d.cpp:883 hints "-80,80,suffix:dB" — wider than the
          // 2D/base players — and set_volume_db (:552) only refuses NaN.
          prop: 'volume_db',
          acceptMode: 'no-error',
          valid: [-80.0, 80, -90, 100],
        },
        {
          // audio_stream_player_internal.cpp:314 refuses <= 0; hint :887 is
          // "0.01,4,0.01,or_greater", so the top end is open.
          prop: 'pitch_scale',
          acceptMode: 'no-error',
          valid: [0.01, 0.5, 1.0, 1.5, 2.0, 3.0],
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
          prop: 'emission_angle_enabled',
          valid: [true],
          with: { emission_angle_degrees: 45.0 },
        },
        {
          // INVERSE, INVERSE_SQUARE, LOGARITHMIC, DISABLED
          prop: 'attenuation_model',
          valid: [0, 1, 2, 3],
          invalid: [
            { value: 5, contains: ['attenuation_model', '0-3'] },
            { value: -1, contains: ['attenuation_model'] },
          ],
        },
        {
          // audio_stream_player_3d.cpp:569 is a bare assignment, so the hint at
          // :885 ("0.1,100,0.01,or_greater") only warns: 0 and -5 load fine.
          prop: 'unit_size',
          valid: [0.1, 10.0, 500],
          invalid: [{ value: 'invalid', contains: ['unit_size', 'must be a number'] }],
        },
        {
          prop: 'unit_size',
          valid: [0, -5.0],
          acceptMode: 'no-error',
        },
        {
          // 0 = unlimited
          prop: 'max_distance',
          valid: [0, 50, 100, 1000],
          invalid: [
            { value: -10.0, contains: ['max_distance', 'non-negative'] },
            { value: 'invalid', contains: ['max_distance', 'must be a number'] },
          ],
        },
        {
          prop: 'max_db',
          valid: [-24, 0, 3, 6],
          invalid: [{ value: 'invalid', contains: ['max_db', 'must be a number'] }],
        },
        {
          prop: 'attenuation_filter_cutoff_hz',
          valid: [1, 5000, 10000, 20500],
          invalid: [
            { value: 0.5, contains: ['attenuation_filter_cutoff_hz', 'at least 1 Hz'] },
            { value: 'invalid', contains: ['attenuation_filter_cutoff_hz', 'must be a number'] },
          ],
        },
        {
          prop: 'attenuation_filter_db',
          valid: [-80, -24, 0, 6],
          invalid: [{ value: 'invalid', contains: ['attenuation_filter_db', 'must be a number'] }],
        },
        {
          // DISABLED, IDLE_STEP, PHYSICS_STEP
          prop: 'doppler_tracking',
          valid: [0, 1, 2],
          invalid: [
            { value: 5, contains: ['doppler_tracking', '0-2'] },
            { value: -1, contains: ['doppler_tracking'] },
          ],
        },
        {
          // audio_stream_player_3d.cpp:777 enforces the floor only
          // (ERR_FAIL_COND_MSG(p_panning_strength < 0, ...)); the hint's ceiling
          // (:893, "0,3,0.01,or_greater") is open, so values above 1 are legal.
          prop: 'panning_strength',
          valid: [0, 0.5, 1, 1.5, 3, 10],
          invalid: [{ value: -0.1, contains: ['panning_strength', 'must be non-negative'] }],
        },
        {
          prop: 'area_mask',
          valid: [0, 1, 100, 1048575, 2000000, 2147483648, 4294967295],
          invalid: [
{ value: -1, contains: ['must be between 0 and 4294967295'] },
          ],
        },
        {
          prop: 'emission_angle_degrees',
          valid: [0, 45, 60, 90],
          with: { emission_angle_enabled: true },
          invalid: [
            { value: -10, contains: ['emission_angle_degrees', 'between 0 and 90'] },
            { value: 120, contains: ['emission_angle_degrees', 'between 0 and 90'] },
          ],
        },
        {
          prop: 'emission_angle_filter_attenuation_db',
          valid: [-24, -12, 0, 6],
          with: { emission_angle_enabled: true },
          invalid: [
            {
              value: 'invalid',
              contains: ['emission_angle_filter_attenuation_db', 'must be a number'],
            },
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
    describe('missing stream error', () => {
      it('should WARN, not error, when stream is missing', () => {
        // Godot defines no configuration warning for this and accepts the node
        // happily; a script may assign the stream at runtime.
        expectDiagnostic(bare({ volume_db: 0.0, pitch_scale: 1.0 }), {
          prop: 'stream',
          severity: 'warning',
          nodeType: 'AudioStreamPlayer3D',
          contains: ['no', 'stream'],
        });
      });

      it('should not error when stream is present', () => {
        expectNoErrors(withStream(), { prop: 'stream' });
      });

      it('stays silent when an AnimationPlayer audio track targets this node', () => {
        // animation_mixer.cpp:889-897 builds its own polyphonic playback for
        // the track's target and never reads the node's `stream`.
        expectClean(drivenByAudioTrack('Pickup'));
      });

      it('still warns when the audio track targets a DIFFERENT node', () => {
        expectDiagnostic(drivenByAudioTrack('SomeOtherNode'), {
          ruleName: 'audiostreamplayer3d-missing-stream',
          severity: 'warning',
          nodeType: 'AudioStreamPlayer3D',
        });
      });
    });

    describe('missing stream resource error', () => {
      it('should error when stream resource does not exist', () => {
        expectDiagnostic(bare({ stream: 'ExtResource("nonexistent")' }), {
          ruleName: 'audiostreamplayer3d-missing-stream-resource',
          severity: 'error',
          nodeType: 'AudioStreamPlayer3D',
          contains: ['does not exist', 'ExtResource("nonexistent")'],
        });
      });

      it('should not error when stream resource exists', () => {
        expectNoErrors(withStream(), { prop: 'does not exist' });
      });
    });

    describe('emission angle configuration warnings', () => {
      it('should warn when emission_angle_degrees is set without emission_angle_enabled', () => {
        expectDiagnostic(withStream({ emission_angle_degrees: 45.0 }), {
          ruleName: 'audiostreamplayer3d-emission-angle-not-enabled',
          severity: 'warning',
          nodeType: 'AudioStreamPlayer3D',
          contains: ['not true', 'no effect'],
        });
      });

      it('should not warn when emission_angle_degrees is set with emission_angle_enabled', () => {
        const warning = lint(
          withStream({ emission_angle_enabled: true, emission_angle_degrees: 45.0 })
        ).find(d => d.severity === 'warning' && d.message.includes('emission_angle_degrees'));
        expect(warning).toBeUndefined();
      });

      it('should warn when emission_angle_filter_attenuation_db is set without emission_angle_enabled', () => {
        expectDiagnostic(withStream({ emission_angle_filter_attenuation_db: -12.0 }), {
          ruleName: 'audiostreamplayer3d-emission-filter-not-enabled',
          severity: 'warning',
          nodeType: 'AudioStreamPlayer3D',
          contains: ['not true', 'no effect'],
        });
      });

      it('should not warn when emission_angle_filter_attenuation_db is set with emission_angle_enabled', () => {
        const warning = lint(
          withStream({ emission_angle_enabled: true, emission_angle_filter_attenuation_db: -12.0 })
        ).find(d => d.severity === 'warning' && d.message.includes('emission_angle_filter_attenuation_db'));
        expect(warning).toBeUndefined();
      });
    });

    // audio_stream_player_3d.cpp:883 — volume_db PROPERTY_HINT_RANGE "-80,80,suffix:dB".
    describe('volume_db warnings', () => {
      it('should warn below the hint', () => {
        expectDiagnostic(withStream({ volume_db: -90 }), {
          ruleName: 'audiostreamplayer3d-extreme-volume',
          severity: 'warning',
          nodeType: 'AudioStreamPlayer3D',
          contains: ['-90', '-80'],
        });
      });

      it('should warn above the hint', () => {
        expectDiagnostic(withStream({ volume_db: 100 }), {
          ruleName: 'audiostreamplayer3d-extreme-volume',
          severity: 'warning',
          nodeType: 'AudioStreamPlayer3D',
          contains: ['100', '80'],
        });
      });

      it.each([-80, -50, -6.0, 10, 80])('says nothing about volume_db %s', (volumeDb) => {
        const volumeWarning = lint(withStream({ volume_db: volumeDb })).find(d =>
          d.message.includes('Volume')
        );
        expect(volumeWarning).toBeUndefined();
      });
    });

    // audio_stream_player_3d.cpp:885 — unit_size PROPERTY_HINT_RANGE
    // "0.1,100,0.01,or_greater": the top end is open, and set_unit_size (:569) is a
    // bare assignment, so a non-positive unit size warns rather than erroring.
    describe('unit_size warnings', () => {
      it('should warn, not error, below the hint', () => {
        expectDiagnostic(withStream({ unit_size: 0 }), {
          ruleName: 'audiostreamplayer3d-small-unit-size',
          severity: 'warning',
          nodeType: 'AudioStreamPlayer3D',
          contains: ['unit_size', '0.1'],
        });
      });

      it.each([0.1, 10.0, 500])('says nothing about unit_size %s', (unitSize) => {
        expectClean(withStream({ unit_size: unitSize }));
      });
    });

    // pitch_scale: refused at <= 0 (audio_stream_player_internal.cpp:314), hinted
    // "0.01,4,0.01,or_greater" (:887), so only 0 < x < 0.01 warns.
    describe('pitch_scale warnings', () => {
      it('should warn below the hint', () => {
        expectDiagnostic(withStream({ pitch_scale: 0.005 }), {
          ruleName: 'audiostreamplayer3d-unusual-pitch',
          severity: 'warning',
          nodeType: 'AudioStreamPlayer3D',
          contains: ['0.005', '0.01'],
        });
      });

      it.each([0.01, 0.3, 1.2, 3.0])('says nothing about pitch_scale %s', (pitchScale) => {
        const pitchWarning = lint(withStream({ pitch_scale: pitchScale })).find(d =>
          d.message.includes('Pitch scale')
        );
        expect(pitchWarning).toBeUndefined();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle node with no properties', () => {
      const diagnostics = lint(bare());
      // Should have error for missing stream
      expect(diagnostics.length).toBeGreaterThan(0);
      const streamError = diagnostics.find(d => d.message.includes('stream'));
      expect(streamError).toBeDefined();
    });

    it('should handle all properties together', () => {
      expectClean(
        withStream({
          volume_db: 0.0,
          pitch_scale: 1.0,
          playing: false,
          autoplay: false,
          stream_paused: false,
          attenuation_model: 2,
          unit_size: 10.0,
          max_distance: 100.0,
          max_db: 3.0,
          attenuation_filter_cutoff_hz: 5000.0,
          attenuation_filter_db: -24.0,
          doppler_tracking: 0,
          panning_strength: 1.0,
          area_mask: 1,
          emission_angle_enabled: true,
          emission_angle_degrees: 45.0,
          emission_angle_filter_attenuation_db: -12.0,
          bus: '&"Master"',
          max_polyphony: 1,
        })
      );
    });

    it('should handle multiple validation errors', () => {
      const diagnostics = lint(bare({ pitch_scale: 0, unit_size: -5.0, max_polyphony: 0 }));
      // pitch_scale and max_polyphony are refused by the engine, so they error;
      // unit_size = -5 only warns now (audio_stream_player_3d.cpp:569 is a bare
      // assignment).
      expect(diagnostics.some(d => d.severity === 'error' && d.message.includes('pitch_scale'))).toBe(true);
      expect(diagnostics.some(d => d.severity === 'error' && d.message.includes('max_polyphony'))).toBe(true);
      expect(diagnostics.some(d => d.severity === 'error' && d.message.includes('unit_size'))).toBe(false);
    });

    it('should handle scientific notation in numeric values', () => {
      expectClean(
        withStream({
          volume_db: '-6e0',
          pitch_scale: '1.5e0',
          unit_size: '1e1',
          max_distance: '1e2',
        })
      );
    });

    it('should validate mixed warnings and errors', () => {
      const diagnostics = lint(withStream({ volume_db: -90, pitch_scale: 0.005 }));
      // Both sit below their hints.
      expect(diagnostics).toHaveLength(2);
      expect(diagnostics.every(d => d.severity === 'warning')).toBe(true);
    });

    it('should handle SubResource references', () => {
      expectClean(
        scene(
          '[sub_resource type="AudioStreamGenerator" id="gen_1"]',
          node(
            'AudioStreamPlayer3D',
            { stream: 'SubResource("gen_1")', volume_db: 0.0 },
            { name: 'AudioPlayer' }
          )
        )
      );
    });

    it('should handle boundary values for emission_angle_degrees', () => {
      expectClean(withStream({ emission_angle_enabled: true, emission_angle_degrees: 90 }));
    });

    it('should handle extreme combinations', () => {
      const diagnostics = lint(
        withStream({ volume_db: -90, pitch_scale: 0.005, emission_angle_degrees: 45.0 })
      );
      expect(diagnostics.map(d => d.ruleName).sort()).toEqual([
        'audiostreamplayer3d-emission-angle-not-enabled',
        'audiostreamplayer3d-extreme-volume',
        'audiostreamplayer3d-unusual-pitch',
      ]);
    });
  });
});
