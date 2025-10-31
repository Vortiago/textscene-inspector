/**
 * Tests for AudioStreamPlayer2D linter (strict parser + semantic rules)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../linter/Linter';
import './linterParser';
import './linter';

describe('AudioStreamPlayer2D Linter', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  describe('Strict Parser Validation (Format)', () => {
    it('should pass validation for valid AudioStreamPlayer2D properties', () => {
      const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://sound.ogg" id="1_abc"]

[node name="AudioPlayer" type="AudioStreamPlayer2D"]
stream = ExtResource("1_abc")
volume_db = 0.0
pitch_scale = 1.0
playing = false
autoplay = false
max_distance = 2000.0
attenuation = 1.0
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    describe('stream validation', () => {
      it('should accept valid ExtResource stream', () => {
        const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://sound.ogg" id="1_abc"]

[node name="AudioPlayer" type="AudioStreamPlayer2D"]
stream = ExtResource("1_abc")
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept valid SubResource stream', () => {
        const content = `[gd_scene format=3]

[sub_resource type="AudioStreamGenerator" id="1"]

[node name="AudioPlayer" type="AudioStreamPlayer2D"]
stream = SubResource("1")
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject invalid stream format', () => {
        const content = `[gd_scene format=3]

[node name="AudioPlayer" type="AudioStreamPlayer2D"]
stream = invalid_value
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('stream');
        expect(diagnostics[0].message).toContain('resource reference');
      });
    });

    describe('volume_db validation', () => {
      it('should accept valid volume_db values', () => {
        const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://sound.ogg" id="1_abc"]

[node name="AudioPlayer" type="AudioStreamPlayer2D"]
stream = ExtResource("1_abc")
volume_db = -6.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept negative volume_db', () => {
        const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://sound.ogg" id="1_abc"]

[node name="AudioPlayer" type="AudioStreamPlayer2D"]
stream = ExtResource("1_abc")
volume_db = -80.0
`;

        const diagnostics = linter.lint(content);
        // May have warning but no errors
        const errors = diagnostics.filter(d => d.severity === 'error');
        expect(errors).toHaveLength(0);
      });

      it('should reject invalid volume_db format', () => {
        const content = `[gd_scene format=3]

[node name="AudioPlayer" type="AudioStreamPlayer2D"]
volume_db = invalid
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('volume_db');
        expect(diagnostics[0].message).toContain('must be a number');
      });
    });

    describe('pitch_scale validation', () => {
      it('should accept valid pitch_scale values', () => {
        const validValues = [0.5, 1.0, 1.5, 2.0];
        for (const value of validValues) {
          const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://sound.ogg" id="1_abc"]

[node name="AudioPlayer" type="AudioStreamPlayer2D"]
stream = ExtResource("1_abc")
pitch_scale = ${value}
`;

          const diagnostics = linter.lint(content);
          const errors = diagnostics.filter(d => d.severity === 'error');
          expect(errors).toHaveLength(0);
        }
      });

      it('should reject zero pitch_scale', () => {
        const content = `[gd_scene format=3]

[node name="AudioPlayer" type="AudioStreamPlayer2D"]
pitch_scale = 0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('pitch_scale');
        expect(diagnostics[0].message).toContain('greater than 0');
      });

      it('should reject negative pitch_scale', () => {
        const content = `[gd_scene format=3]

[node name="AudioPlayer" type="AudioStreamPlayer2D"]
pitch_scale = -1.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('pitch_scale');
        expect(diagnostics[0].message).toContain('greater than 0');
      });

      it('should reject invalid pitch_scale format', () => {
        const content = `[gd_scene format=3]

[node name="AudioPlayer" type="AudioStreamPlayer2D"]
pitch_scale = invalid
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('pitch_scale');
        expect(diagnostics[0].message).toContain('must be a number');
      });
    });

    describe('boolean property validation', () => {
      it('should accept valid playing boolean', () => {
        const validValues = ['true', 'false'];
        for (const value of validValues) {
          const content = `[gd_scene format=3]

[node name="AudioPlayer" type="AudioStreamPlayer2D"]
playing = ${value}
`;

          const diagnostics = linter.lint(content);
          const errors = diagnostics.filter(d => d.severity === 'error' && d.message.includes('playing'));
          expect(errors).toHaveLength(0);
        }
      });

      it('should reject invalid playing value', () => {
        const content = `[gd_scene format=3]

[node name="AudioPlayer" type="AudioStreamPlayer2D"]
playing = yes
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('playing');
        expect(diagnostics[0].message).toContain('boolean');
      });

      it('should accept valid autoplay boolean', () => {
        const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://sound.ogg" id="1_abc"]

[node name="AudioPlayer" type="AudioStreamPlayer2D"]
stream = ExtResource("1_abc")
autoplay = true
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept valid stream_paused boolean', () => {
        const content = `[gd_scene format=3]

[node name="AudioPlayer" type="AudioStreamPlayer2D"]
stream_paused = false
`;

        const diagnostics = linter.lint(content);
        const errors = diagnostics.filter(d => d.severity === 'error' && d.message.includes('stream_paused'));
        expect(errors).toHaveLength(0);
      });
    });

    describe('max_distance validation', () => {
      it('should accept valid max_distance values', () => {
        const validValues = [10, 100, 1000, 5000];
        for (const value of validValues) {
          const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://sound.ogg" id="1_abc"]

[node name="AudioPlayer" type="AudioStreamPlayer2D"]
stream = ExtResource("1_abc")
max_distance = ${value}
`;

          const diagnostics = linter.lint(content);
          const errors = diagnostics.filter(d => d.severity === 'error');
          expect(errors).toHaveLength(0);
        }
      });

      it('should reject zero max_distance', () => {
        const content = `[gd_scene format=3]

[node name="AudioPlayer" type="AudioStreamPlayer2D"]
max_distance = 0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('max_distance');
        expect(diagnostics[0].message).toContain('greater than 0');
      });

      it('should reject negative max_distance', () => {
        const content = `[gd_scene format=3]

[node name="AudioPlayer" type="AudioStreamPlayer2D"]
max_distance = -10.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('max_distance');
        expect(diagnostics[0].message).toContain('greater than 0');
      });

      it('should reject invalid max_distance format', () => {
        const content = `[gd_scene format=3]

[node name="AudioPlayer" type="AudioStreamPlayer2D"]
max_distance = invalid
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('max_distance');
        expect(diagnostics[0].message).toContain('must be a number');
      });
    });

    describe('attenuation validation', () => {
      it('should accept valid attenuation values', () => {
        const validValues = [0.5, 1.0, 2.0, 5.0];
        for (const value of validValues) {
          const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://sound.ogg" id="1_abc"]

[node name="AudioPlayer" type="AudioStreamPlayer2D"]
stream = ExtResource("1_abc")
attenuation = ${value}
`;

          const diagnostics = linter.lint(content);
          const errors = diagnostics.filter(d => d.severity === 'error');
          expect(errors).toHaveLength(0);
        }
      });

      it('should reject zero attenuation', () => {
        const content = `[gd_scene format=3]

[node name="AudioPlayer" type="AudioStreamPlayer2D"]
attenuation = 0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('attenuation');
        expect(diagnostics[0].message).toContain('greater than 0');
      });

      it('should reject negative attenuation', () => {
        const content = `[gd_scene format=3]

[node name="AudioPlayer" type="AudioStreamPlayer2D"]
attenuation = -1.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('attenuation');
        expect(diagnostics[0].message).toContain('greater than 0');
      });

      it('should reject invalid attenuation format', () => {
        const content = `[gd_scene format=3]

[node name="AudioPlayer" type="AudioStreamPlayer2D"]
attenuation = invalid
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('attenuation');
        expect(diagnostics[0].message).toContain('must be a number');
      });
    });

    describe('panning_strength validation', () => {
      it('should accept valid panning_strength values', () => {
        const validValues = [0, 0.5, 1];
        for (const value of validValues) {
          const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://sound.ogg" id="1_abc"]

[node name="AudioPlayer" type="AudioStreamPlayer2D"]
stream = ExtResource("1_abc")
panning_strength = ${value}
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject panning_strength below 0', () => {
        const content = `[gd_scene format=3]

[node name="AudioPlayer" type="AudioStreamPlayer2D"]
panning_strength = -0.1
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('panning_strength');
        expect(diagnostics[0].message).toContain('between 0 and 1');
      });

      it('should reject panning_strength above 1', () => {
        const content = `[gd_scene format=3]

[node name="AudioPlayer" type="AudioStreamPlayer2D"]
panning_strength = 1.5
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('panning_strength');
        expect(diagnostics[0].message).toContain('between 0 and 1');
      });
    });

    describe('area_mask validation', () => {
      it('should accept valid area_mask values', () => {
        const validValues = [0, 1, 100, 1048575];
        for (const value of validValues) {
          const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://sound.ogg" id="1_abc"]

[node name="AudioPlayer" type="AudioStreamPlayer2D"]
stream = ExtResource("1_abc")
area_mask = ${value}
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject area_mask below 0', () => {
        const content = `[gd_scene format=3]

[node name="AudioPlayer" type="AudioStreamPlayer2D"]
area_mask = -1
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('area_mask');
        expect(diagnostics[0].message).toContain('between 0 and 1048575');
      });

      it('should reject area_mask exceeding maximum', () => {
        const content = `[gd_scene format=3]

[node name="AudioPlayer" type="AudioStreamPlayer2D"]
area_mask = 2000000
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('area_mask');
        expect(diagnostics[0].message).toContain('between 0 and 1048575');
      });
    });

    describe('playback_type validation', () => {
      it('should accept all valid playback types', () => {
        const validModes = [0, 1, 2]; // STREAM, SAMPLE, MAX
        for (const mode of validModes) {
          const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://sound.ogg" id="1_abc"]

[node name="AudioPlayer" type="AudioStreamPlayer2D"]
stream = ExtResource("1_abc")
playback_type = ${mode}
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject invalid playback_type value', () => {
        const content = `[gd_scene format=3]

[node name="AudioPlayer" type="AudioStreamPlayer2D"]
playback_type = 5
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('playback_type');
        expect(diagnostics[0].message).toContain('0-2');
      });

      it('should reject negative playback_type', () => {
        const content = `[gd_scene format=3]

[node name="AudioPlayer" type="AudioStreamPlayer2D"]
playback_type = -1
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('playback_type');
      });
    });

    describe('bus validation', () => {
      it('should accept valid bus string', () => {
        const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://sound.ogg" id="1_abc"]

[node name="AudioPlayer" type="AudioStreamPlayer2D"]
stream = ExtResource("1_abc")
bus = "Master"
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept StringName format for bus', () => {
        const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://sound.ogg" id="1_abc"]

[node name="AudioPlayer" type="AudioStreamPlayer2D"]
stream = ExtResource("1_abc")
bus = &"Master"
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject invalid bus format', () => {
        const content = `[gd_scene format=3]

[node name="AudioPlayer" type="AudioStreamPlayer2D"]
bus = InvalidValue
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('bus');
        expect(diagnostics[0].message).toContain('must be a string');
      });
    });

    describe('max_polyphony validation', () => {
      it('should accept valid max_polyphony values', () => {
        const validValues = [1, 4, 16, 32];
        for (const value of validValues) {
          const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://sound.ogg" id="1_abc"]

[node name="AudioPlayer" type="AudioStreamPlayer2D"]
stream = ExtResource("1_abc")
max_polyphony = ${value}
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject zero max_polyphony', () => {
        const content = `[gd_scene format=3]

[node name="AudioPlayer" type="AudioStreamPlayer2D"]
max_polyphony = 0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('max_polyphony');
        expect(diagnostics[0].message).toContain('at least 1');
      });

      it('should reject negative max_polyphony', () => {
        const content = `[gd_scene format=3]

[node name="AudioPlayer" type="AudioStreamPlayer2D"]
max_polyphony = -1
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('max_polyphony');
        expect(diagnostics[0].message).toContain('at least 1');
      });

      it('should reject invalid max_polyphony format', () => {
        const content = `[gd_scene format=3]

[node name="AudioPlayer" type="AudioStreamPlayer2D"]
max_polyphony = invalid
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('max_polyphony');
        expect(diagnostics[0].message).toContain('must be a number');
      });
    });
  });

  describe('Semantic Validation', () => {
    describe('missing stream error', () => {
      it('should error when stream is missing', () => {
        const content = `[gd_scene format=3]

[node name="AudioPlayer" type="AudioStreamPlayer2D"]
volume_db = 0.0
pitch_scale = 1.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.severity === 'error' && d.message.includes('stream'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('requires');
        expect(error?.message).toContain('audio');
      });

      it('should not error when stream is present', () => {
        const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://sound.ogg" id="1_abc"]

[node name="AudioPlayer" type="AudioStreamPlayer2D"]
stream = ExtResource("1_abc")
`;

        const diagnostics = linter.lint(content);
        const streamError = diagnostics.find(d => d.severity === 'error' && d.message.includes('stream'));
        expect(streamError).toBeUndefined();
      });
    });

    describe('missing stream resource error', () => {
      it('should error when stream resource does not exist', () => {
        const content = `[gd_scene format=3]

[node name="AudioPlayer" type="AudioStreamPlayer2D"]
stream = ExtResource("nonexistent")
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.severity === 'error' && d.message.includes('does not exist'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('ExtResource("nonexistent")');
      });

      it('should not error when stream resource exists', () => {
        const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://sound.ogg" id="1_abc"]

[node name="AudioPlayer" type="AudioStreamPlayer2D"]
stream = ExtResource("1_abc")
`;

        const diagnostics = linter.lint(content);
        const resourceError = diagnostics.find(d => d.severity === 'error' && d.message.includes('does not exist'));
        expect(resourceError).toBeUndefined();
      });
    });

    describe('autoplay without stream warning', () => {
      it('should warn when autoplay is enabled without stream', () => {
        const content = `[gd_scene format=3]

[node name="AudioPlayer" type="AudioStreamPlayer2D"]
autoplay = true
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const warning = diagnostics.find(d => d.severity === 'warning' && d.message.includes('autoplay'));
        expect(warning).toBeDefined();
        expect(warning?.message).toContain('no');
        expect(warning?.message).toContain('stream');
      });

      it('should not warn when autoplay is enabled with stream', () => {
        const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://sound.ogg" id="1_abc"]

[node name="AudioPlayer" type="AudioStreamPlayer2D"]
stream = ExtResource("1_abc")
autoplay = true
`;

        const diagnostics = linter.lint(content);
        const autoplayWarning = diagnostics.find(d => d.severity === 'warning' && d.message.includes('autoplay'));
        expect(autoplayWarning).toBeUndefined();
      });
    });

    describe('max_distance warnings', () => {
      it('should warn when max_distance is very small', () => {
        const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://sound.ogg" id="1_abc"]

[node name="AudioPlayer" type="AudioStreamPlayer2D"]
stream = ExtResource("1_abc")
max_distance = 5
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const warning = diagnostics.find(d => d.severity === 'warning' && d.message.includes('max_distance'));
        expect(warning).toBeDefined();
        expect(warning?.message).toContain('very small');
        expect(warning?.message).toContain('5');
      });

      it('should warn when max_distance is very large', () => {
        const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://sound.ogg" id="1_abc"]

[node name="AudioPlayer" type="AudioStreamPlayer2D"]
stream = ExtResource("1_abc")
max_distance = 15000
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const warning = diagnostics.find(d => d.severity === 'warning' && d.message.includes('max_distance'));
        expect(warning).toBeDefined();
        expect(warning?.message).toContain('very large');
        expect(warning?.message).toContain('15000');
      });

      it('should not warn on normal max_distance values', () => {
        const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://sound.ogg" id="1_abc"]

[node name="AudioPlayer" type="AudioStreamPlayer2D"]
stream = ExtResource("1_abc")
max_distance = 2000
`;

        const diagnostics = linter.lint(content);
        const distanceWarning = diagnostics.find(d => d.message.includes('max_distance'));
        expect(distanceWarning).toBeUndefined();
      });
    });

    describe('attenuation warnings', () => {
      it('should warn when attenuation is very flat', () => {
        const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://sound.ogg" id="1_abc"]

[node name="AudioPlayer" type="AudioStreamPlayer2D"]
stream = ExtResource("1_abc")
attenuation = 0.05
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const warning = diagnostics.find(d => d.severity === 'warning' && d.message.includes('attenuation'));
        expect(warning).toBeDefined();
        expect(warning?.message).toContain('very flat');
        expect(warning?.message).toContain('0.05');
      });

      it('should warn when attenuation is very steep', () => {
        const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://sound.ogg" id="1_abc"]

[node name="AudioPlayer" type="AudioStreamPlayer2D"]
stream = ExtResource("1_abc")
attenuation = 15
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const warning = diagnostics.find(d => d.severity === 'warning' && d.message.includes('attenuation'));
        expect(warning).toBeDefined();
        expect(warning?.message).toContain('very steep');
        expect(warning?.message).toContain('15');
      });

      it('should not warn on normal attenuation values', () => {
        const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://sound.ogg" id="1_abc"]

[node name="AudioPlayer" type="AudioStreamPlayer2D"]
stream = ExtResource("1_abc")
attenuation = 1.0
`;

        const diagnostics = linter.lint(content);
        const attenuationWarning = diagnostics.find(d => d.message.includes('attenuation'));
        expect(attenuationWarning).toBeUndefined();
      });
    });

    describe('volume_db warnings', () => {
      it('should warn on very low volume_db', () => {
        const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://sound.ogg" id="1_abc"]

[node name="AudioPlayer" type="AudioStreamPlayer2D"]
stream = ExtResource("1_abc")
volume_db = -70
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const warning = diagnostics.find(d => d.severity === 'warning' && d.message.includes('Volume'));
        expect(warning).toBeDefined();
        expect(warning?.message).toContain('very low');
        expect(warning?.message).toContain('-70');
      });

      it('should warn on very high volume_db', () => {
        const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://sound.ogg" id="1_abc"]

[node name="AudioPlayer" type="AudioStreamPlayer2D"]
stream = ExtResource("1_abc")
volume_db = 25
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const warning = diagnostics.find(d => d.severity === 'warning' && d.message.includes('Volume'));
        expect(warning).toBeDefined();
        expect(warning?.message).toContain('very high');
        expect(warning?.message).toContain('25');
      });

      it('should not warn on normal volume_db values', () => {
        const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://sound.ogg" id="1_abc"]

[node name="AudioPlayer" type="AudioStreamPlayer2D"]
stream = ExtResource("1_abc")
volume_db = -6.0
`;

        const diagnostics = linter.lint(content);
        const volumeWarning = diagnostics.find(d => d.message.includes('Volume'));
        expect(volumeWarning).toBeUndefined();
      });
    });

    describe('pitch_scale warnings', () => {
      it('should warn on very low pitch_scale', () => {
        const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://sound.ogg" id="1_abc"]

[node name="AudioPlayer" type="AudioStreamPlayer2D"]
stream = ExtResource("1_abc")
pitch_scale = 0.3
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const warning = diagnostics.find(d => d.severity === 'warning' && d.message.includes('Pitch scale'));
        expect(warning).toBeDefined();
        expect(warning?.message).toContain('very low');
        expect(warning?.message).toContain('0.3');
      });

      it('should warn on very high pitch_scale', () => {
        const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://sound.ogg" id="1_abc"]

[node name="AudioPlayer" type="AudioStreamPlayer2D"]
stream = ExtResource("1_abc")
pitch_scale = 3.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const warning = diagnostics.find(d => d.severity === 'warning' && d.message.includes('Pitch scale'));
        expect(warning).toBeDefined();
        expect(warning?.message).toContain('very high');
        expect(warning?.message).toContain('3');
      });

      it('should not warn on normal pitch_scale values', () => {
        const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://sound.ogg" id="1_abc"]

[node name="AudioPlayer" type="AudioStreamPlayer2D"]
stream = ExtResource("1_abc")
pitch_scale = 1.2
`;

        const diagnostics = linter.lint(content);
        const pitchWarning = diagnostics.find(d => d.message.includes('Pitch scale'));
        expect(pitchWarning).toBeUndefined();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle node with no properties', () => {
      const content = `[gd_scene format=3]

[node name="AudioPlayer" type="AudioStreamPlayer2D"]
`;

      const diagnostics = linter.lint(content);
      // Should have error for missing stream
      expect(diagnostics.length).toBeGreaterThan(0);
      const streamError = diagnostics.find(d => d.message.includes('stream'));
      expect(streamError).toBeDefined();
    });

    it('should handle all properties together', () => {
      const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://sound.ogg" id="1_abc"]

[node name="AudioPlayer" type="AudioStreamPlayer2D"]
stream = ExtResource("1_abc")
volume_db = 0.0
pitch_scale = 1.0
playing = false
autoplay = false
stream_paused = false
max_distance = 2000.0
attenuation = 1.0
panning_strength = 1.0
area_mask = 1
playback_type = 0
bus = &"Master"
max_polyphony = 1
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle multiple validation errors', () => {
      const content = `[gd_scene format=3]

[node name="AudioPlayer" type="AudioStreamPlayer2D"]
pitch_scale = 0
attenuation = -1.0
max_polyphony = 0
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(2);
      // Should have errors for: pitch_scale, attenuation, max_polyphony, missing stream
      const hasPitchError = diagnostics.some(d => d.message.includes('pitch_scale'));
      const hasAttenuationError = diagnostics.some(d => d.message.includes('attenuation'));
      const hasPolyphonyError = diagnostics.some(d => d.message.includes('max_polyphony'));
      const hasStreamError = diagnostics.some(d => d.message.includes('stream'));
      expect(hasPitchError || hasAttenuationError || hasPolyphonyError || hasStreamError).toBe(true);
    });

    it('should handle scientific notation in numeric values', () => {
      const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://sound.ogg" id="1_abc"]

[node name="AudioPlayer" type="AudioStreamPlayer2D"]
stream = ExtResource("1_abc")
volume_db = -6e0
pitch_scale = 1.5e0
max_distance = 2e3
attenuation = 1e0
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should validate mixed warnings and errors', () => {
      const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://sound.ogg" id="1_abc"]

[node name="AudioPlayer" type="AudioStreamPlayer2D"]
stream = ExtResource("1_abc")
volume_db = -70
pitch_scale = 0.3
max_distance = 5
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      // Should have warnings for extreme volume_db, pitch_scale, and max_distance
      const hasWarnings = diagnostics.some(d => d.severity === 'warning');
      expect(hasWarnings).toBe(true);
    });

    it('should handle SubResource references', () => {
      const content = `[gd_scene format=3]

[sub_resource type="AudioStreamGenerator" id="gen_1"]

[node name="AudioPlayer" type="AudioStreamPlayer2D"]
stream = SubResource("gen_1")
volume_db = 0.0
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle boundary values for panning_strength', () => {
      const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://sound.ogg" id="1_abc"]

[node name="AudioPlayer" type="AudioStreamPlayer2D"]
stream = ExtResource("1_abc")
panning_strength = 1.0
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle extreme combinations', () => {
      const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://sound.ogg" id="1_abc"]

[node name="AudioPlayer" type="AudioStreamPlayer2D"]
stream = ExtResource("1_abc")
volume_db = -70
pitch_scale = 0.3
max_distance = 5
attenuation = 15
`;

      const diagnostics = linter.lint(content);
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
      const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://sound.ogg" id="1_abc"]

[node name="AudioPlayer" type="AudioStreamPlayer2D"]
stream = ExtResource("1_abc")
pitch_scale = 0
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      // Should have error from both format validator and semantic validator
      const pitchErrors = diagnostics.filter(d => d.message.includes('pitch_scale'));
      expect(pitchErrors.length).toBeGreaterThan(0);
    });
  });
});
