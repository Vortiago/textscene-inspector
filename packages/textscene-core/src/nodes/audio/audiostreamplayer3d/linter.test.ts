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
          // 2D/base players — and set_volume_db (:552-554) only refuses NaN.
          prop: 'volume_db',
          valid: [-80.0, 0, 80],
          invalid: [
            { value: -80.1, contains: ['volume_db', 'between -80 and 80'], severity: 'warning' },
            { value: 80.1, contains: ['volume_db', 'between -80 and 80'], severity: 'warning' },
          ],
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
          // audio_stream_player_3d.cpp:569-570 is a bare assignment, so the hint at
          // :885 ("0.1,100,0.01,or_greater") only warns; or_greater leaves 500 legal.
          prop: 'unit_size',
          valid: [0.1, 10.0, 500],
          invalid: [
            { value: 0.09, contains: ['unit_size', '>= 0.1'], severity: 'warning' },
            { value: 0, contains: ['unit_size', '>= 0.1'], severity: 'warning' },
            { value: -5.0, contains: ['unit_size', '>= 0.1'], severity: 'warning' },
            { value: 'invalid', contains: ['unit_size', 'must be a number'] },
          ],
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
          // audio_stream_player_3d.cpp:886 hints "-24,6,suffix:dB", closed at both
          // ends; set_max_db (:578-579) is a bare assignment, so outside it warns.
          prop: 'max_db',
          valid: [-24, 0, 3, 6],
          invalid: [
            { value: -24.1, contains: ['max_db', 'between -24 and 6'], severity: 'warning' },
            { value: 6.1, contains: ['max_db', 'between -24 and 6'], severity: 'warning' },
            { value: 'invalid', contains: ['max_db', 'must be a number'] },
          ],
        },
        {
          // audio_stream_player_3d.cpp:704 assigns straight through, so the
          // hint at :902 ("1,20500,1,suffix:Hz") only warns — at both ends.
          prop: 'attenuation_filter_cutoff_hz',
          valid: [1, 5000, 10000, 20500],
          invalid: [
            {
              value: 0.5,
              contains: ['attenuation_filter_cutoff_hz', 'between 1 and 20500'],
              severity: 'warning',
            },
            {
              value: 20501,
              contains: ['attenuation_filter_cutoff_hz', 'between 1 and 20500'],
              severity: 'warning',
            },
            { value: 'invalid', contains: ['attenuation_filter_cutoff_hz', 'must be a number'] },
          ],
        },
        {
          // audio_stream_player_3d.cpp:903 hints "-80,0,0.1,suffix:dB", closed at
          // both ends; set_attenuation_filter_db (:712-713) is a bare assignment.
          prop: 'attenuation_filter_db',
          valid: [-80, -24, 0],
          invalid: [
            {
              value: -80.1,
              contains: ['attenuation_filter_db', 'between -80 and 0'],
              severity: 'warning',
            },
            {
              value: 0.1,
              contains: ['attenuation_filter_db', 'between -80 and 0'],
              severity: 'warning',
            },
            { value: 'invalid', contains: ['attenuation_filter_db', 'must be a number'] },
          ],
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
{ value: 4294967296, contains: ['cannot be stored in an integer slot'], severity: 'error' },
          ],
        },
        {
          // Two tiers: audio_stream_player_3d.cpp:687 refuses below 0 and above
          // 90, the :899 hint "0.1,90,0.1,degrees" excludes [0, 0.1) as well.
          prop: 'emission_angle_degrees',
          valid: [0.1, 45, 60, 90],
          with: { emission_angle_enabled: true },
          invalid: [
            { value: 0.05, contains: ['emission_angle_degrees', 'between 0.1 and 90'], severity: 'warning' },
            { value: -10, contains: ['emission_angle_degrees', 'at least 0'] },
            { value: 120, contains: ['emission_angle_degrees', 'between 0.1 and 90'] },
          ],
        },
        {
          // audio_stream_player_3d.cpp:900 hints "-80,0,0.1,suffix:dB", closed at
          // both ends; set_emission_angle_filter_attenuation_db (:696-697) is a
          // bare assignment.
          prop: 'emission_angle_filter_attenuation_db',
          valid: [-80, -24, -12, 0],
          with: { emission_angle_enabled: true },
          invalid: [
            {
              value: -80.1,
              contains: ['emission_angle_filter_attenuation_db', 'between -80 and 0'],
              // Pinned to the validator: the emission-filter-not-enabled rule
              // names the same property and also warns on this scene.
              ruleName: 'strict-parser',
              severity: 'warning',
            },
            {
              value: 0.1,
              contains: ['emission_angle_filter_attenuation_db', 'between -80 and 0'],
              ruleName: 'strict-parser',
              severity: 'warning',
            },
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
    it('stays quiet about a streamless player (the stream may arrive at runtime)', () => {
      expectClean(bare({ volume_db: 0.0, pitch_scale: 1.0 }));
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

    // volume_db and unit_size carry their hint bands on their validators
    // (linterParser.ts); no rule reports them, so the accept/reject table above
    // is where their ends are pinned.

    // pitch_scale: refused at <= 0 (audio_stream_player_internal.cpp:314), hinted
    // "0.01,4,0.01,or_greater" (:887), so only 0 < x < 0.01 warns.
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
        const pitchWarning = lint(withStream({ pitch_scale: pitchScale })).find(d =>
          d.message.includes('pitch_scale')
        );
        expect(pitchWarning).toBeUndefined();
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
      // volume_db's and pitch_scale's warnings are their validators', so both
      // arrive as `strict-parser`.
      expect(diagnostics.map(d => d.ruleName).sort()).toEqual([
        'audiostreamplayer3d-emission-angle-not-enabled',
        'strict-parser',
        'strict-parser',
      ]);
      expect(diagnostics.every(d => d.severity === 'warning')).toBe(true);
    });
  });
});
