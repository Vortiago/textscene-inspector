/**
 * Tests for AudioStreamPlayer3D linter (strict parser + semantic rules)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../linter/Linter';
import './linterParser';
import './linter';

describe('AudioStreamPlayer3D Linter', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  describe('Strict Parser Validation (Format)', () => {
    it('should pass validation for valid AudioStreamPlayer3D properties', () => {
      const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://sound.ogg" id="1_abc"]

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
stream = ExtResource("1_abc")
volume_db = 0.0
pitch_scale = 1.0
playing = false
autoplay = false
unit_size = 10.0
max_distance = 100.0
attenuation_model = 0
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    describe('stream validation', () => {
      it('should accept valid ExtResource stream', () => {
        const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://sound.ogg" id="1_abc"]

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
stream = ExtResource("1_abc")
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept valid SubResource stream', () => {
        const content = `[gd_scene format=3]

[sub_resource type="AudioStreamGenerator" id="1"]

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
stream = SubResource("1")
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject invalid stream format', () => {
        const content = `[gd_scene format=3]

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
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

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
stream = ExtResource("1_abc")
volume_db = -6.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept negative volume_db', () => {
        const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://sound.ogg" id="1_abc"]

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
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

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
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

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
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

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
pitch_scale = 0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('pitch_scale');
        expect(diagnostics[0].message).toContain('greater than 0');
      });

      it('should reject negative pitch_scale', () => {
        const content = `[gd_scene format=3]

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
pitch_scale = -1.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('pitch_scale');
        expect(diagnostics[0].message).toContain('greater than 0');
      });

      it('should reject invalid pitch_scale format', () => {
        const content = `[gd_scene format=3]

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
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

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
playing = ${value}
`;

          const diagnostics = linter.lint(content);
          const errors = diagnostics.filter(d => d.severity === 'error' && d.message.includes('playing'));
          expect(errors).toHaveLength(0);
        }
      });

      it('should reject invalid playing value', () => {
        const content = `[gd_scene format=3]

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
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

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
stream = ExtResource("1_abc")
autoplay = true
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept valid stream_paused boolean', () => {
        const content = `[gd_scene format=3]

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
stream_paused = false
`;

        const diagnostics = linter.lint(content);
        const errors = diagnostics.filter(d => d.severity === 'error' && d.message.includes('stream_paused'));
        expect(errors).toHaveLength(0);
      });

      it('should accept valid emission_angle_enabled boolean', () => {
        const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://sound.ogg" id="1_abc"]

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
stream = ExtResource("1_abc")
emission_angle_enabled = true
emission_angle_degrees = 45.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });
    });

    describe('attenuation_model validation', () => {
      it('should accept all valid attenuation models', () => {
        const validModes = [0, 1, 2, 3]; // INVERSE, INVERSE_SQUARE, LOGARITHMIC, DISABLED
        for (const mode of validModes) {
          const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://sound.ogg" id="1_abc"]

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
stream = ExtResource("1_abc")
attenuation_model = ${mode}
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject invalid attenuation_model value', () => {
        const content = `[gd_scene format=3]

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
attenuation_model = 5
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('attenuation_model');
        expect(diagnostics[0].message).toContain('0-3');
      });

      it('should reject negative attenuation_model', () => {
        const content = `[gd_scene format=3]

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
attenuation_model = -1
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('attenuation_model');
      });
    });

    describe('unit_size validation', () => {
      it('should accept valid unit_size values', () => {
        const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://sound.ogg" id="1_abc"]

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
stream = ExtResource("1_abc")
unit_size = 10.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject zero unit_size', () => {
        const content = `[gd_scene format=3]

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
unit_size = 0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('unit_size');
        expect(diagnostics[0].message).toContain('greater than 0');
      });

      it('should reject negative unit_size', () => {
        const content = `[gd_scene format=3]

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
unit_size = -5.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('unit_size');
        expect(diagnostics[0].message).toContain('greater than 0');
      });

      it('should reject invalid unit_size format', () => {
        const content = `[gd_scene format=3]

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
unit_size = invalid
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('unit_size');
        expect(diagnostics[0].message).toContain('must be a number');
      });
    });

    describe('max_distance validation', () => {
      it('should accept valid max_distance values', () => {
        const validValues = [0, 50, 100, 1000];
        for (const value of validValues) {
          const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://sound.ogg" id="1_abc"]

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
stream = ExtResource("1_abc")
max_distance = ${value}
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should accept zero max_distance (unlimited)', () => {
        const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://sound.ogg" id="1_abc"]

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
stream = ExtResource("1_abc")
max_distance = 0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject negative max_distance', () => {
        const content = `[gd_scene format=3]

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
max_distance = -10.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('max_distance');
        expect(diagnostics[0].message).toContain('non-negative');
      });

      it('should reject invalid max_distance format', () => {
        const content = `[gd_scene format=3]

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
max_distance = invalid
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('max_distance');
        expect(diagnostics[0].message).toContain('must be a number');
      });
    });

    describe('max_db validation', () => {
      it('should accept valid max_db values', () => {
        const validValues = [-24, 0, 3, 6];
        for (const value of validValues) {
          const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://sound.ogg" id="1_abc"]

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
stream = ExtResource("1_abc")
max_db = ${value}
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject invalid max_db format', () => {
        const content = `[gd_scene format=3]

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
max_db = invalid
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('max_db');
        expect(diagnostics[0].message).toContain('must be a number');
      });
    });

    describe('attenuation_filter_cutoff_hz validation', () => {
      it('should accept valid cutoff frequencies', () => {
        const validValues = [1, 5000, 10000, 20500];
        for (const value of validValues) {
          const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://sound.ogg" id="1_abc"]

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
stream = ExtResource("1_abc")
attenuation_filter_cutoff_hz = ${value}
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject cutoff below 1 Hz', () => {
        const content = `[gd_scene format=3]

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
attenuation_filter_cutoff_hz = 0.5
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('attenuation_filter_cutoff_hz');
        expect(diagnostics[0].message).toContain('at least 1 Hz');
      });

      it('should reject invalid cutoff format', () => {
        const content = `[gd_scene format=3]

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
attenuation_filter_cutoff_hz = invalid
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('attenuation_filter_cutoff_hz');
        expect(diagnostics[0].message).toContain('must be a number');
      });
    });

    describe('attenuation_filter_db validation', () => {
      it('should accept valid filter dB values', () => {
        const validValues = [-80, -24, 0, 6];
        for (const value of validValues) {
          const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://sound.ogg" id="1_abc"]

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
stream = ExtResource("1_abc")
attenuation_filter_db = ${value}
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject invalid filter dB format', () => {
        const content = `[gd_scene format=3]

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
attenuation_filter_db = invalid
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('attenuation_filter_db');
        expect(diagnostics[0].message).toContain('must be a number');
      });
    });

    describe('doppler_tracking validation', () => {
      it('should accept all valid doppler tracking modes', () => {
        const validModes = [0, 1, 2]; // DISABLED, IDLE_STEP, PHYSICS_STEP
        for (const mode of validModes) {
          const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://sound.ogg" id="1_abc"]

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
stream = ExtResource("1_abc")
doppler_tracking = ${mode}
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject invalid doppler_tracking value', () => {
        const content = `[gd_scene format=3]

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
doppler_tracking = 5
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('doppler_tracking');
        expect(diagnostics[0].message).toContain('0-2');
      });

      it('should reject negative doppler_tracking', () => {
        const content = `[gd_scene format=3]

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
doppler_tracking = -1
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('doppler_tracking');
      });
    });

    describe('panning_strength validation', () => {
      it('should accept valid panning_strength values', () => {
        const validValues = [0, 0.5, 1];
        for (const value of validValues) {
          const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://sound.ogg" id="1_abc"]

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
stream = ExtResource("1_abc")
panning_strength = ${value}
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject panning_strength below 0', () => {
        const content = `[gd_scene format=3]

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
panning_strength = -0.1
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('panning_strength');
        expect(diagnostics[0].message).toContain('between 0 and 1');
      });

      it('should reject panning_strength above 1', () => {
        const content = `[gd_scene format=3]

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
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

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
stream = ExtResource("1_abc")
area_mask = ${value}
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject area_mask below 0', () => {
        const content = `[gd_scene format=3]

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
area_mask = -1
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('area_mask');
        expect(diagnostics[0].message).toContain('between 0 and 1048575');
      });

      it('should reject area_mask exceeding maximum', () => {
        const content = `[gd_scene format=3]

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
area_mask = 2000000
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('area_mask');
        expect(diagnostics[0].message).toContain('between 0 and 1048575');
      });
    });

    describe('emission_angle_degrees validation', () => {
      it('should accept valid emission angle values', () => {
        const validValues = [0, 45, 60, 90];
        for (const value of validValues) {
          const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://sound.ogg" id="1_abc"]

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
stream = ExtResource("1_abc")
emission_angle_enabled = true
emission_angle_degrees = ${value}
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject emission_angle_degrees below 0', () => {
        const content = `[gd_scene format=3]

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
emission_angle_degrees = -10
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('emission_angle_degrees');
        expect(diagnostics[0].message).toContain('between 0 and 90');
      });

      it('should reject emission_angle_degrees above 90', () => {
        const content = `[gd_scene format=3]

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
emission_angle_degrees = 120
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('emission_angle_degrees');
        expect(diagnostics[0].message).toContain('between 0 and 90');
      });
    });

    describe('emission_angle_filter_attenuation_db validation', () => {
      it('should accept valid filter attenuation values', () => {
        const validValues = [-24, -12, 0, 6];
        for (const value of validValues) {
          const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://sound.ogg" id="1_abc"]

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
stream = ExtResource("1_abc")
emission_angle_enabled = true
emission_angle_filter_attenuation_db = ${value}
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject invalid filter attenuation format', () => {
        const content = `[gd_scene format=3]

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
emission_angle_filter_attenuation_db = invalid
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('emission_angle_filter_attenuation_db');
        expect(diagnostics[0].message).toContain('must be a number');
      });
    });

    describe('bus validation', () => {
      it('should accept valid bus string', () => {
        const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://sound.ogg" id="1_abc"]

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
stream = ExtResource("1_abc")
bus = "Master"
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept StringName format for bus', () => {
        const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://sound.ogg" id="1_abc"]

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
stream = ExtResource("1_abc")
bus = &"Master"
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject invalid bus format', () => {
        const content = `[gd_scene format=3]

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
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

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
stream = ExtResource("1_abc")
max_polyphony = ${value}
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject zero max_polyphony', () => {
        const content = `[gd_scene format=3]

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
max_polyphony = 0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('max_polyphony');
        expect(diagnostics[0].message).toContain('at least 1');
      });

      it('should reject negative max_polyphony', () => {
        const content = `[gd_scene format=3]

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
max_polyphony = -1
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('max_polyphony');
        expect(diagnostics[0].message).toContain('at least 1');
      });

      it('should reject invalid max_polyphony format', () => {
        const content = `[gd_scene format=3]

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
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

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
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

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
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

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
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

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
stream = ExtResource("1_abc")
`;

        const diagnostics = linter.lint(content);
        const resourceError = diagnostics.find(d => d.severity === 'error' && d.message.includes('does not exist'));
        expect(resourceError).toBeUndefined();
      });
    });

    describe('emission angle configuration warnings', () => {
      it('should warn when emission_angle_degrees is set without emission_angle_enabled', () => {
        const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://sound.ogg" id="1_abc"]

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
stream = ExtResource("1_abc")
emission_angle_degrees = 45.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const warning = diagnostics.find(d => d.severity === 'warning' && d.message.includes('emission_angle_degrees'));
        expect(warning).toBeDefined();
        expect(warning?.message).toContain('not true');
        expect(warning?.message).toContain('no effect');
      });

      it('should not warn when emission_angle_degrees is set with emission_angle_enabled', () => {
        const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://sound.ogg" id="1_abc"]

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
stream = ExtResource("1_abc")
emission_angle_enabled = true
emission_angle_degrees = 45.0
`;

        const diagnostics = linter.lint(content);
        const warning = diagnostics.find(d => d.severity === 'warning' && d.message.includes('emission_angle_degrees'));
        expect(warning).toBeUndefined();
      });

      it('should warn when emission_angle_filter_attenuation_db is set without emission_angle_enabled', () => {
        const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://sound.ogg" id="1_abc"]

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
stream = ExtResource("1_abc")
emission_angle_filter_attenuation_db = -12.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const warning = diagnostics.find(d => d.severity === 'warning' && d.message.includes('emission_angle_filter_attenuation_db'));
        expect(warning).toBeDefined();
        expect(warning?.message).toContain('not true');
        expect(warning?.message).toContain('no effect');
      });

      it('should not warn when emission_angle_filter_attenuation_db is set with emission_angle_enabled', () => {
        const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://sound.ogg" id="1_abc"]

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
stream = ExtResource("1_abc")
emission_angle_enabled = true
emission_angle_filter_attenuation_db = -12.0
`;

        const diagnostics = linter.lint(content);
        const warning = diagnostics.find(d => d.severity === 'warning' && d.message.includes('emission_angle_filter_attenuation_db'));
        expect(warning).toBeUndefined();
      });
    });

    describe('volume_db warnings', () => {
      it('should warn on very low volume_db', () => {
        const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://sound.ogg" id="1_abc"]

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
stream = ExtResource("1_abc")
volume_db = -50
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const warning = diagnostics.find(d => d.severity === 'warning' && d.message.includes('Volume'));
        expect(warning).toBeDefined();
        expect(warning?.message).toContain('very low');
        expect(warning?.message).toContain('-50');
      });

      it('should warn on very high volume_db', () => {
        const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://sound.ogg" id="1_abc"]

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
stream = ExtResource("1_abc")
volume_db = 10
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const warning = diagnostics.find(d => d.severity === 'warning' && d.message.includes('Volume'));
        expect(warning).toBeDefined();
        expect(warning?.message).toContain('very high');
        expect(warning?.message).toContain('10');
      });

      it('should not warn on normal volume_db values', () => {
        const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://sound.ogg" id="1_abc"]

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
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

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
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

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
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

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
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

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
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

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
stream = ExtResource("1_abc")
volume_db = 0.0
pitch_scale = 1.0
playing = false
autoplay = false
stream_paused = false
attenuation_model = 2
unit_size = 10.0
max_distance = 100.0
max_db = 3.0
attenuation_filter_cutoff_hz = 5000.0
attenuation_filter_db = -24.0
doppler_tracking = 0
panning_strength = 1.0
area_mask = 1
emission_angle_enabled = true
emission_angle_degrees = 45.0
emission_angle_filter_attenuation_db = -12.0
bus = &"Master"
max_polyphony = 1
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle multiple validation errors', () => {
      const content = `[gd_scene format=3]

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
pitch_scale = 0
unit_size = -5.0
max_polyphony = 0
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(2);
      // Should have errors for: pitch_scale, unit_size, max_polyphony, missing stream
      const hasPitchError = diagnostics.some(d => d.message.includes('pitch_scale'));
      const hasUnitError = diagnostics.some(d => d.message.includes('unit_size'));
      const hasPolyphonyError = diagnostics.some(d => d.message.includes('max_polyphony'));
      const hasStreamError = diagnostics.some(d => d.message.includes('stream'));
      expect(hasPitchError || hasUnitError || hasPolyphonyError || hasStreamError).toBe(true);
    });

    it('should handle scientific notation in numeric values', () => {
      const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://sound.ogg" id="1_abc"]

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
stream = ExtResource("1_abc")
volume_db = -6e0
pitch_scale = 1.5e0
unit_size = 1e1
max_distance = 1e2
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should validate mixed warnings and errors', () => {
      const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://sound.ogg" id="1_abc"]

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
stream = ExtResource("1_abc")
volume_db = -50
pitch_scale = 0.3
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      // Should have warnings for extreme volume_db and pitch_scale
      const hasWarnings = diagnostics.some(d => d.severity === 'warning');
      expect(hasWarnings).toBe(true);
    });

    it('should handle SubResource references', () => {
      const content = `[gd_scene format=3]

[sub_resource type="AudioStreamGenerator" id="gen_1"]

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
stream = SubResource("gen_1")
volume_db = 0.0
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle boundary values for emission_angle_degrees', () => {
      const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://sound.ogg" id="1_abc"]

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
stream = ExtResource("1_abc")
emission_angle_enabled = true
emission_angle_degrees = 90
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle extreme combinations', () => {
      const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://sound.ogg" id="1_abc"]

[node name="AudioPlayer" type="AudioStreamPlayer3D"]
stream = ExtResource("1_abc")
volume_db = -50
pitch_scale = 0.3
emission_angle_degrees = 45.0
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(2);
      // Should have warnings for volume, pitch, and emission_angle_degrees without enabled
      const volumeWarning = diagnostics.find(d => d.message.includes('Volume') && d.message.includes('very low'));
      const pitchWarning = diagnostics.find(d => d.message.includes('Pitch scale') && d.message.includes('very low'));
      const emissionWarning = diagnostics.find(d => d.message.includes('emission_angle_degrees') && d.message.includes('not true'));
      expect(volumeWarning).toBeDefined();
      expect(pitchWarning).toBeDefined();
      expect(emissionWarning).toBeDefined();
    });
  });
});
