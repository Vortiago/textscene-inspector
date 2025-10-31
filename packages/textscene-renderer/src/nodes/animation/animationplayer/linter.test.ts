/**
 * Tests for AnimationPlayer linter (strict parser + semantic rules)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../linter/Linter';
import './linterParser';
import './linter';

describe('AnimationPlayer Linter', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  describe('Strict Parser Validation (Format)', () => {
    it('should pass validation for valid AnimationPlayer properties', () => {
      const content = `[gd_scene format=3]

[node name="AnimPlayer" type="AnimationPlayer"]
speed_scale = 1.0
playback_default_blend_time = 0.0
playback_process_mode = 1
playback_active = true
method_call_mode = 0
root_node = NodePath("..")
anims/test = SubResource("Animation_1")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should pass validation for AnimationPlayer with animations', () => {
      const content = `[gd_scene format=3]

[node name="AnimPlayer" type="AnimationPlayer"]
autoplay = "idle"
speed_scale = 1.0
anims/idle = SubResource("Animation_1")
anims/walk = SubResource("Animation_2")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    describe('speed_scale validation', () => {
      it('should accept valid positive speed_scale values', () => {
        const validValues = [0.001, 0.5, 1.0, 2.0, 10.0, 100.0];
        for (const speed of validValues) {
          const content = `[gd_scene format=3]

[node name="AnimPlayer" type="AnimationPlayer"]
speed_scale = ${speed}
`;

          const diagnostics = linter.lint(content);
          const speedErrors = diagnostics.filter(d => d.severity === 'error' && d.message.includes('speed_scale'));
          expect(speedErrors).toHaveLength(0);
        }
      });

      it('should accept negative speed_scale for reverse playback', () => {
        const content = `[gd_scene format=3]

[node name="AnimPlayer" type="AnimationPlayer"]
speed_scale = -1.0
`;

        const diagnostics = linter.lint(content);
        const speedErrors = diagnostics.filter(d => d.severity === 'error' && d.message.includes('speed_scale'));
        expect(speedErrors).toHaveLength(0);
      });

      it('should reject zero speed_scale', () => {
        const content = `[gd_scene format=3]

[node name="AnimPlayer" type="AnimationPlayer"]
speed_scale = 0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('speed_scale');
        expect(diagnostics[0].message).toContain('cannot be 0');
      });

      it('should reject extremely small speed_scale', () => {
        const content = `[gd_scene format=3]

[node name="AnimPlayer" type="AnimationPlayer"]
speed_scale = 0.00001
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('speed_scale');
        expect(diagnostics[0].message).toContain('too small');
      });

      it('should reject extremely large speed_scale', () => {
        const content = `[gd_scene format=3]

[node name="AnimPlayer" type="AnimationPlayer"]
speed_scale = 10000
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('speed_scale');
        expect(diagnostics[0].message).toContain('too large');
      });

      it('should reject invalid speed_scale format', () => {
        const content = `[gd_scene format=3]

[node name="AnimPlayer" type="AnimationPlayer"]
speed_scale = fast
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('speed_scale');
        expect(diagnostics[0].message).toContain('must be a number');
      });
    });

    describe('playback_default_blend_time validation', () => {
      it('should accept valid blend time values', () => {
        const validValues = [0, 0.1, 0.5, 1.0, 2.0];
        for (const time of validValues) {
          const content = `[gd_scene format=3]

[node name="AnimPlayer" type="AnimationPlayer"]
playback_default_blend_time = ${time}
`;

          const diagnostics = linter.lint(content);
          const blendErrors = diagnostics.filter(d => d.severity === 'error' && d.message.includes('playback_default_blend_time'));
          expect(blendErrors).toHaveLength(0);
        }
      });

      it('should reject negative blend time', () => {
        const content = `[gd_scene format=3]

[node name="AnimPlayer" type="AnimationPlayer"]
playback_default_blend_time = -0.5
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('playback_default_blend_time');
        expect(diagnostics[0].message).toContain('must be >= 0');
      });

      it('should reject invalid blend time format', () => {
        const content = `[gd_scene format=3]

[node name="AnimPlayer" type="AnimationPlayer"]
playback_default_blend_time = instant
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('playback_default_blend_time');
        expect(diagnostics[0].message).toContain('must be a number');
      });
    });

    describe('playback_process_mode validation', () => {
      it('should accept all valid process modes', () => {
        const validModes = [0, 1, 2]; // PHYSICS, IDLE, MANUAL
        for (const mode of validModes) {
          const content = `[gd_scene format=3]

[node name="AnimPlayer" type="AnimationPlayer"]
playback_process_mode = ${mode}
`;

          const diagnostics = linter.lint(content);
          const modeErrors = diagnostics.filter(d => d.severity === 'error' && d.message.includes('playback_process_mode'));
          expect(modeErrors).toHaveLength(0);
        }
      });

      it('should reject invalid process mode', () => {
        const content = `[gd_scene format=3]

[node name="AnimPlayer" type="AnimationPlayer"]
playback_process_mode = 5
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('playback_process_mode');
        expect(diagnostics[0].message).toContain('0-2');
      });

      it('should reject non-numeric process mode', () => {
        const content = `[gd_scene format=3]

[node name="AnimPlayer" type="AnimationPlayer"]
playback_process_mode = IDLE
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('playback_process_mode');
        expect(diagnostics[0].message).toContain('must be a number');
      });
    });

    describe('method_call_mode validation', () => {
      it('should accept all valid method call modes', () => {
        const validModes = [0, 1]; // DEFERRED, IMMEDIATE
        for (const mode of validModes) {
          const content = `[gd_scene format=3]

[node name="AnimPlayer" type="AnimationPlayer"]
method_call_mode = ${mode}
`;

          const diagnostics = linter.lint(content);
          const modeErrors = diagnostics.filter(d => d.severity === 'error' && d.message.includes('method_call_mode'));
          expect(modeErrors).toHaveLength(0);
        }
      });

      it('should reject invalid method call mode', () => {
        const content = `[gd_scene format=3]

[node name="AnimPlayer" type="AnimationPlayer"]
method_call_mode = 2
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('method_call_mode');
        expect(diagnostics[0].message).toContain('0-1');
      });

      it('should reject non-numeric method call mode', () => {
        const content = `[gd_scene format=3]

[node name="AnimPlayer" type="AnimationPlayer"]
method_call_mode = DEFERRED
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('method_call_mode');
        expect(diagnostics[0].message).toContain('must be a number');
      });
    });

    describe('playback_active validation', () => {
      it('should accept valid boolean values', () => {
        const validValues = ['true', 'false'];
        for (const value of validValues) {
          const content = `[gd_scene format=3]

[node name="AnimPlayer" type="AnimationPlayer"]
playback_active = ${value}
anims/test = SubResource("Animation_1")
`;

          const diagnostics = linter.lint(content);
          const formatErrors = diagnostics.filter(d => d.severity === 'error');
          expect(formatErrors).toHaveLength(0);
        }
      });

      it('should reject invalid boolean value', () => {
        const content = `[gd_scene format=3]

[node name="AnimPlayer" type="AnimationPlayer"]
playback_active = yes
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('playback_active');
        expect(diagnostics[0].message).toContain('boolean');
      });
    });

    describe('autoplay validation', () => {
      it('should accept valid animation name', () => {
        const content = `[gd_scene format=3]

[node name="AnimPlayer" type="AnimationPlayer"]
autoplay = "idle"
anims/idle = SubResource("Animation_1")
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject empty autoplay', () => {
        const content = `[gd_scene format=3]

[node name="AnimPlayer" type="AnimationPlayer"]
autoplay = ""
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('autoplay');
        expect(diagnostics[0].message).toContain('cannot be empty');
      });
    });

    describe('root_node validation', () => {
      it('should accept valid NodePath', () => {
        const validPaths = ['NodePath("..")', 'NodePath(".")', 'NodePath("/root/Node")'];
        for (const path of validPaths) {
          const content = `[gd_scene format=3]

[node name="AnimPlayer" type="AnimationPlayer"]
root_node = ${path}
`;

          const diagnostics = linter.lint(content);
          const pathErrors = diagnostics.filter(d => d.severity === 'error' && d.message.includes('root_node'));
          expect(pathErrors).toHaveLength(0);
        }
      });

      it('should reject empty root_node', () => {
        const content = `[gd_scene format=3]

[node name="AnimPlayer" type="AnimationPlayer"]
root_node = ""
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('root_node');
        expect(diagnostics[0].message).toContain('cannot be empty');
      });
    });

    describe('runtime property validation', () => {
      it('should accept valid current_animation_length', () => {
        const content = `[gd_scene format=3]

[node name="AnimPlayer" type="AnimationPlayer"]
current_animation_length = 2.5
anims/test = SubResource("Animation_1")
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject negative animation length', () => {
        const content = `[gd_scene format=3]

[node name="AnimPlayer" type="AnimationPlayer"]
current_animation_length = -1.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('current_animation_length');
        expect(diagnostics[0].message).toContain('must be >= 0');
      });

      it('should accept valid current_animation_position', () => {
        const content = `[gd_scene format=3]

[node name="AnimPlayer" type="AnimationPlayer"]
current_animation_position = 1.5
anims/test = SubResource("Animation_1")
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject negative animation position', () => {
        const content = `[gd_scene format=3]

[node name="AnimPlayer" type="AnimationPlayer"]
current_animation_position = -0.5
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('current_animation_position');
        expect(diagnostics[0].message).toContain('must be >= 0');
      });
    });
  });

  describe('Semantic Validation', () => {
    describe('speed_scale warnings', () => {
      it('should warn when speed_scale is very slow', () => {
        const content = `[gd_scene format=3]

[node name="AnimPlayer" type="AnimationPlayer"]
speed_scale = 0.05
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const warning = diagnostics.find(d => d.severity === 'warning' && d.message.includes('speed_scale'));
        expect(warning).toBeDefined();
        expect(warning?.message).toContain('very slow');
        expect(warning?.message).toContain('0.05');
      });

      it('should warn when speed_scale is very fast', () => {
        const content = `[gd_scene format=3]

[node name="AnimPlayer" type="AnimationPlayer"]
speed_scale = 50
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const warning = diagnostics.find(d => d.severity === 'warning' && d.message.includes('speed_scale'));
        expect(warning).toBeDefined();
        expect(warning?.message).toContain('very fast');
        expect(warning?.message).toContain('50');
      });

      it('should not warn for normal speed_scale values', () => {
        const normalSpeeds = [0.5, 1.0, 2.0, 5.0];
        for (const speed of normalSpeeds) {
          const content = `[gd_scene format=3]

[node name="AnimPlayer" type="AnimationPlayer"]
speed_scale = ${speed}
`;

          const diagnostics = linter.lint(content);
          const speedWarning = diagnostics.find(d => d.severity === 'warning' && d.message.includes('speed_scale'));
          expect(speedWarning).toBeUndefined();
        }
      });

      it('should provide info about negative speed_scale', () => {
        const content = `[gd_scene format=3]

[node name="AnimPlayer" type="AnimationPlayer"]
speed_scale = -2.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const info = diagnostics.find(d => d.severity === 'info' && d.message.includes('negative'));
        expect(info).toBeDefined();
        expect(info?.message).toContain('reverse');
      });
    });

    describe('missing animations warnings', () => {
      it('should warn when no animations are defined', () => {
        const content = `[gd_scene format=3]

[node name="AnimPlayer" type="AnimationPlayer"]
speed_scale = 1.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const warning = diagnostics.find(d => d.severity === 'warning' && d.message.includes('no animations'));
        expect(warning).toBeDefined();
        expect(warning?.message).toContain('anims/');
      });

      it('should not warn when animations are defined', () => {
        const content = `[gd_scene format=3]

[node name="AnimPlayer" type="AnimationPlayer"]
speed_scale = 1.0
anims/idle = SubResource("Animation_1")
anims/walk = SubResource("Animation_2")
`;

        const diagnostics = linter.lint(content);
        const animWarning = diagnostics.find(d => d.message.includes('no animations'));
        expect(animWarning).toBeUndefined();
      });

      it('should not warn when libraries are defined', () => {
        const content = `[gd_scene format=3]

[node name="AnimPlayer" type="AnimationPlayer"]
speed_scale = 1.0
libraries = ExtResource("AnimationLibrary_1")
`;

        const diagnostics = linter.lint(content);
        const animWarning = diagnostics.find(d => d.message.includes('no animations'));
        expect(animWarning).toBeUndefined();
      });
    });

    describe('autoplay animation existence', () => {
      it('should warn when autoplay references missing animation', () => {
        const content = `[gd_scene format=3]

[node name="AnimPlayer" type="AnimationPlayer"]
autoplay = "idle"
anims/walk = SubResource("Animation_1")
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const warning = diagnostics.find(d => d.message.includes('autoplay') && d.message.includes('may not exist'));
        expect(warning).toBeDefined();
        expect(warning?.message).toContain('idle');
      });

      it('should not warn when autoplay animation exists', () => {
        const content = `[gd_scene format=3]

[node name="AnimPlayer" type="AnimationPlayer"]
autoplay = "idle"
anims/idle = SubResource("Animation_1")
`;

        const diagnostics = linter.lint(content);
        const autoplayWarning = diagnostics.find(d => d.message.includes('autoplay') && d.message.includes('may not exist'));
        expect(autoplayWarning).toBeUndefined();
      });
    });

    describe('current_animation existence', () => {
      it('should warn when current_animation references missing animation', () => {
        const content = `[gd_scene format=3]

[node name="AnimPlayer" type="AnimationPlayer"]
current_animation = "walk"
anims/idle = SubResource("Animation_1")
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const warning = diagnostics.find(d => d.message.includes('current_animation') && d.message.includes('may not exist'));
        expect(warning).toBeDefined();
        expect(warning?.message).toContain('walk');
      });

      it('should not warn when current_animation exists', () => {
        const content = `[gd_scene format=3]

[node name="AnimPlayer" type="AnimationPlayer"]
current_animation = "idle"
anims/idle = SubResource("Animation_1")
`;

        const diagnostics = linter.lint(content);
        const currentWarning = diagnostics.find(d => d.message.includes('current_animation') && d.message.includes('may not exist'));
        expect(currentWarning).toBeUndefined();
      });
    });

    describe('blend time warnings', () => {
      it('should warn when blend time is large', () => {
        const content = `[gd_scene format=3]

[node name="AnimPlayer" type="AnimationPlayer"]
playback_default_blend_time = 3.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const warning = diagnostics.find(d => d.severity === 'warning' && d.message.includes('playback_default_blend_time'));
        expect(warning).toBeDefined();
        expect(warning?.message).toContain('large');
        expect(warning?.message).toContain('3');
      });

      it('should not warn for normal blend times', () => {
        const normalTimes = [0, 0.1, 0.5, 1.0];
        for (const time of normalTimes) {
          const content = `[gd_scene format=3]

[node name="AnimPlayer" type="AnimationPlayer"]
playback_default_blend_time = ${time}
`;

          const diagnostics = linter.lint(content);
          const blendWarning = diagnostics.find(d => d.severity === 'warning' && d.message.includes('playback_default_blend_time'));
          expect(blendWarning).toBeUndefined();
        }
      });
    });

    describe('playback_active info', () => {
      it('should provide info when playback_active is false', () => {
        const content = `[gd_scene format=3]

[node name="AnimPlayer" type="AnimationPlayer"]
playback_active = false
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const info = diagnostics.find(d => d.severity === 'info' && d.message.includes('playback_active'));
        expect(info).toBeDefined();
        expect(info?.message).toContain('false');
        expect(info?.message).toContain('will not play');
      });

      it('should not provide info when playback_active is true', () => {
        const content = `[gd_scene format=3]

[node name="AnimPlayer" type="AnimationPlayer"]
playback_active = true
`;

        const diagnostics = linter.lint(content);
        const activeInfo = diagnostics.find(d => d.message.includes('playback_active') && d.message.includes('will not play'));
        expect(activeInfo).toBeUndefined();
      });
    });

    describe('root_node path validation', () => {
      it('should warn for unusual root_node path format', () => {
        const content = `[gd_scene format=3]

[node name="AnimPlayer" type="AnimationPlayer"]
root_node = NodePath("@invalid@path")
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const warning = diagnostics.find(d => d.message.includes('root_node') && d.message.includes('unusual'));
        expect(warning).toBeDefined();
      });

      it('should not warn for standard root_node paths', () => {
        const standardPaths = ['NodePath("..")', 'NodePath(".")', 'NodePath("/root")'];
        for (const path of standardPaths) {
          const content = `[gd_scene format=3]

[node name="AnimPlayer" type="AnimationPlayer"]
root_node = ${path}
`;

          const diagnostics = linter.lint(content);
          const pathWarning = diagnostics.find(d => d.message.includes('root_node') && d.message.includes('unusual'));
          expect(pathWarning).toBeUndefined();
        }
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle AnimationPlayer with no properties', () => {
      const content = `[gd_scene format=3]

[node name="AnimPlayer" type="AnimationPlayer"]
`;

      const diagnostics = linter.lint(content);
      // Should have warning about no animations
      const noAnimWarning = diagnostics.find(d => d.message.includes('no animations'));
      expect(noAnimWarning).toBeDefined();
    });

    it('should handle all properties together', () => {
      const content = `[gd_scene format=3]

[node name="AnimPlayer" type="AnimationPlayer"]
autoplay = "idle"
speed_scale = 1.0
playback_default_blend_time = 0.2
playback_process_mode = 1
playback_active = true
method_call_mode = 0
root_node = NodePath("..")
current_animation = "idle"
anims/idle = SubResource("Animation_1")
anims/walk = SubResource("Animation_2")
anims/run = SubResource("Animation_3")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle multiple validation errors', () => {
      const content = `[gd_scene format=3]

[node name="AnimPlayer" type="AnimationPlayer"]
speed_scale = 0
playback_default_blend_time = -1.0
playback_process_mode = 5
method_call_mode = 3
playback_active = maybe
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(4);
      // Should have errors for: speed_scale, blend_time, process_mode, method_call_mode, playback_active
      const hasSpeedError = diagnostics.some(d => d.message.includes('speed_scale'));
      const hasBlendError = diagnostics.some(d => d.message.includes('playback_default_blend_time'));
      const hasProcessError = diagnostics.some(d => d.message.includes('playback_process_mode'));
      const hasMethodError = diagnostics.some(d => d.message.includes('method_call_mode'));
      const hasActiveError = diagnostics.some(d => d.message.includes('playback_active'));
      expect(hasSpeedError && hasBlendError && hasProcessError && hasMethodError && hasActiveError).toBe(true);
    });

    it('should handle scientific notation in numeric values', () => {
      const content = `[gd_scene format=3]

[node name="AnimPlayer" type="AnimationPlayer"]
speed_scale = 1e0
playback_default_blend_time = 2e-1
anims/test = SubResource("Animation_1")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle boundary values', () => {
      const content = `[gd_scene format=3]

[node name="AnimPlayer" type="AnimationPlayer"]
speed_scale = 0.0001
playback_default_blend_time = 0
playback_process_mode = 0
method_call_mode = 0
`;

      const diagnostics = linter.lint(content);
      const errors = diagnostics.filter(d => d.severity === 'error');
      expect(errors).toHaveLength(0);
    });

    it('should handle complex animation setup', () => {
      const content = `[gd_scene format=3]

[node name="AnimPlayer" type="AnimationPlayer"]
autoplay = "idle"
speed_scale = 1.0
playback_default_blend_time = 0.15
playback_process_mode = 1
playback_active = true
method_call_mode = 0
root_node = NodePath("..")
current_animation = "idle"
current_animation_length = 2.0
current_animation_position = 0.5
anims/idle = SubResource("Animation_idle")
anims/walk = SubResource("Animation_walk")
anims/run = SubResource("Animation_run")
anims/jump = SubResource("Animation_jump")
anims/attack = SubResource("Animation_attack")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle mixed warnings and errors', () => {
      // Extreme speed (warning) + zero blend time (valid)
      let content = `[gd_scene format=3]

[node name="AnimPlayer" type="AnimationPlayer"]
speed_scale = 0.05
playback_default_blend_time = 0
anims/idle = SubResource("Animation_1")
`;

      let diagnostics = linter.lint(content);
      const hasWarning = diagnostics.some(d => d.severity === 'warning');
      expect(hasWarning).toBe(true);

      // Invalid process mode (error) + large blend time (warning)
      content = `[gd_scene format=3]

[node name="AnimPlayer" type="AnimationPlayer"]
playback_process_mode = 5
playback_default_blend_time = 5.0
`;

      diagnostics = linter.lint(content);
      const hasError = diagnostics.some(d => d.severity === 'error');
      expect(hasError).toBe(true);
    });

    it('should handle AnimationPlayer with libraries instead of inline anims', () => {
      const content = `[gd_scene format=3]

[node name="AnimPlayer" type="AnimationPlayer"]
autoplay = "idle"
speed_scale = 1.0
libraries = ExtResource("AnimationLibrary_main")
`;

      const diagnostics = linter.lint(content);
      // Should not have "no animations" warning
      const noAnimWarning = diagnostics.find(d => d.message.includes('no animations'));
      expect(noAnimWarning).toBeUndefined();
    });

    it('should handle quoted animation names in autoplay', () => {
      const content = `[gd_scene format=3]

[node name="AnimPlayer" type="AnimationPlayer"]
autoplay = "idle_animation"
anims/idle_animation = SubResource("Animation_1")
`;

      const diagnostics = linter.lint(content);
      const autoplayWarning = diagnostics.find(d => d.message.includes('autoplay') && d.message.includes('may not exist'));
      expect(autoplayWarning).toBeUndefined();
    });

    it('should handle reverse playback with warning', () => {
      const content = `[gd_scene format=3]

[node name="AnimPlayer" type="AnimationPlayer"]
speed_scale = -1.5
anims/idle = SubResource("Animation_1")
`;

      const diagnostics = linter.lint(content);
      // Should have info about reverse playback
      const reverseInfo = diagnostics.find(d => d.severity === 'info' && d.message.includes('reverse'));
      expect(reverseInfo).toBeDefined();
    });

    it('should handle empty current_animation', () => {
      const content = `[gd_scene format=3]

[node name="AnimPlayer" type="AnimationPlayer"]
current_animation = ""
anims/idle = SubResource("Animation_1")
`;

      const diagnostics = linter.lint(content);
      // Empty current_animation is valid (means no animation playing)
      const currentWarning = diagnostics.find(d => d.message.includes('current_animation') && d.message.includes('may not exist'));
      expect(currentWarning).toBeUndefined();
    });
  });
});
