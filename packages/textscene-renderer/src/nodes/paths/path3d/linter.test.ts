/**
 * Tests for Path3D linter (strict parser + semantic rules)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../linter/Linter';
import './linterParser';
import './linter';

describe('Path3D Linter', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  describe('Strict Parser Validation (Format)', () => {
    it('should pass format validation for valid Path3D with curve (with unused warning)', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="Path3D" type="Path3D"]
curve = SubResource("curve_1")
`;

      const diagnostics = linter.lint(content);
      // Should only have unused warning, no format errors
      expect(diagnostics.length).toBe(1);
      expect(diagnostics[0].severity).toBe('warning');
      expect(diagnostics[0].ruleName).toBe('path3d-unused');
    });

    it('should pass format validation for Path3D with ExtResource curve (with unused warning)', () => {
      const content = `[gd_scene format=3]

[ext_resource type="Curve3D" path="res://curves/path.tres" id="curve_ext"]

[node name="Path3D" type="Path3D"]
curve = ExtResource("curve_ext")
`;

      const diagnostics = linter.lint(content);
      // Should only have unused warning, no format errors
      expect(diagnostics.length).toBe(1);
      expect(diagnostics[0].severity).toBe('warning');
      expect(diagnostics[0].ruleName).toBe('path3d-unused');
    });

    it('should pass validation for Path3D with PathFollow3D child', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="Path3D" type="Path3D"]
curve = SubResource("curve_1")

[node name="PathFollow3D" type="PathFollow3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    describe('curve property validation', () => {
      it('should accept valid curve SubResource reference format', () => {
        const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="Path3D" type="Path3D"]
curve = SubResource("curve_1")
`;

        const diagnostics = linter.lint(content);
        // Should only have unused warning, no format errors
        const formatErrors = diagnostics.filter(d => d.message.includes('resource reference'));
        expect(formatErrors).toHaveLength(0);
      });

      it('should accept valid curve ExtResource reference format', () => {
        const content = `[gd_scene format=3]

[ext_resource type="Curve3D" path="res://curves/rail.tres" id="curve_ext"]

[node name="CameraPath" type="Path3D"]
curve = ExtResource("curve_ext")
`;

        const diagnostics = linter.lint(content);
        // Should only have unused warning, no format errors
        const formatErrors = diagnostics.filter(d => d.message.includes('resource reference'));
        expect(formatErrors).toHaveLength(0);
      });

      it('should reject invalid curve reference format', () => {
        const content = `[gd_scene format=3]

[node name="Path3D" type="Path3D"]
curve = "invalid_format"
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const formatError = diagnostics.find(d => d.message.includes('resource reference'));
        expect(formatError).toBeDefined();
        expect(formatError?.severity).toBe('error');
        expect(formatError?.message).toContain('curve');
      });

      it('should reject curve with missing quotes', () => {
        const content = `[gd_scene format=3]

[node name="Path3D" type="Path3D"]
curve = SubResource(curve_1)
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const formatError = diagnostics.find(d => d.message.includes('resource reference'));
        expect(formatError).toBeDefined();
      });

      it('should reject curve with invalid resource type', () => {
        const content = `[gd_scene format=3]

[node name="Path3D" type="Path3D"]
curve = InvalidResource("curve_1")
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const formatError = diagnostics.find(d => d.message.includes('resource reference'));
        expect(formatError).toBeDefined();
      });

      it('should reject curve with plain string value', () => {
        const content = `[gd_scene format=3]

[node name="Path3D" type="Path3D"]
curve = some_value
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const formatError = diagnostics.find(d => d.message.includes('resource reference'));
        expect(formatError).toBeDefined();
        expect(formatError?.ruleName).toBe('strict-parser');
      });
    });
  });

  describe('Semantic Validation (Resource Existence)', () => {
    describe('curve resource existence', () => {
      it('should detect missing curve property', () => {
        const content = `[gd_scene format=3]

[node name="Path3D" type="Path3D"]
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const missingError = diagnostics.find(d => d.ruleName === 'path3d-requires-curve');
        expect(missingError).toBeDefined();
        expect(missingError?.severity).toBe('error');
        expect(missingError?.message).toContain("missing required property 'curve'");
        expect(missingError?.message).toContain('useless');
      });

      it('should detect non-existent curve resource', () => {
        const content = `[gd_scene format=3]

[node name="Path3D" type="Path3D"]
curve = SubResource("nonexistent_curve")
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const resourceError = diagnostics.find(d => d.message.includes('Curve resource not found'));
        expect(resourceError).toBeDefined();
        expect(resourceError?.severity).toBe('error');
        expect(resourceError?.ruleName).toBe('valid-path3d-resources');
      });

      it('should pass when curve resource exists', () => {
        const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="Path3D" type="Path3D"]
curve = SubResource("curve_1")

[node name="PathFollow3D" type="PathFollow3D" parent="."]
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should pass when curve ExtResource exists', () => {
        const content = `[gd_scene format=3]

[ext_resource type="Curve3D" path="res://curve.tres" id="curve_ext"]

[node name="Path3D" type="Path3D"]
curve = ExtResource("curve_ext")

[node name="PathFollow3D" type="PathFollow3D" parent="."]
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });
    });
  });

  describe('Semantic Validation (PathFollow3D Children)', () => {
    it('should warn when Path3D has no PathFollow3D children', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="Path3D" type="Path3D"]
curve = SubResource("curve_1")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const warningDiag = diagnostics.find(d => d.ruleName === 'path3d-unused');
      expect(warningDiag).toBeDefined();
      expect(warningDiag?.severity).toBe('warning');
      expect(warningDiag?.message).toContain('no PathFollow3D children');
      expect(warningDiag?.message).toContain('programmatically');
    });

    it('should not warn when Path3D has PathFollow3D child', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="Path3D" type="Path3D"]
curve = SubResource("curve_1")

[node name="PathFollow3D" type="PathFollow3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      const unusedWarning = diagnostics.filter(d => d.ruleName === 'path3d-unused');
      expect(unusedWarning).toHaveLength(0);
    });

    it('should not warn when Path3D has multiple PathFollow3D children', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="CameraRail" type="Path3D"]
curve = SubResource("curve_1")

[node name="PathFollow3D1" type="PathFollow3D" parent="."]

[node name="PathFollow3D2" type="PathFollow3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      const unusedWarning = diagnostics.filter(d => d.ruleName === 'path3d-unused');
      expect(unusedWarning).toHaveLength(0);
    });

    it('should detect nested PathFollow3D children', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="Path3D" type="Path3D"]
curve = SubResource("curve_1")

[node name="Container" type="Node3D" parent="."]

[node name="PathFollow3D" type="PathFollow3D" parent="Container"]
`;

      const diagnostics = linter.lint(content);
      const unusedWarning = diagnostics.filter(d => d.ruleName === 'path3d-unused');
      expect(unusedWarning).toHaveLength(0);
    });

    it('should warn when Path3D has other children but no PathFollow3D', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="Path3D" type="Path3D"]
curve = SubResource("curve_1")

[node name="MeshInstance3D" type="MeshInstance3D" parent="."]

[node name="Camera3D" type="Camera3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      const warningDiag = diagnostics.find(d => d.ruleName === 'path3d-unused');
      expect(warningDiag).toBeDefined();
      expect(warningDiag?.severity).toBe('warning');
    });
  });

  describe('Combined Validation', () => {
    it('should report errors for nonexistent curve resource', () => {
      const content = `[gd_scene format=3]

[node name="Path3D1" type="Path3D"]
curve = SubResource("nonexistent_curve")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);

      // Path3D1: should have curve resource not found error
      const curveError = diagnostics.find(d =>
        d.nodeName === 'Path3D1' &&
        d.message.includes('Curve resource not found')
      );
      expect(curveError).toBeDefined();
      expect(curveError?.severity).toBe('error');

      // Path3D1: should also have unused warning
      const unusedWarning = diagnostics.find(d =>
        d.nodeName === 'Path3D1' &&
        d.ruleName === 'path3d-unused'
      );
      expect(unusedWarning).toBeDefined();
      expect(unusedWarning?.severity).toBe('warning');
    });

    it('should validate Path3D with valid curve and PathFollow3D child', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="CameraPath" type="Path3D"]
curve = SubResource("curve_1")

[node name="Camera" type="PathFollow3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle multiple Path3D nodes in scene', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]
[sub_resource type="Curve3D" id="curve_2"]

[node name="Root" type="Node3D"]

[node name="CameraRail" type="Path3D" parent="."]
curve = SubResource("curve_1")

[node name="Camera" type="PathFollow3D" parent="CameraRail"]

[node name="PlatformPath" type="Path3D" parent="."]
curve = SubResource("curve_2")

[node name="Platform" type="PathFollow3D" parent="PlatformPath"]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle Path3D with ExtResource curve reference', () => {
      const content = `[gd_scene format=3]

[ext_resource type="Curve3D" path="res://paths/camera_rail.tres" id="curve_ext"]

[node name="Path3D" type="Path3D"]
curve = ExtResource("curve_ext")

[node name="PathFollow3D" type="PathFollow3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle missing curve and format error together', () => {
      const content = `[gd_scene format=3]

[node name="Path3D" type="Path3D"]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);

      // Should have missing curve error
      const missingError = diagnostics.find(d => d.ruleName === 'path3d-requires-curve');
      expect(missingError).toBeDefined();
      expect(missingError?.severity).toBe('error');

      // Should also have unused warning
      const unusedWarning = diagnostics.find(d => d.ruleName === 'path3d-unused');
      expect(unusedWarning).toBeDefined();
      expect(unusedWarning?.severity).toBe('warning');
    });

    it('should handle Path3D with invalid curve format', () => {
      const content = `[gd_scene format=3]

[node name="Path3D" type="Path3D"]
curve = invalid_value
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);

      // When there's a format error during strict parsing, semantic validation doesn't run
      // So we only expect the format error from the strict parser
      const formatError = diagnostics.find(d => d.message.includes('resource reference'));
      expect(formatError).toBeDefined();
      expect(formatError?.severity).toBe('error');
      expect(formatError?.ruleName).toBe('strict-parser');
    });

    it('should not run Path3D rules on other node types', () => {
      const content = `[gd_scene format=3]

[node name="NotPath3D" type="Node3D"]
`;

      const diagnostics = linter.lint(content);
      // Should not produce Path3D-specific errors
      const path3dErrors = diagnostics.filter(d =>
        d.ruleName?.includes('path3d') ||
        d.nodeType === 'Path3D'
      );
      expect(path3dErrors).toHaveLength(0);
    });

    it('should handle Path3D with PathFollow3D via intermediate nodes', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="Path3D" type="Path3D"]
curve = SubResource("curve_1")

[node name="Container" type="Node3D" parent="."]

[node name="PathFollow3D" type="PathFollow3D" parent="Container"]
`;

      const diagnostics = linter.lint(content);
      const unusedWarning = diagnostics.filter(d => d.ruleName === 'path3d-unused');
      expect(unusedWarning).toHaveLength(0);
    });

    it('should handle Path3D as child of another node', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="Root" type="Node3D"]

[node name="CameraRail" type="Path3D" parent="."]
curve = SubResource("curve_1")

[node name="Camera" type="PathFollow3D" parent="CameraRail"]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle Path3D with PathFollow3D child (enemy path use case)', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="EnemyPath" type="Path3D"]
curve = SubResource("curve_1")

[node name="Enemy" type="PathFollow3D" parent="."]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle mixed valid and invalid Path3D nodes', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="Root" type="Node3D"]

[node name="ValidPath" type="Path3D" parent="."]
curve = SubResource("curve_1")

[node name="PathFollow" type="PathFollow3D" parent="ValidPath"]

[node name="InvalidPath" type="Path3D" parent="."]
curve = SubResource("nonexistent")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);

      // ValidPath should have no errors
      const validPathErrors = diagnostics.filter(d => d.nodeName === 'ValidPath');
      expect(validPathErrors).toHaveLength(0);

      // InvalidPath should have resource not found error
      const resourceError = diagnostics.find(d =>
        d.nodeName === 'InvalidPath' &&
        d.message.includes('Curve resource not found')
      );
      expect(resourceError).toBeDefined();

      // InvalidPath should also have unused warning
      const unusedWarning = diagnostics.find(d =>
        d.nodeName === 'InvalidPath' &&
        d.ruleName === 'path3d-unused'
      );
      expect(unusedWarning).toBeDefined();
    });

    it('should handle Path3D used for camera rails (common use case)', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="CameraRail" type="Path3D"]
curve = SubResource("curve_1")

[node name="CameraPosition" type="PathFollow3D" parent="."]
rotation_mode = 4
cubic_interp = true

[node name="Camera3D" type="Camera3D" parent="CameraPosition"]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle Path3D used for moving platforms (common use case)', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="PlatformPath" type="Path3D"]
curve = SubResource("curve_1")

[node name="PathFollow3D" type="PathFollow3D" parent="."]
loop = true

[node name="Platform" type="MeshInstance3D" parent="PathFollow3D"]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });
  });
});
