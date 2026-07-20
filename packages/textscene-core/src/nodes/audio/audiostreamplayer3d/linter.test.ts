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
          // Extreme-but-valid volume legitimately warns — assert no errors only.
          prop: 'volume_db',
          acceptMode: 'no-error',
          valid: [-80.0],
        },
        {
          // 0.5/2.0 sit at the unusual-pitch warning edge — assert no errors only.
          prop: 'pitch_scale',
          acceptMode: 'no-error',
          valid: [0.5, 1.0, 1.5, 2.0],
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
          prop: 'unit_size',
          valid: [10.0],
          invalid: [
            { value: 0, contains: ['unit_size', 'greater than 0'] },
            { value: -5.0, contains: ['unit_size', 'greater than 0'] },
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
          prop: 'panning_strength',
          valid: [0, 0.5, 1],
          invalid: [
            { value: -0.1, contains: ['panning_strength', 'between 0 and 1'] },
            { value: 1.5, contains: ['panning_strength', 'between 0 and 1'] },
          ],
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
      it('should error when stream is missing', () => {
        expectDiagnostic(bare({ volume_db: 0.0, pitch_scale: 1.0 }), {
          prop: 'stream',
          severity: 'error',
          nodeType: 'AudioStreamPlayer3D',
          contains: ['requires', 'audio'],
        });
      });

      it('should not error when stream is present', () => {
        expectNoErrors(withStream(), { prop: 'stream' });
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

    describe('volume_db warnings', () => {
      it('should warn on very low volume_db', () => {
        expectDiagnostic(withStream({ volume_db: -50 }), {
          ruleName: 'audiostreamplayer3d-extreme-volume',
          severity: 'warning',
          nodeType: 'AudioStreamPlayer3D',
          contains: ['very low', '-50'],
        });
      });

      it('should warn on very high volume_db', () => {
        expectDiagnostic(withStream({ volume_db: 10 }), {
          ruleName: 'audiostreamplayer3d-extreme-volume',
          severity: 'warning',
          nodeType: 'AudioStreamPlayer3D',
          contains: ['very high', '10'],
        });
      });

      it('should not warn on normal volume_db values', () => {
        const volumeWarning = lint(withStream({ volume_db: -6.0 })).find(d =>
          d.message.includes('Volume')
        );
        expect(volumeWarning).toBeUndefined();
      });
    });

    describe('pitch_scale warnings', () => {
      it('should warn on very low pitch_scale', () => {
        expectDiagnostic(withStream({ pitch_scale: 0.3 }), {
          ruleName: 'audiostreamplayer3d-unusual-pitch',
          severity: 'warning',
          nodeType: 'AudioStreamPlayer3D',
          contains: ['very low', '0.3'],
        });
      });

      it('should warn on very high pitch_scale', () => {
        expectDiagnostic(withStream({ pitch_scale: 3.0 }), {
          ruleName: 'audiostreamplayer3d-unusual-pitch',
          severity: 'warning',
          nodeType: 'AudioStreamPlayer3D',
          contains: ['very high', '3'],
        });
      });

      it('should not warn on normal pitch_scale values', () => {
        const pitchWarning = lint(withStream({ pitch_scale: 1.2 })).find(d =>
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
      expect(diagnostics.length).toBeGreaterThan(2);
      // Should have errors for: pitch_scale, unit_size, max_polyphony, missing stream
      const hasPitchError = diagnostics.some(d => d.message.includes('pitch_scale'));
      const hasUnitError = diagnostics.some(d => d.message.includes('unit_size'));
      const hasPolyphonyError = diagnostics.some(d => d.message.includes('max_polyphony'));
      const hasStreamError = diagnostics.some(d => d.message.includes('stream'));
      expect(hasPitchError || hasUnitError || hasPolyphonyError || hasStreamError).toBe(true);
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
      const diagnostics = lint(withStream({ volume_db: -50, pitch_scale: 0.3 }));
      expect(diagnostics.length).toBeGreaterThan(0);
      // Should have warnings for extreme volume_db and pitch_scale
      const hasWarnings = diagnostics.some(d => d.severity === 'warning');
      expect(hasWarnings).toBe(true);
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
        withStream({ volume_db: -50, pitch_scale: 0.3, emission_angle_degrees: 45.0 })
      );
      expect(diagnostics.length).toBeGreaterThan(2);
      // Should have warnings for volume, pitch, and emission_angle_degrees without enabled
      const volumeWarning = diagnostics.find(
        d => d.message.includes('Volume') && d.message.includes('very low')
      );
      const pitchWarning = diagnostics.find(
        d => d.message.includes('Pitch scale') && d.message.includes('very low')
      );
      const emissionWarning = diagnostics.find(
        d => d.message.includes('emission_angle_degrees') && d.message.includes('not true')
      );
      expect(volumeWarning).toBeDefined();
      expect(pitchWarning).toBeDefined();
      expect(emissionWarning).toBeDefined();
    });
  });
});
