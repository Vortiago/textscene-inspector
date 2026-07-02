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
          // Extreme-but-valid volume legitimately warns — assert no errors only.
          prop: 'volume_db',
          acceptMode: 'no-error',
          valid: [-80.0],
        },
        {
          prop: 'pitch_scale',
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
          prop: 'max_distance',
          valid: [10, 100, 1000, 5000],
          invalid: [
            { value: 0, contains: ['max_distance', 'greater than 0'] },
            { value: -10.0, contains: ['max_distance', 'greater than 0'] },
            { value: 'invalid', contains: ['max_distance', 'must be a number'] },
          ],
        },
        {
          prop: 'attenuation',
          valid: [0.5, 1.0, 2.0, 5.0],
          invalid: [
            { value: 0, contains: ['attenuation', 'greater than 0'] },
            { value: -1.0, contains: ['attenuation', 'greater than 0'] },
            { value: 'invalid', contains: ['attenuation', 'must be a number'] },
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
          valid: [0, 1, 100, 1048575],
          invalid: [
            { value: -1, contains: ['area_mask', 'between 0 and 1048575'] },
            { value: 2000000, contains: ['area_mask', 'between 0 and 1048575'] },
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
    describe('missing stream error', () => {
      it('should error when stream is missing', () => {
        expectDiagnostic(bare({ volume_db: 0.0, pitch_scale: 1.0 }), {
          ruleName: 'audiostreamplayer2d-missing-stream',
          severity: 'error',
          nodeType: 'AudioStreamPlayer2D',
          contains: ['requires', 'audio'],
        });
      });

      it('should not error when stream is present', () => {
        expectClean(withStream());
      });
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
    });

    describe('max_distance warnings', () => {
      it('should warn when max_distance is very small', () => {
        expectDiagnostic(withStream({ max_distance: 5 }), {
          ruleName: 'audiostreamplayer2d-small-max-distance',
          severity: 'warning',
          nodeType: 'AudioStreamPlayer2D',
          contains: ['max_distance', 'very small', '5'],
        });
      });

      it('should warn when max_distance is very large', () => {
        expectDiagnostic(withStream({ max_distance: 15000 }), {
          ruleName: 'audiostreamplayer2d-large-max-distance',
          severity: 'warning',
          nodeType: 'AudioStreamPlayer2D',
          contains: ['max_distance', 'very large', '15000'],
        });
      });

      it('should not warn on normal max_distance values', () => {
        expectClean(withStream({ max_distance: 2000 }));
      });
    });

    describe('attenuation warnings', () => {
      it('should warn when attenuation is very flat', () => {
        expectDiagnostic(withStream({ attenuation: 0.05 }), {
          ruleName: 'audiostreamplayer2d-flat-attenuation',
          severity: 'warning',
          nodeType: 'AudioStreamPlayer2D',
          contains: ['attenuation', 'very flat', '0.05'],
        });
      });

      it('should warn when attenuation is very steep', () => {
        expectDiagnostic(withStream({ attenuation: 15 }), {
          ruleName: 'audiostreamplayer2d-steep-attenuation',
          severity: 'warning',
          nodeType: 'AudioStreamPlayer2D',
          contains: ['attenuation', 'very steep', '15'],
        });
      });

      it('should not warn on normal attenuation values', () => {
        expectClean(withStream({ attenuation: 1.0 }));
      });
    });

    describe('volume_db warnings', () => {
      it('should warn on very low volume_db', () => {
        expectDiagnostic(withStream({ volume_db: -70 }), {
          ruleName: 'audiostreamplayer2d-extreme-volume',
          severity: 'warning',
          nodeType: 'AudioStreamPlayer2D',
          contains: ['Volume', 'very low', '-70'],
        });
      });

      it('should warn on very high volume_db', () => {
        expectDiagnostic(withStream({ volume_db: 25 }), {
          ruleName: 'audiostreamplayer2d-extreme-volume',
          severity: 'warning',
          nodeType: 'AudioStreamPlayer2D',
          contains: ['Volume', 'very high', '25'],
        });
      });

      it('should not warn on normal volume_db values', () => {
        expectClean(withStream({ volume_db: -6.0 }));
      });
    });

    describe('pitch_scale warnings', () => {
      it('should warn on very low pitch_scale', () => {
        expectDiagnostic(withStream({ pitch_scale: 0.3 }), {
          ruleName: 'audiostreamplayer2d-unusual-pitch',
          severity: 'warning',
          nodeType: 'AudioStreamPlayer2D',
          contains: ['Pitch scale', 'very low', '0.3'],
        });
      });

      it('should warn on very high pitch_scale', () => {
        expectDiagnostic(withStream({ pitch_scale: 3.0 }), {
          ruleName: 'audiostreamplayer2d-unusual-pitch',
          severity: 'warning',
          nodeType: 'AudioStreamPlayer2D',
          contains: ['Pitch scale', 'very high', '3'],
        });
      });

      it('should not warn on normal pitch_scale values', () => {
        expectClean(withStream({ pitch_scale: 1.2 }));
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle node with no properties', () => {
      // Should have error for missing stream
      expectDiagnostic(bare(), { prop: 'stream' });
    });

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
      expect(diagnostics.length).toBeGreaterThan(2);
      // Should have errors for: pitch_scale, attenuation, max_polyphony, missing stream
      const hasPitchError = diagnostics.some(d => d.message.includes('pitch_scale'));
      const hasAttenuationError = diagnostics.some(d => d.message.includes('attenuation'));
      const hasPolyphonyError = diagnostics.some(d => d.message.includes('max_polyphony'));
      const hasStreamError = diagnostics.some(d => d.message.includes('stream'));
      expect(hasPitchError || hasAttenuationError || hasPolyphonyError || hasStreamError).toBe(true);
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
      const diagnostics = lint(withStream({ volume_db: -70, pitch_scale: 0.3, max_distance: 5 }));
      expect(diagnostics.length).toBeGreaterThan(0);
      // Should have warnings for extreme volume_db, pitch_scale, and max_distance
      const hasWarnings = diagnostics.some(d => d.severity === 'warning');
      expect(hasWarnings).toBe(true);
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
        withStream({ volume_db: -70, pitch_scale: 0.3, max_distance: 5, attenuation: 15 })
      );
      expect(diagnostics.length).toBeGreaterThan(3);
      // Should have warnings for volume, pitch, max_distance, and attenuation
      const volumeWarning = diagnostics.find(d => d.message.includes('Volume') && d.message.includes('very low'));
      const pitchWarning = diagnostics.find(d => d.message.includes('Pitch scale') && d.message.includes('very low'));
      const distanceWarning = diagnostics.find(d => d.message.includes('max_distance') && d.message.includes('very small'));
      const attenuationWarning = diagnostics.find(d => d.message.includes('attenuation') && d.message.includes('very steep'));
      expect(volumeWarning).toBeDefined();
      expect(pitchWarning).toBeDefined();
      expect(distanceWarning).toBeDefined();
      expect(attenuationWarning).toBeDefined();
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
