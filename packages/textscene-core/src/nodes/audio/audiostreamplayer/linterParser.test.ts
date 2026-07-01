/**
 * Tests for AudioStreamPlayer strict property validators (linterParser).
 * The non-spatial player registers format validators only (no semantic
 * linter.ts), so coverage here is accept + reject per registered validator.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../linter/Linter';
import './linterParser';

describe('AudioStreamPlayer LinterParser', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  it('should pass validation for valid AudioStreamPlayer properties', () => {
    const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://music.ogg" id="1_abc"]

[node name="MusicPlayer" type="AudioStreamPlayer"]
stream = ExtResource("1_abc")
volume_db = -6.0
pitch_scale = 1.0
autoplay = true
stream_paused = false
max_polyphony = 2
`;

    const diagnostics = linter.lint(content);
    expect(diagnostics).toHaveLength(0);
  });

  describe('stream validation', () => {
    it('should accept ExtResource stream reference', () => {
      const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://sound.ogg" id="1_abc"]

[node name="Player" type="AudioStreamPlayer"]
stream = ExtResource("1_abc")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should accept SubResource stream reference', () => {
      const content = `[gd_scene format=3]

[node name="Player" type="AudioStreamPlayer"]
stream = SubResource("AudioStreamWAV_1")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should reject non-reference stream value', () => {
      const content = `[gd_scene format=3]

[node name="Player" type="AudioStreamPlayer"]
stream = "res://sound.ogg"
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0].message).toContain('stream');
      expect(diagnostics[0].message).toContain('resource reference');
    });
  });

  describe('volume_db validation', () => {
    it('should accept positive, zero, and negative volume_db', () => {
      const validValues = ['24.0', '0.0', '-80.0'];
      for (const value of validValues) {
        const content = `[gd_scene format=3]

[node name="Player" type="AudioStreamPlayer"]
volume_db = ${value}
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      }
    });

    it('should reject non-numeric volume_db', () => {
      const content = `[gd_scene format=3]

[node name="Player" type="AudioStreamPlayer"]
volume_db = loud
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0].message).toContain('volume_db');
      expect(diagnostics[0].message).toContain('must be a number');
    });
  });

  describe('pitch_scale validation', () => {
    it('should accept positive pitch_scale values', () => {
      const validValues = ['0.5', '1.0', '4.0'];
      for (const value of validValues) {
        const content = `[gd_scene format=3]

[node name="Player" type="AudioStreamPlayer"]
pitch_scale = ${value}
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      }
    });

    it('should reject zero pitch_scale', () => {
      const content = `[gd_scene format=3]

[node name="Player" type="AudioStreamPlayer"]
pitch_scale = 0
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0].message).toContain('pitch_scale');
      expect(diagnostics[0].message).toContain('greater than 0');
    });

    it('should reject negative pitch_scale', () => {
      const content = `[gd_scene format=3]

[node name="Player" type="AudioStreamPlayer"]
pitch_scale = -1.0
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0].message).toContain('pitch_scale');
      expect(diagnostics[0].message).toContain('greater than 0');
    });

    it('should reject non-numeric pitch_scale', () => {
      const content = `[gd_scene format=3]

[node name="Player" type="AudioStreamPlayer"]
pitch_scale = fast
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0].message).toContain('pitch_scale');
      expect(diagnostics[0].message).toContain('must be a number');
    });
  });

  describe('autoplay validation', () => {
    it('should accept valid autoplay boolean values', () => {
      const validValues = ['true', 'false'];
      for (const value of validValues) {
        const content = `[gd_scene format=3]

[node name="Player" type="AudioStreamPlayer"]
autoplay = ${value}
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      }
    });

    it('should reject non-boolean autoplay', () => {
      const content = `[gd_scene format=3]

[node name="Player" type="AudioStreamPlayer"]
autoplay = 1
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0].message).toContain('autoplay');
      expect(diagnostics[0].message).toContain('boolean');
    });
  });

  describe('stream_paused validation', () => {
    it('should accept valid stream_paused boolean values', () => {
      const validValues = ['true', 'false'];
      for (const value of validValues) {
        const content = `[gd_scene format=3]

[node name="Player" type="AudioStreamPlayer"]
stream_paused = ${value}
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      }
    });

    it('should reject non-boolean stream_paused', () => {
      const content = `[gd_scene format=3]

[node name="Player" type="AudioStreamPlayer"]
stream_paused = yes
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0].message).toContain('stream_paused');
      expect(diagnostics[0].message).toContain('boolean');
    });
  });

  describe('max_polyphony validation', () => {
    it('should accept max_polyphony values of 1 or greater', () => {
      const validValues = ['1', '4', '32'];
      for (const value of validValues) {
        const content = `[gd_scene format=3]

[node name="Player" type="AudioStreamPlayer"]
max_polyphony = ${value}
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      }
    });

    it('should reject max_polyphony below 1', () => {
      const content = `[gd_scene format=3]

[node name="Player" type="AudioStreamPlayer"]
max_polyphony = 0
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0].message).toContain('max_polyphony');
      expect(diagnostics[0].message).toContain('>= 1');
    });

    it('should reject non-numeric max_polyphony', () => {
      const content = `[gd_scene format=3]

[node name="Player" type="AudioStreamPlayer"]
max_polyphony = many
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0].message).toContain('max_polyphony');
      expect(diagnostics[0].message).toContain('must be a number');
    });
  });

  describe('playing validation', () => {
    it('should accept valid playing boolean values', () => {
      for (const value of ['true', 'false']) {
        const content = `[gd_scene format=3]

[node name="Player" type="AudioStreamPlayer"]
playing = ${value}
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      }
    });

    it('should reject non-boolean playing', () => {
      const content = `[gd_scene format=3]

[node name="Player" type="AudioStreamPlayer"]
playing = yes
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0].message).toContain('playing');
      expect(diagnostics[0].message).toContain('boolean');
    });
  });

  describe('bus validation', () => {
    it('should accept a plain quoted bus string', () => {
      const content = `[gd_scene format=3]

[node name="Player" type="AudioStreamPlayer"]
bus = "Music"
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should accept a StringName bus literal', () => {
      const content = `[gd_scene format=3]

[node name="Player" type="AudioStreamPlayer"]
bus = &"SFX"
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should reject an unquoted bus value', () => {
      const content = `[gd_scene format=3]

[node name="Player" type="AudioStreamPlayer"]
bus = Master
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0].message).toContain('bus');
      expect(diagnostics[0].message).toContain('must be a string');
    });
  });
});
