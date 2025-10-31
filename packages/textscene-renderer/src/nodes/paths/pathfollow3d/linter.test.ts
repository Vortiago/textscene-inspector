/**
 * Tests for PathFollow3D linter (strict parser + semantic rules)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../linter/Linter';
import './linterParser';
import './linter';

describe('PathFollow3D Linter', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  describe('Strict Parser Validation (Format)', () => {
    it('should pass validation for valid PathFollow3D properties', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="Path" type="Path3D"]
curve = SubResource("curve_1")

[node name="PathFollow" type="PathFollow3D" parent="."]
progress = 0.0
h_offset = 0.0
v_offset = 0.0
rotation_mode = 3
cubic_interp = true
loop = false
tilt_enabled = false
use_model_front = false
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    describe('progress property validation', () => {
      it('should accept valid positive progress', () => {
        const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="Path" type="Path3D"]
curve = SubResource("curve_1")

[node name="PathFollow" type="PathFollow3D" parent="."]
progress = 100.5
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept zero progress', () => {
        const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="Path" type="Path3D"]
curve = SubResource("curve_1")

[node name="PathFollow" type="PathFollow3D" parent="."]
progress = 0.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject non-numeric progress', () => {
        const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="Path" type="Path3D"]
curve = SubResource("curve_1")

[node name="PathFollow" type="PathFollow3D" parent="."]
progress = "invalid"
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const progressError = diagnostics.find(d => d.message.includes('progress'));
        expect(progressError).toBeDefined();
        expect(progressError?.message).toContain('must be a number');
        expect(progressError?.ruleName).toBe('strict-parser');
      });
    });

    describe('progress_ratio property validation', () => {
      it('should accept valid progress_ratio in 0-1 range', () => {
        const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="Path" type="Path3D"]
curve = SubResource("curve_1")

[node name="PathFollow" type="PathFollow3D" parent="."]
progress_ratio = 0.5
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept progress_ratio at boundaries', () => {
        const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="Path" type="Path3D"]
curve = SubResource("curve_1")

[node name="PathFollow" type="PathFollow3D" parent="."]
progress_ratio = 1.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject non-numeric progress_ratio', () => {
        const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="Path" type="Path3D"]
curve = SubResource("curve_1")

[node name="PathFollow" type="PathFollow3D" parent="."]
progress_ratio = "half"
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('progress_ratio'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('must be a number');
      });
    });

    describe('offset properties validation', () => {
      it('should accept valid h_offset', () => {
        const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="Path" type="Path3D"]
curve = SubResource("curve_1")

[node name="PathFollow" type="PathFollow3D" parent="."]
h_offset = 2.5
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept valid v_offset', () => {
        const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="Path" type="Path3D"]
curve = SubResource("curve_1")

[node name="PathFollow" type="PathFollow3D" parent="."]
v_offset = -1.5
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject non-numeric h_offset', () => {
        const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="Path" type="Path3D"]
curve = SubResource("curve_1")

[node name="PathFollow" type="PathFollow3D" parent="."]
h_offset = "invalid"
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('h_offset'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('must be a number');
      });

      it('should reject non-numeric v_offset', () => {
        const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="Path" type="Path3D"]
curve = SubResource("curve_1")

[node name="PathFollow" type="PathFollow3D" parent="."]
v_offset = "invalid"
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('v_offset'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('must be a number');
      });
    });

    describe('rotation_mode property validation', () => {
      it('should accept ROTATION_NONE (0)', () => {
        const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="Path" type="Path3D"]
curve = SubResource("curve_1")

[node name="PathFollow" type="PathFollow3D" parent="."]
rotation_mode = 0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept ROTATION_Y (1)', () => {
        const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="Path" type="Path3D"]
curve = SubResource("curve_1")

[node name="PathFollow" type="PathFollow3D" parent="."]
rotation_mode = 1
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept ROTATION_XY (2)', () => {
        const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="Path" type="Path3D"]
curve = SubResource("curve_1")

[node name="PathFollow" type="PathFollow3D" parent="."]
rotation_mode = 2
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept ROTATION_XYZ (3)', () => {
        const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="Path" type="Path3D"]
curve = SubResource("curve_1")

[node name="PathFollow" type="PathFollow3D" parent="."]
rotation_mode = 3
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept ROTATION_ORIENTED (4)', () => {
        const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="Path" type="Path3D"]
curve = SubResource("curve_1")

[node name="PathFollow" type="PathFollow3D" parent="."]
rotation_mode = 4
`;

        const diagnostics = linter.lint(content);
        // Should have warning about up_vector requirement, but format is valid
        const formatErrors = diagnostics.filter(d => d.ruleName === 'strict-parser');
        expect(formatErrors).toHaveLength(0);
      });

      it('should reject invalid rotation_mode value (5)', () => {
        const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="Path" type="Path3D"]
curve = SubResource("curve_1")

[node name="PathFollow" type="PathFollow3D" parent="."]
rotation_mode = 5
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('rotation_mode') && d.message.includes('0-4'));
        expect(error).toBeDefined();
        expect(error?.ruleName).toBe('strict-parser');
      });

      it('should reject invalid rotation_mode value (-1)', () => {
        const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="Path" type="Path3D"]
curve = SubResource("curve_1")

[node name="PathFollow" type="PathFollow3D" parent="."]
rotation_mode = -1
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('rotation_mode') && d.message.includes('0-4'));
        expect(error).toBeDefined();
      });

      it('should reject non-numeric rotation_mode', () => {
        const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="Path" type="Path3D"]
curve = SubResource("curve_1")

[node name="PathFollow" type="PathFollow3D" parent="."]
rotation_mode = "Y"
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('rotation_mode'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('must be a number');
      });
    });

    describe('boolean properties validation', () => {
      it('should accept cubic_interp = true', () => {
        const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="Path" type="Path3D"]
curve = SubResource("curve_1")

[node name="PathFollow" type="PathFollow3D" parent="."]
cubic_interp = true
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept cubic_interp = false', () => {
        const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="Path" type="Path3D"]
curve = SubResource("curve_1")

[node name="PathFollow" type="PathFollow3D" parent="."]
cubic_interp = false
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject non-boolean cubic_interp', () => {
        const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="Path" type="Path3D"]
curve = SubResource("curve_1")

[node name="PathFollow" type="PathFollow3D" parent="."]
cubic_interp = 1
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('cubic_interp'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('boolean');
      });

      it('should accept loop = true', () => {
        const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="Path" type="Path3D"]
curve = SubResource("curve_1")

[node name="PathFollow" type="PathFollow3D" parent="."]
loop = true
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject non-boolean loop', () => {
        const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="Path" type="Path3D"]
curve = SubResource("curve_1")

[node name="PathFollow" type="PathFollow3D" parent="."]
loop = "yes"
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('loop'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('boolean');
      });

      it('should accept tilt_enabled = true', () => {
        const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="Path" type="Path3D"]
curve = SubResource("curve_1")

[node name="PathFollow" type="PathFollow3D" parent="."]
tilt_enabled = true
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject non-boolean tilt_enabled', () => {
        const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="Path" type="Path3D"]
curve = SubResource("curve_1")

[node name="PathFollow" type="PathFollow3D" parent="."]
tilt_enabled = 1
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('tilt_enabled'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('boolean');
      });

      it('should accept use_model_front = true', () => {
        const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="Path" type="Path3D"]
curve = SubResource("curve_1")

[node name="PathFollow" type="PathFollow3D" parent="."]
use_model_front = true
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject non-boolean use_model_front', () => {
        const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="Path" type="Path3D"]
curve = SubResource("curve_1")

[node name="PathFollow" type="PathFollow3D" parent="."]
use_model_front = "true"
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.message.includes('use_model_front'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('boolean');
      });
    });
  });

  describe('Semantic Validation (Parent Validation)', () => {
    it('should pass when parent is Path3D', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="Path" type="Path3D"]
curve = SubResource("curve_1")

[node name="PathFollow" type="PathFollow3D" parent="."]
progress = 0.0
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should error when PathFollow3D has no parent', () => {
      const content = `[gd_scene format=3]

[node name="PathFollow" type="PathFollow3D"]
progress = 0.0
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const parentError = diagnostics.find(d => d.ruleName === 'pathfollow3d-no-parent');
      expect(parentError).toBeDefined();
      expect(parentError).toMatchObject({
        severity: 'error',
        nodeName: 'PathFollow',
        nodeType: 'PathFollow3D',
      });
      expect(parentError?.message).toContain('no parent');
      expect(parentError?.message).toContain('MUST be a direct child of a Path3D');
    });

    it('should error when parent is not Path3D', () => {
      const content = `[gd_scene format=3]

[node name="Node3D" type="Node3D"]

[node name="PathFollow" type="PathFollow3D" parent="."]
progress = 0.0
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const parentError = diagnostics.find(d => d.ruleName === 'pathfollow3d-invalid-parent');
      expect(parentError).toBeDefined();
      expect(parentError).toMatchObject({
        severity: 'error',
        nodeName: 'PathFollow',
        nodeType: 'PathFollow3D',
      });
      expect(parentError?.message).toContain('Node3D');
      expect(parentError?.message).toContain('MUST be a direct child of a Path3D');
    });

    it('should error when parent is MeshInstance3D', () => {
      const content = `[gd_scene format=3]

[sub_resource type="BoxMesh" id="mesh_1"]

[node name="Mesh" type="MeshInstance3D"]
mesh = SubResource("mesh_1")

[node name="PathFollow" type="PathFollow3D" parent="."]
progress = 0.0
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const parentError = diagnostics.find(d => d.ruleName === 'pathfollow3d-invalid-parent');
      expect(parentError).toBeDefined();
      expect(parentError?.message).toContain('MeshInstance3D');
    });
  });

  describe('Semantic Validation (Progress Values)', () => {
    it('should warn when progress is negative', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="Path" type="Path3D"]
curve = SubResource("curve_1")

[node name="PathFollow" type="PathFollow3D" parent="."]
progress = -5.0
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const warning = diagnostics.find(d => d.ruleName === 'pathfollow3d-negative-progress');
      expect(warning).toBeDefined();
      expect(warning).toMatchObject({
        severity: 'warning',
        nodeName: 'PathFollow',
        nodeType: 'PathFollow3D',
      });
      expect(warning?.message).toContain('negative');
      expect(warning?.message).toContain('clamp');
    });

    it('should not warn when progress is zero', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="Path" type="Path3D"]
curve = SubResource("curve_1")

[node name="PathFollow" type="PathFollow3D" parent="."]
progress = 0.0
`;

      const diagnostics = linter.lint(content);
      const progressWarning = diagnostics.find(d => d.ruleName === 'pathfollow3d-negative-progress');
      expect(progressWarning).toBeUndefined();
    });

    it('should not warn when progress is positive', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="Path" type="Path3D"]
curve = SubResource("curve_1")

[node name="PathFollow" type="PathFollow3D" parent="."]
progress = 100.5
`;

      const diagnostics = linter.lint(content);
      const progressWarning = diagnostics.find(d => d.ruleName === 'pathfollow3d-negative-progress');
      expect(progressWarning).toBeUndefined();
    });

    it('should warn when progress_ratio is below 0', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="Path" type="Path3D"]
curve = SubResource("curve_1")

[node name="PathFollow" type="PathFollow3D" parent="."]
progress_ratio = -0.5
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const warning = diagnostics.find(d => d.ruleName === 'pathfollow3d-progress-ratio-out-of-range');
      expect(warning).toBeDefined();
      expect(warning).toMatchObject({
        severity: 'warning',
        nodeName: 'PathFollow',
        nodeType: 'PathFollow3D',
      });
      expect(warning?.message).toContain('outside the 0-1 range');
    });

    it('should warn when progress_ratio is above 1', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="Path" type="Path3D"]
curve = SubResource("curve_1")

[node name="PathFollow" type="PathFollow3D" parent="."]
progress_ratio = 1.5
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const warning = diagnostics.find(d => d.ruleName === 'pathfollow3d-progress-ratio-out-of-range');
      expect(warning).toBeDefined();
      expect(warning?.message).toContain('outside the 0-1 range');
    });

    it('should not warn when progress_ratio is exactly 0', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="Path" type="Path3D"]
curve = SubResource("curve_1")

[node name="PathFollow" type="PathFollow3D" parent="."]
progress_ratio = 0.0
`;

      const diagnostics = linter.lint(content);
      const warning = diagnostics.find(d => d.ruleName === 'pathfollow3d-progress-ratio-out-of-range');
      expect(warning).toBeUndefined();
    });

    it('should not warn when progress_ratio is exactly 1', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="Path" type="Path3D"]
curve = SubResource("curve_1")

[node name="PathFollow" type="PathFollow3D" parent="."]
progress_ratio = 1.0
`;

      const diagnostics = linter.lint(content);
      const warning = diagnostics.find(d => d.ruleName === 'pathfollow3d-progress-ratio-out-of-range');
      expect(warning).toBeUndefined();
    });

    it('should not warn when progress_ratio is in valid range', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="Path" type="Path3D"]
curve = SubResource("curve_1")

[node name="PathFollow" type="PathFollow3D" parent="."]
progress_ratio = 0.5
`;

      const diagnostics = linter.lint(content);
      const warning = diagnostics.find(d => d.ruleName === 'pathfollow3d-progress-ratio-out-of-range');
      expect(warning).toBeUndefined();
    });
  });

  describe('Semantic Validation (Conflicting Properties)', () => {
    it('should info when both progress and progress_ratio are set', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="Path" type="Path3D"]
curve = SubResource("curve_1")

[node name="PathFollow" type="PathFollow3D" parent="."]
progress = 50.0
progress_ratio = 0.5
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const info = diagnostics.find(d => d.ruleName === 'pathfollow3d-both-progress-properties');
      expect(info).toBeDefined();
      expect(info).toMatchObject({
        severity: 'info',
        nodeName: 'PathFollow',
        nodeType: 'PathFollow3D',
      });
      expect(info?.message).toContain('both');
      expect(info?.message).toContain('takes precedence');
    });

    it('should not info when only progress is set', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="Path" type="Path3D"]
curve = SubResource("curve_1")

[node name="PathFollow" type="PathFollow3D" parent="."]
progress = 50.0
`;

      const diagnostics = linter.lint(content);
      const info = diagnostics.find(d => d.ruleName === 'pathfollow3d-both-progress-properties');
      expect(info).toBeUndefined();
    });

    it('should not info when only progress_ratio is set', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="Path" type="Path3D"]
curve = SubResource("curve_1")

[node name="PathFollow" type="PathFollow3D" parent="."]
progress_ratio = 0.5
`;

      const diagnostics = linter.lint(content);
      const info = diagnostics.find(d => d.ruleName === 'pathfollow3d-both-progress-properties');
      expect(info).toBeUndefined();
    });
  });

  describe('Semantic Validation (Rotation Mode)', () => {
    it('should warn when rotation_mode is ORIENTED (4)', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="Path" type="Path3D"]
curve = SubResource("curve_1")

[node name="PathFollow" type="PathFollow3D" parent="."]
rotation_mode = 4
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const warning = diagnostics.find(d => d.ruleName === 'pathfollow3d-oriented-mode-requires-up-vector');
      expect(warning).toBeDefined();
      expect(warning).toMatchObject({
        severity: 'warning',
        nodeName: 'PathFollow',
        nodeType: 'PathFollow3D',
      });
      expect(warning?.message).toContain('ROTATION_ORIENTED');
      expect(warning?.message).toContain('up_vector_enabled');
    });

    it('should not warn when rotation_mode is not ORIENTED', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="Path" type="Path3D"]
curve = SubResource("curve_1")

[node name="PathFollow" type="PathFollow3D" parent="."]
rotation_mode = 3
`;

      const diagnostics = linter.lint(content);
      const warning = diagnostics.find(d => d.ruleName === 'pathfollow3d-oriented-mode-requires-up-vector');
      expect(warning).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle PathFollow3D with no properties', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="Path" type="Path3D"]
curve = SubResource("curve_1")

[node name="PathFollow" type="PathFollow3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      // Should only have warnings about default behavior, no errors
      const errors = diagnostics.filter(d => d.severity === 'error');
      expect(errors).toHaveLength(0);
    });

    it('should handle multiple validation errors', () => {
      const content = `[gd_scene format=3]

[node name="InvalidParent" type="Node3D"]

[node name="PathFollow" type="PathFollow3D" parent="."]
progress = -10.0
progress_ratio = 2.0
rotation_mode = 4
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);

      // Should have parent error
      const parentError = diagnostics.find(d => d.ruleName === 'pathfollow3d-invalid-parent');
      expect(parentError).toBeDefined();

      // Should have negative progress warning
      const progressWarning = diagnostics.find(d => d.ruleName === 'pathfollow3d-negative-progress');
      expect(progressWarning).toBeDefined();

      // Should have out of range progress_ratio warning
      const ratioWarning = diagnostics.find(d => d.ruleName === 'pathfollow3d-progress-ratio-out-of-range');
      expect(ratioWarning).toBeDefined();

      // Should have oriented mode warning
      const orientedWarning = diagnostics.find(d => d.ruleName === 'pathfollow3d-oriented-mode-requires-up-vector');
      expect(orientedWarning).toBeDefined();
    });

    it('should handle deeply nested PathFollow3D', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="Root" type="Node3D"]

[node name="Path" type="Path3D" parent="."]
curve = SubResource("curve_1")

[node name="PathFollow" type="PathFollow3D" parent="Path"]
progress = 0.0
`;

      const diagnostics = linter.lint(content);
      // Should pass - PathFollow3D has valid Path3D parent
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle all properties set with valid values', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="Path" type="Path3D"]
curve = SubResource("curve_1")

[node name="PathFollow" type="PathFollow3D" parent="."]
progress = 10.0
h_offset = 2.5
v_offset = -1.0
rotation_mode = 2
cubic_interp = true
loop = true
tilt_enabled = false
use_model_front = true
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle scientific notation in progress values', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="Path" type="Path3D"]
curve = SubResource("curve_1")

[node name="PathFollow" type="PathFollow3D" parent="."]
progress = 1.5e2
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });
  });

  describe('Integration Tests', () => {
    it('should validate complete camera rail scene', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="camera_path"]

[node name="Scene" type="Node3D"]

[node name="CameraRail" type="Path3D" parent="."]
curve = SubResource("camera_path")

[node name="CameraFollow" type="PathFollow3D" parent="CameraRail"]
progress_ratio = 0.0
rotation_mode = 3
cubic_interp = true
loop = false

[node name="Camera" type="Camera3D" parent="CameraRail/CameraFollow"]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should validate moving platform scene', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="platform_path"]
[sub_resource type="BoxMesh" id="platform_mesh"]

[node name="Scene" type="Node3D"]

[node name="PlatformPath" type="Path3D" parent="."]
curve = SubResource("platform_path")

[node name="PlatformFollow" type="PathFollow3D" parent="PlatformPath"]
progress = 0.0
rotation_mode = 1
loop = true
cubic_interp = true

[node name="Platform" type="MeshInstance3D" parent="PlatformPath/PlatformFollow"]
mesh = SubResource("platform_mesh")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should validate patrol path with multiple followers', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="patrol_path"]

[node name="Scene" type="Node3D"]

[node name="PatrolPath" type="Path3D" parent="."]
curve = SubResource("patrol_path")

[node name="Enemy1" type="PathFollow3D" parent="PatrolPath"]
progress_ratio = 0.0
rotation_mode = 1
loop = true

[node name="Enemy2" type="PathFollow3D" parent="PatrolPath"]
progress_ratio = 0.5
rotation_mode = 1
loop = true
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });
  });
});
