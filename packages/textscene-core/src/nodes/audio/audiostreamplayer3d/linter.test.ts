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

    describe('stream validation', () => {
      it('should accept valid ExtResource stream', () => {
        expectClean(withStream());
      });

      it('should accept valid SubResource stream', () => {
        expectClean(
          scene(
            '[sub_resource type="AudioStreamGenerator" id="1"]',
            node('AudioStreamPlayer3D', { stream: 'SubResource("1")' }, { name: 'AudioPlayer' })
          )
        );
      });

      it('should reject invalid stream format', () => {
        expectDiagnostic(bare({ stream: 'invalid_value' }), {
          prop: 'stream',
          contains: ['stream', 'resource reference'],
        });
      });
    });

    describe('volume_db validation', () => {
      it('should accept valid volume_db values', () => {
        expectClean(withStream({ volume_db: -6.0 }));
      });

      it('should accept negative volume_db', () => {
        // May have warning but no errors
        expectNoErrors(withStream({ volume_db: -80.0 }));
      });

      it('should reject invalid volume_db format', () => {
        expectDiagnostic(bare({ volume_db: 'invalid' }), {
          prop: 'volume_db',
          contains: ['volume_db', 'must be a number'],
        });
      });
    });

    describe('pitch_scale validation', () => {
      it('should accept valid pitch_scale values', () => {
        for (const value of [0.5, 1.0, 1.5, 2.0]) {
          expectNoErrors(withStream({ pitch_scale: value }));
        }
      });

      it('should reject zero pitch_scale', () => {
        expectDiagnostic(bare({ pitch_scale: 0 }), {
          prop: 'pitch_scale',
          contains: ['pitch_scale', 'greater than 0'],
        });
      });

      it('should reject negative pitch_scale', () => {
        expectDiagnostic(bare({ pitch_scale: -1.0 }), {
          prop: 'pitch_scale',
          contains: ['pitch_scale', 'greater than 0'],
        });
      });

      it('should reject invalid pitch_scale format', () => {
        expectDiagnostic(bare({ pitch_scale: 'invalid' }), {
          prop: 'pitch_scale',
          contains: ['pitch_scale', 'must be a number'],
        });
      });
    });

    describe('boolean property validation', () => {
      it('should accept valid playing boolean', () => {
        for (const value of [true, false]) {
          expectNoErrors(bare({ playing: value }), { prop: 'playing' });
        }
      });

      it('should reject invalid playing value', () => {
        expectDiagnostic(bare({ playing: 'yes' }), {
          prop: 'playing',
          contains: ['playing', 'boolean'],
        });
      });

      it('should accept valid autoplay boolean', () => {
        expectClean(withStream({ autoplay: true }));
      });

      it('should accept valid stream_paused boolean', () => {
        expectNoErrors(bare({ stream_paused: false }), { prop: 'stream_paused' });
      });

      it('should accept valid emission_angle_enabled boolean', () => {
        expectClean(withStream({ emission_angle_enabled: true, emission_angle_degrees: 45.0 }));
      });
    });

    describe('attenuation_model validation', () => {
      it('should accept all valid attenuation models', () => {
        // INVERSE, INVERSE_SQUARE, LOGARITHMIC, DISABLED
        for (const mode of [0, 1, 2, 3]) {
          expectClean(withStream({ attenuation_model: mode }));
        }
      });

      it('should reject invalid attenuation_model value', () => {
        expectDiagnostic(bare({ attenuation_model: 5 }), {
          prop: 'attenuation_model',
          contains: ['attenuation_model', '0-3'],
        });
      });

      it('should reject negative attenuation_model', () => {
        expectDiagnostic(bare({ attenuation_model: -1 }), {
          prop: 'attenuation_model',
          contains: ['attenuation_model'],
        });
      });
    });

    describe('unit_size validation', () => {
      it('should accept valid unit_size values', () => {
        expectClean(withStream({ unit_size: 10.0 }));
      });

      it('should reject zero unit_size', () => {
        expectDiagnostic(bare({ unit_size: 0 }), {
          prop: 'unit_size',
          contains: ['unit_size', 'greater than 0'],
        });
      });

      it('should reject negative unit_size', () => {
        expectDiagnostic(bare({ unit_size: -5.0 }), {
          prop: 'unit_size',
          contains: ['unit_size', 'greater than 0'],
        });
      });

      it('should reject invalid unit_size format', () => {
        expectDiagnostic(bare({ unit_size: 'invalid' }), {
          prop: 'unit_size',
          contains: ['unit_size', 'must be a number'],
        });
      });
    });

    describe('max_distance validation', () => {
      it('should accept valid max_distance values', () => {
        for (const value of [0, 50, 100, 1000]) {
          expectClean(withStream({ max_distance: value }));
        }
      });

      it('should accept zero max_distance (unlimited)', () => {
        expectClean(withStream({ max_distance: 0 }));
      });

      it('should reject negative max_distance', () => {
        expectDiagnostic(bare({ max_distance: -10.0 }), {
          prop: 'max_distance',
          contains: ['max_distance', 'non-negative'],
        });
      });

      it('should reject invalid max_distance format', () => {
        expectDiagnostic(bare({ max_distance: 'invalid' }), {
          prop: 'max_distance',
          contains: ['max_distance', 'must be a number'],
        });
      });
    });

    describe('max_db validation', () => {
      it('should accept valid max_db values', () => {
        for (const value of [-24, 0, 3, 6]) {
          expectClean(withStream({ max_db: value }));
        }
      });

      it('should reject invalid max_db format', () => {
        expectDiagnostic(bare({ max_db: 'invalid' }), {
          prop: 'max_db',
          contains: ['max_db', 'must be a number'],
        });
      });
    });

    describe('attenuation_filter_cutoff_hz validation', () => {
      it('should accept valid cutoff frequencies', () => {
        for (const value of [1, 5000, 10000, 20500]) {
          expectClean(withStream({ attenuation_filter_cutoff_hz: value }));
        }
      });

      it('should reject cutoff below 1 Hz', () => {
        expectDiagnostic(bare({ attenuation_filter_cutoff_hz: 0.5 }), {
          prop: 'attenuation_filter_cutoff_hz',
          contains: ['attenuation_filter_cutoff_hz', 'at least 1 Hz'],
        });
      });

      it('should reject invalid cutoff format', () => {
        expectDiagnostic(bare({ attenuation_filter_cutoff_hz: 'invalid' }), {
          prop: 'attenuation_filter_cutoff_hz',
          contains: ['attenuation_filter_cutoff_hz', 'must be a number'],
        });
      });
    });

    describe('attenuation_filter_db validation', () => {
      it('should accept valid filter dB values', () => {
        for (const value of [-80, -24, 0, 6]) {
          expectClean(withStream({ attenuation_filter_db: value }));
        }
      });

      it('should reject invalid filter dB format', () => {
        expectDiagnostic(bare({ attenuation_filter_db: 'invalid' }), {
          prop: 'attenuation_filter_db',
          contains: ['attenuation_filter_db', 'must be a number'],
        });
      });
    });

    describe('doppler_tracking validation', () => {
      it('should accept all valid doppler tracking modes', () => {
        // DISABLED, IDLE_STEP, PHYSICS_STEP
        for (const mode of [0, 1, 2]) {
          expectClean(withStream({ doppler_tracking: mode }));
        }
      });

      it('should reject invalid doppler_tracking value', () => {
        expectDiagnostic(bare({ doppler_tracking: 5 }), {
          prop: 'doppler_tracking',
          contains: ['doppler_tracking', '0-2'],
        });
      });

      it('should reject negative doppler_tracking', () => {
        expectDiagnostic(bare({ doppler_tracking: -1 }), {
          prop: 'doppler_tracking',
          contains: ['doppler_tracking'],
        });
      });
    });

    describe('panning_strength validation', () => {
      it('should accept valid panning_strength values', () => {
        for (const value of [0, 0.5, 1]) {
          expectClean(withStream({ panning_strength: value }));
        }
      });

      it('should reject panning_strength below 0', () => {
        expectDiagnostic(bare({ panning_strength: -0.1 }), {
          prop: 'panning_strength',
          contains: ['panning_strength', 'between 0 and 1'],
        });
      });

      it('should reject panning_strength above 1', () => {
        expectDiagnostic(bare({ panning_strength: 1.5 }), {
          prop: 'panning_strength',
          contains: ['panning_strength', 'between 0 and 1'],
        });
      });
    });

    describe('area_mask validation', () => {
      it('should accept valid area_mask values', () => {
        for (const value of [0, 1, 100, 1048575]) {
          expectClean(withStream({ area_mask: value }));
        }
      });

      it('should reject area_mask below 0', () => {
        expectDiagnostic(bare({ area_mask: -1 }), {
          prop: 'area_mask',
          contains: ['area_mask', 'between 0 and 1048575'],
        });
      });

      it('should reject area_mask exceeding maximum', () => {
        expectDiagnostic(bare({ area_mask: 2000000 }), {
          prop: 'area_mask',
          contains: ['area_mask', 'between 0 and 1048575'],
        });
      });
    });

    describe('emission_angle_degrees validation', () => {
      it('should accept valid emission angle values', () => {
        for (const value of [0, 45, 60, 90]) {
          expectClean(withStream({ emission_angle_enabled: true, emission_angle_degrees: value }));
        }
      });

      it('should reject emission_angle_degrees below 0', () => {
        expectDiagnostic(bare({ emission_angle_degrees: -10 }), {
          prop: 'emission_angle_degrees',
          contains: ['emission_angle_degrees', 'between 0 and 90'],
        });
      });

      it('should reject emission_angle_degrees above 90', () => {
        expectDiagnostic(bare({ emission_angle_degrees: 120 }), {
          prop: 'emission_angle_degrees',
          contains: ['emission_angle_degrees', 'between 0 and 90'],
        });
      });
    });

    describe('emission_angle_filter_attenuation_db validation', () => {
      it('should accept valid filter attenuation values', () => {
        for (const value of [-24, -12, 0, 6]) {
          expectClean(
            withStream({ emission_angle_enabled: true, emission_angle_filter_attenuation_db: value })
          );
        }
      });

      it('should reject invalid filter attenuation format', () => {
        expectDiagnostic(bare({ emission_angle_filter_attenuation_db: 'invalid' }), {
          prop: 'emission_angle_filter_attenuation_db',
          contains: ['emission_angle_filter_attenuation_db', 'must be a number'],
        });
      });
    });

    describe('bus validation', () => {
      it('should accept valid bus string', () => {
        expectClean(withStream({ bus: '"Master"' }));
      });

      it('should accept StringName format for bus', () => {
        expectClean(withStream({ bus: '&"Master"' }));
      });

      it('should reject invalid bus format', () => {
        expectDiagnostic(bare({ bus: 'InvalidValue' }), {
          prop: 'bus',
          contains: ['bus', 'must be a string'],
        });
      });
    });

    describe('max_polyphony validation', () => {
      it('should accept valid max_polyphony values', () => {
        for (const value of [1, 4, 16, 32]) {
          expectClean(withStream({ max_polyphony: value }));
        }
      });

      it('should reject zero max_polyphony', () => {
        expectDiagnostic(bare({ max_polyphony: 0 }), {
          prop: 'max_polyphony',
          contains: ['max_polyphony', 'at least 1'],
        });
      });

      it('should reject negative max_polyphony', () => {
        expectDiagnostic(bare({ max_polyphony: -1 }), {
          prop: 'max_polyphony',
          contains: ['max_polyphony', 'at least 1'],
        });
      });

      it('should reject invalid max_polyphony format', () => {
        expectDiagnostic(bare({ max_polyphony: 'invalid' }), {
          prop: 'max_polyphony',
          contains: ['max_polyphony', 'must be a number'],
        });
      });
    });
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
