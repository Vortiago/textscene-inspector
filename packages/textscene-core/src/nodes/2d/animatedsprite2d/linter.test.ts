/**
 * Tests for AnimatedSprite2D linter (strict parser + semantic rules)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../linter/Linter';
import './linterParser';
import './linter';

describe('AnimatedSprite2D Linter', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  describe('Strict Parser Validation (Format)', () => {
    it('should pass validation for valid AnimatedSprite2D properties', () => {
      const content = `[gd_scene format=3]

[sub_resource type="SpriteFrames" id="frames_1"]

[node name="ValidAnimatedSprite" type="AnimatedSprite2D"]
sprite_frames = SubResource("frames_1")
animation = "default"
frame = 0
speed_scale = 1.0
centered = true
offset = Vector2(0, 0)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    describe('sprite_frames validation', () => {
      it('should accept valid sprite_frames reference format (SubResource)', () => {
        const content = `[gd_scene format=3]

[sub_resource type="SpriteFrames" id="frames_1"]

[node name="ValidSpriteFrames" type="AnimatedSprite2D"]
sprite_frames = SubResource("frames_1")
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept valid sprite_frames reference format (ExtResource)', () => {
        const content = `[gd_scene format=3]

[ext_resource type="SpriteFrames" path="res://animations.tres" id="frames_1"]

[node name="ValidSpriteFrames" type="AnimatedSprite2D"]
sprite_frames = ExtResource("frames_1")
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject invalid sprite_frames format', () => {
        const content = `[gd_scene format=3]

[node name="InvalidSpriteFrames" type="AnimatedSprite2D"]
sprite_frames = "invalid_format"
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('sprite_frames');
        expect(diagnostics[0].message).toContain('resource reference');
      });

      it('should reject plain string as sprite_frames', () => {
        const content = `[gd_scene format=3]

[node name="InvalidSpriteFrames" type="AnimatedSprite2D"]
sprite_frames = res://animations.tres
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('sprite_frames');
      });
    });

    describe('animation validation', () => {
      it('should accept valid animation string', () => {
        const content = `[gd_scene format=3]

[sub_resource type="SpriteFrames" id="frames_1"]

[node name="ValidAnimation" type="AnimatedSprite2D"]
sprite_frames = SubResource("frames_1")
animation = "walk"
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept empty animation string', () => {
        const content = `[gd_scene format=3]

[sub_resource type="SpriteFrames" id="frames_1"]

[node name="EmptyAnimation" type="AnimatedSprite2D"]
sprite_frames = SubResource("frames_1")
animation = ""
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept default animation', () => {
        const content = `[gd_scene format=3]

[sub_resource type="SpriteFrames" id="frames_1"]

[node name="DefaultAnimation" type="AnimatedSprite2D"]
sprite_frames = SubResource("frames_1")
animation = "default"
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });
    });

    describe('frame validation', () => {
      it('should accept valid non-negative frame', () => {
        const content = `[gd_scene format=3]

[sub_resource type="SpriteFrames" id="frames_1"]

[node name="ValidFrame" type="AnimatedSprite2D"]
sprite_frames = SubResource("frames_1")
frame = 5
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept frame = 0', () => {
        const content = `[gd_scene format=3]

[sub_resource type="SpriteFrames" id="frames_1"]

[node name="FrameZero" type="AnimatedSprite2D"]
sprite_frames = SubResource("frames_1")
frame = 0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject negative frame', () => {
        const content = `[gd_scene format=3]

[node name="NegativeFrame" type="AnimatedSprite2D"]
frame = -1
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('frame');
        expect(diagnostics[0].message).toContain('non-negative');
      });

      it('should reject non-integer frame', () => {
        const content = `[gd_scene format=3]

[node name="FloatFrame" type="AnimatedSprite2D"]
frame = 1.5
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('frame');
        expect(diagnostics[0].message).toContain('integer');
      });
    });

    describe('speed_scale validation', () => {
      it('should accept positive speed_scale', () => {
        const content = `[gd_scene format=3]

[sub_resource type="SpriteFrames" id="frames_1"]

[node name="PositiveSpeed" type="AnimatedSprite2D"]
sprite_frames = SubResource("frames_1")
speed_scale = 2.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept zero speed_scale (format check)', () => {
        const content = `[gd_scene format=3]

[sub_resource type="SpriteFrames" id="frames_1"]

[node name="ZeroSpeed" type="AnimatedSprite2D"]
sprite_frames = SubResource("frames_1")
speed_scale = 0.0
`;

        const diagnostics = linter.lint(content);
        // Format is valid, semantic warning will be checked later
        const formatErrors = diagnostics.filter(d => d.severity === 'error');
        expect(formatErrors).toHaveLength(0);
      });

      it('should accept negative speed_scale (format check)', () => {
        const content = `[gd_scene format=3]

[sub_resource type="SpriteFrames" id="frames_1"]

[node name="NegativeSpeed" type="AnimatedSprite2D"]
sprite_frames = SubResource("frames_1")
speed_scale = -1.0
`;

        const diagnostics = linter.lint(content);
        // Format is valid, semantic info will be checked later
        const formatErrors = diagnostics.filter(d => d.severity === 'error');
        expect(formatErrors).toHaveLength(0);
      });

      it('should reject non-numeric speed_scale', () => {
        const content = `[gd_scene format=3]

[node name="InvalidSpeed" type="AnimatedSprite2D"]
speed_scale = fast
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('speed_scale');
        expect(diagnostics[0].message).toContain('number');
      });
    });

    describe('centered validation', () => {
      it('should accept centered = true', () => {
        const content = `[gd_scene format=3]

[sub_resource type="SpriteFrames" id="frames_1"]

[node name="CenteredTrue" type="AnimatedSprite2D"]
sprite_frames = SubResource("frames_1")
centered = true
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept centered = false', () => {
        const content = `[gd_scene format=3]

[sub_resource type="SpriteFrames" id="frames_1"]

[node name="CenteredFalse" type="AnimatedSprite2D"]
sprite_frames = SubResource("frames_1")
centered = false
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject invalid centered value', () => {
        const content = `[gd_scene format=3]

[node name="InvalidCentered" type="AnimatedSprite2D"]
centered = 1
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('centered');
        expect(diagnostics[0].message).toContain('boolean');
      });
    });

    describe('offset validation', () => {
      it('should accept valid Vector2 offset', () => {
        const content = `[gd_scene format=3]

[sub_resource type="SpriteFrames" id="frames_1"]

[node name="ValidOffset" type="AnimatedSprite2D"]
sprite_frames = SubResource("frames_1")
offset = Vector2(10, 20)
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept negative offset values', () => {
        const content = `[gd_scene format=3]

[sub_resource type="SpriteFrames" id="frames_1"]

[node name="NegativeOffset" type="AnimatedSprite2D"]
sprite_frames = SubResource("frames_1")
offset = Vector2(-10, -20)
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept floating point offset values', () => {
        const content = `[gd_scene format=3]

[sub_resource type="SpriteFrames" id="frames_1"]

[node name="FloatOffset" type="AnimatedSprite2D"]
sprite_frames = SubResource("frames_1")
offset = Vector2(10.5, 20.75)
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject invalid offset format', () => {
        const content = `[gd_scene format=3]

[node name="InvalidOffset" type="AnimatedSprite2D"]
offset = "10, 20"
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('offset');
        expect(diagnostics[0].message).toContain('Vector2');
      });
    });

    describe('flip_h and flip_v validation', () => {
      it('should accept flip_h = true', () => {
        const content = `[gd_scene format=3]

[sub_resource type="SpriteFrames" id="frames_1"]

[node name="FlipH" type="AnimatedSprite2D"]
sprite_frames = SubResource("frames_1")
flip_h = true
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept flip_v = false', () => {
        const content = `[gd_scene format=3]

[sub_resource type="SpriteFrames" id="frames_1"]

[node name="FlipV" type="AnimatedSprite2D"]
sprite_frames = SubResource("frames_1")
flip_v = false
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject invalid flip_h value', () => {
        const content = `[gd_scene format=3]

[node name="InvalidFlipH" type="AnimatedSprite2D"]
flip_h = 1
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('flip_h');
        expect(diagnostics[0].message).toContain('boolean');
      });

      it('should reject invalid flip_v value', () => {
        const content = `[gd_scene format=3]

[node name="InvalidFlipV" type="AnimatedSprite2D"]
flip_v = yes
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('flip_v');
        expect(diagnostics[0].message).toContain('boolean');
      });
    });

    describe('frame_progress validation', () => {
      it('should accept valid frame_progress in range', () => {
        const content = `[gd_scene format=3]

[sub_resource type="SpriteFrames" id="frames_1"]

[node name="ValidFrameProgress" type="AnimatedSprite2D"]
sprite_frames = SubResource("frames_1")
frame_progress = 0.5
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept frame_progress = 0', () => {
        const content = `[gd_scene format=3]

[sub_resource type="SpriteFrames" id="frames_1"]

[node name="FrameProgressZero" type="AnimatedSprite2D"]
sprite_frames = SubResource("frames_1")
frame_progress = 0.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept frame_progress = 1', () => {
        const content = `[gd_scene format=3]

[sub_resource type="SpriteFrames" id="frames_1"]

[node name="FrameProgressOne" type="AnimatedSprite2D"]
sprite_frames = SubResource("frames_1")
frame_progress = 1.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept frame_progress out of range (format check)', () => {
        const content = `[gd_scene format=3]

[sub_resource type="SpriteFrames" id="frames_1"]

[node name="FrameProgressOutOfRange" type="AnimatedSprite2D"]
sprite_frames = SubResource("frames_1")
frame_progress = 1.5
`;

        const diagnostics = linter.lint(content);
        // Format is valid, semantic warning will be checked later
        const formatErrors = diagnostics.filter(d => d.severity === 'error');
        expect(formatErrors).toHaveLength(0);
      });

      it('should reject non-numeric frame_progress', () => {
        const content = `[gd_scene format=3]

[node name="InvalidFrameProgress" type="AnimatedSprite2D"]
frame_progress = half
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('frame_progress');
        expect(diagnostics[0].message).toContain('number');
      });
    });

    describe('autoplay validation', () => {
      it('should accept valid autoplay string', () => {
        const content = `[gd_scene format=3]

[sub_resource type="SpriteFrames" id="frames_1"]

[node name="ValidAutoplay" type="AnimatedSprite2D"]
sprite_frames = SubResource("frames_1")
autoplay = "idle"
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept empty autoplay string', () => {
        const content = `[gd_scene format=3]

[sub_resource type="SpriteFrames" id="frames_1"]

[node name="EmptyAutoplay" type="AnimatedSprite2D"]
sprite_frames = SubResource("frames_1")
autoplay = ""
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });
    });

    describe('playing validation (deprecated)', () => {
      it('should accept playing = true (format check)', () => {
        const content = `[gd_scene format=3]

[sub_resource type="SpriteFrames" id="frames_1"]

[node name="PlayingTrue" type="AnimatedSprite2D"]
sprite_frames = SubResource("frames_1")
playing = true
`;

        const diagnostics = linter.lint(content);
        // Format is valid, but should have info message about deprecation
        const formatErrors = diagnostics.filter(d => d.severity === 'error');
        expect(formatErrors).toHaveLength(0);
      });

      it('should accept playing = false (format check)', () => {
        const content = `[gd_scene format=3]

[sub_resource type="SpriteFrames" id="frames_1"]

[node name="PlayingFalse" type="AnimatedSprite2D"]
sprite_frames = SubResource("frames_1")
playing = false
`;

        const diagnostics = linter.lint(content);
        // Format is valid, but should have info message about deprecation
        const formatErrors = diagnostics.filter(d => d.severity === 'error');
        expect(formatErrors).toHaveLength(0);
      });

      it('should reject invalid playing value', () => {
        const content = `[gd_scene format=3]

[node name="InvalidPlaying" type="AnimatedSprite2D"]
playing = 1
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('playing');
        expect(diagnostics[0].message).toContain('boolean');
      });
    });
  });

  describe('Semantic Validation (Resource References)', () => {
    it('should detect missing sprite_frames (REQUIRED)', () => {
      const content = `[gd_scene format=3]

[node name="NoSpriteFrames" type="AnimatedSprite2D"]
animation = "default"
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const spriteFramesError = diagnostics.find(d => d.message.includes('requires a \'sprite_frames\' property'));
      expect(spriteFramesError).toBeDefined();
      expect(spriteFramesError?.severity).toBe('error');
      expect(spriteFramesError?.ruleName).toBe('animatedsprite2d-requires-spriteframes');
    });

    it('should detect missing sprite_frames resource', () => {
      const content = `[gd_scene format=3]

[node name="MissingSpriteFrames" type="AnimatedSprite2D"]
sprite_frames = SubResource("nonexistent")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]).toMatchObject({
        severity: 'error',
        nodeName: 'MissingSpriteFrames',
        nodeType: 'AnimatedSprite2D',
        ruleName: 'valid-animatedsprite2d-resources',
      });
      expect(diagnostics[0].message).toContain('SpriteFrames resource not found');
    });

    it('should pass when sprite_frames resource exists (SubResource)', () => {
      const content = `[gd_scene format=3]

[sub_resource type="SpriteFrames" id="frames_1"]

[node name="ValidSprite" type="AnimatedSprite2D"]
sprite_frames = SubResource("frames_1")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should pass when sprite_frames is external resource', () => {
      const content = `[gd_scene format=3]

[ext_resource type="SpriteFrames" path="res://animations.tres" id="frames_1"]

[node name="ValidSprite" type="AnimatedSprite2D"]
sprite_frames = ExtResource("frames_1")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });
  });

  describe('Semantic Validation (Animation Properties)', () => {
    it('should warn when autoplay is set but sprite_frames is not', () => {
      const content = `[gd_scene format=3]

[node name="AutoplayNoFrames" type="AnimatedSprite2D"]
autoplay = "idle"
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const autoplayWarning = diagnostics.find(d => d.ruleName === 'animatedsprite2d-autoplay-no-spriteframes');
      expect(autoplayWarning).toBeDefined();
      expect(autoplayWarning?.severity).toBe('warning');
      expect(autoplayWarning?.message).toContain('autoplay');
      expect(autoplayWarning?.message).toContain('sprite_frames\' is not set');
    });

    it('should warn when animation is set but sprite_frames is not', () => {
      const content = `[gd_scene format=3]

[node name="AnimationNoFrames" type="AnimatedSprite2D"]
animation = "walk"
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const animationWarning = diagnostics.find(d => d.ruleName === 'animatedsprite2d-animation-no-spriteframes');
      expect(animationWarning).toBeDefined();
      expect(animationWarning?.severity).toBe('warning');
      expect(animationWarning?.message).toContain('animation');
      expect(animationWarning?.message).toContain('sprite_frames\' is not set');
    });

    it('should pass when both animation and sprite_frames are set', () => {
      const content = `[gd_scene format=3]

[sub_resource type="SpriteFrames" id="frames_1"]

[node name="ValidAnimation" type="AnimatedSprite2D"]
sprite_frames = SubResource("frames_1")
animation = "walk"
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should pass when both autoplay and sprite_frames are set', () => {
      const content = `[gd_scene format=3]

[sub_resource type="SpriteFrames" id="frames_1"]

[node name="ValidAutoplay" type="AnimatedSprite2D"]
sprite_frames = SubResource("frames_1")
autoplay = "idle"
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });
  });

  describe('Semantic Validation (Speed Scale)', () => {
    it('should warn when speed_scale is 0', () => {
      const content = `[gd_scene format=3]

[sub_resource type="SpriteFrames" id="frames_1"]

[node name="ZeroSpeed" type="AnimatedSprite2D"]
sprite_frames = SubResource("frames_1")
speed_scale = 0.0
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const speedWarning = diagnostics.find(d => d.ruleName === 'animatedsprite2d-speed-scale-zero');
      expect(speedWarning).toBeDefined();
      expect(speedWarning?.severity).toBe('warning');
      expect(speedWarning?.message).toContain('speed_scale');
      expect(speedWarning?.message).toContain('0');
      expect(speedWarning?.message).toContain('will not advance');
    });

    it('should provide info when speed_scale is negative', () => {
      const content = `[gd_scene format=3]

[sub_resource type="SpriteFrames" id="frames_1"]

[node name="NegativeSpeed" type="AnimatedSprite2D"]
sprite_frames = SubResource("frames_1")
speed_scale = -1.0
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const speedInfo = diagnostics.find(d => d.ruleName === 'animatedsprite2d-speed-scale-negative');
      expect(speedInfo).toBeDefined();
      expect(speedInfo?.severity).toBe('info');
      expect(speedInfo?.message).toContain('speed_scale');
      expect(speedInfo?.message).toContain('negative');
      expect(speedInfo?.message).toContain('reverse');
    });

    it('should pass with positive speed_scale', () => {
      const content = `[gd_scene format=3]

[sub_resource type="SpriteFrames" id="frames_1"]

[node name="PositiveSpeed" type="AnimatedSprite2D"]
sprite_frames = SubResource("frames_1")
speed_scale = 2.0
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should pass with default speed_scale (1.0)', () => {
      const content = `[gd_scene format=3]

[sub_resource type="SpriteFrames" id="frames_1"]

[node name="DefaultSpeed" type="AnimatedSprite2D"]
sprite_frames = SubResource("frames_1")
speed_scale = 1.0
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });
  });

  describe('Semantic Validation (Frame Progress)', () => {
    it('should warn when frame_progress is below 0', () => {
      const content = `[gd_scene format=3]

[sub_resource type="SpriteFrames" id="frames_1"]

[node name="NegativeProgress" type="AnimatedSprite2D"]
sprite_frames = SubResource("frames_1")
frame_progress = -0.5
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const progressWarning = diagnostics.find(d => d.ruleName === 'animatedsprite2d-frame-progress-range');
      expect(progressWarning).toBeDefined();
      expect(progressWarning?.severity).toBe('warning');
      expect(progressWarning?.message).toContain('frame_progress');
      expect(progressWarning?.message).toContain('0.0 to 1.0');
    });

    it('should warn when frame_progress is above 1', () => {
      const content = `[gd_scene format=3]

[sub_resource type="SpriteFrames" id="frames_1"]

[node name="HighProgress" type="AnimatedSprite2D"]
sprite_frames = SubResource("frames_1")
frame_progress = 1.5
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const progressWarning = diagnostics.find(d => d.ruleName === 'animatedsprite2d-frame-progress-range');
      expect(progressWarning).toBeDefined();
      expect(progressWarning?.severity).toBe('warning');
      expect(progressWarning?.message).toContain('frame_progress');
      expect(progressWarning?.message).toContain('0.0 to 1.0');
    });

    it('should pass with frame_progress in valid range', () => {
      const content = `[gd_scene format=3]

[sub_resource type="SpriteFrames" id="frames_1"]

[node name="ValidProgress" type="AnimatedSprite2D"]
sprite_frames = SubResource("frames_1")
frame_progress = 0.5
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should pass with frame_progress = 0', () => {
      const content = `[gd_scene format=3]

[sub_resource type="SpriteFrames" id="frames_1"]

[node name="ProgressZero" type="AnimatedSprite2D"]
sprite_frames = SubResource("frames_1")
frame_progress = 0.0
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should pass with frame_progress = 1', () => {
      const content = `[gd_scene format=3]

[sub_resource type="SpriteFrames" id="frames_1"]

[node name="ProgressOne" type="AnimatedSprite2D"]
sprite_frames = SubResource("frames_1")
frame_progress = 1.0
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });
  });

  describe('Semantic Validation (Deprecated Playing Property)', () => {
    it('should provide info when playing property is used', () => {
      const content = `[gd_scene format=3]

[sub_resource type="SpriteFrames" id="frames_1"]

[node name="DeprecatedPlaying" type="AnimatedSprite2D"]
sprite_frames = SubResource("frames_1")
playing = true
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const playingInfo = diagnostics.find(d => d.ruleName === 'animatedsprite2d-playing-deprecated');
      expect(playingInfo).toBeDefined();
      expect(playingInfo?.severity).toBe('info');
      expect(playingInfo?.message).toContain('playing');
      expect(playingInfo?.message).toContain('deprecated');
      expect(playingInfo?.message).toContain('Godot 4.0+');
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple validation errors', () => {
      const content = `[gd_scene format=3]

[node name="MultipleErrors" type="AnimatedSprite2D"]
centered = 1
speed_scale = fast
frame = -5
flip_h = yes
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(3);
    });

    it('should handle all properties together', () => {
      const content = `[gd_scene format=3]

[sub_resource type="SpriteFrames" id="frames_1"]

[node name="CompleteAnimatedSprite" type="AnimatedSprite2D"]
sprite_frames = SubResource("frames_1")
animation = "walk"
autoplay = "idle"
frame = 2
frame_progress = 0.75
speed_scale = 1.5
centered = true
offset = Vector2(10, 20)
flip_h = false
flip_v = true
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle node with no properties', () => {
      const content = `[gd_scene format=3]

[node name="EmptyAnimatedSprite" type="AnimatedSprite2D"]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const spriteFramesError = diagnostics.find(d => d.message.includes('requires a \'sprite_frames\' property'));
      expect(spriteFramesError).toBeDefined();
    });

    it('should handle scientific notation in numeric values', () => {
      const content = `[gd_scene format=3]

[sub_resource type="SpriteFrames" id="frames_1"]

[node name="ScientificNotation" type="AnimatedSprite2D"]
sprite_frames = SubResource("frames_1")
speed_scale = 1.5e0
frame_progress = 5e-1
offset = Vector2(1.5e2, 2.0e1)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle boolean properties with proper values', () => {
      const content = `[gd_scene format=3]

[sub_resource type="SpriteFrames" id="frames_1"]

[node name="BoolProperties" type="AnimatedSprite2D"]
sprite_frames = SubResource("frames_1")
centered = true
flip_h = false
flip_v = true
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle whitespace in Vector2', () => {
      const content = `[gd_scene format=3]

[sub_resource type="SpriteFrames" id="frames_1"]

[node name="Whitespace" type="AnimatedSprite2D"]
sprite_frames = SubResource("frames_1")
offset = Vector2(  10  ,  20  )
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });
  });

  describe('Integration Tests', () => {
    it('should validate complete character animation configuration', () => {
      const content = `[gd_scene format=3]

[ext_resource type="SpriteFrames" path="res://character_animations.tres" id="char_frames"]

[node name="Player" type="AnimatedSprite2D"]
sprite_frames = ExtResource("char_frames")
animation = "idle"
autoplay = "idle"
frame = 0
frame_progress = 0.0
speed_scale = 1.0
centered = true
offset = Vector2(0, -8)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should catch multiple semantic errors in complex scene', () => {
      const content = `[gd_scene format=3]

[node name="BrokenAnimatedSprite" type="AnimatedSprite2D"]
sprite_frames = SubResource("missing_frames")
animation = "walk"
autoplay = "idle"
frame_progress = 1.5
speed_scale = 0.0
playing = true
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(2);
      expect(diagnostics.some(d => d.message.includes('SpriteFrames resource not found'))).toBe(true);
      expect(diagnostics.some(d => d.message.includes('frame_progress') && d.message.includes('0.0 to 1.0'))).toBe(true);
      expect(diagnostics.some(d => d.message.includes('speed_scale') && d.message.includes('0'))).toBe(true);
      expect(diagnostics.some(d => d.message.includes('playing') && d.message.includes('deprecated'))).toBe(true);
    });

    it('should validate reverse playback configuration', () => {
      const content = `[gd_scene format=3]

[sub_resource type="SpriteFrames" id="frames_1"]

[node name="ReversePlayback" type="AnimatedSprite2D"]
sprite_frames = SubResource("frames_1")
animation = "rewind"
speed_scale = -2.0
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const speedInfo = diagnostics.find(d => d.ruleName === 'animatedsprite2d-speed-scale-negative');
      expect(speedInfo).toBeDefined();
      expect(speedInfo?.severity).toBe('info');
    });

    it('should validate minimal valid configuration', () => {
      const content = `[gd_scene format=3]

[sub_resource type="SpriteFrames" id="frames_1"]

[node name="MinimalAnimatedSprite" type="AnimatedSprite2D"]
sprite_frames = SubResource("frames_1")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });
  });
});
