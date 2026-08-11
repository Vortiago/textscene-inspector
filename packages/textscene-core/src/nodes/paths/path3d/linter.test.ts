/**
 * Tests for Path3D linter (strict parser + semantic rules)
 */

import { describe, it, expect } from 'vitest';
import {
  node,
  scene,
  lint,
  expectClean,
  expectDiagnostic,
  expectNoDiagnostic,
} from '../../../linter/testing/testkit';
import './linterParser';
import './linter';

describe('Path3D Linter', () => {
  describe('Strict Parser Validation (Format)', () => {
    it('should pass format validation for valid Path3D with curve (with unused warning)', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="Path3D" type="Path3D"]
curve = SubResource("curve_1")
`;

      const diagnostics = lint(content);
      // Should only have unused warning, no format errors
      expect(diagnostics.length).toBe(1);
      expect(diagnostics[0]!.severity).toBe('warning');
      expect(diagnostics[0]!.ruleName).toBe('path3d-unused');
    });

    it('should pass format validation for Path3D with ExtResource curve (with unused warning)', () => {
      const content = `[gd_scene format=3]

[ext_resource type="Curve3D" path="res://curves/path.tres" id="curve_ext"]

[node name="Path3D" type="Path3D"]
curve = ExtResource("curve_ext")
`;

      const diagnostics = lint(content);
      // Should only have unused warning, no format errors
      expect(diagnostics.length).toBe(1);
      expect(diagnostics[0]!.severity).toBe('warning');
      expect(diagnostics[0]!.ruleName).toBe('path3d-unused');
    });

    it('should pass validation for Path3D with PathFollow3D child', () => {
      expectClean(`[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="Path3D" type="Path3D"]
curve = SubResource("curve_1")

[node name="PathFollow3D" type="PathFollow3D" parent="."]
`);
    });

    describe('curve property validation', () => {
      it('should accept valid curve SubResource reference format', () => {
        const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="Path3D" type="Path3D"]
curve = SubResource("curve_1")
`;

        const diagnostics = lint(content);
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

        const diagnostics = lint(content);
        // Should only have unused warning, no format errors
        const formatErrors = diagnostics.filter(d => d.message.includes('resource reference'));
        expect(formatErrors).toHaveLength(0);
      });

      it('should reject invalid curve reference format', () => {
        expectDiagnostic(scene(node('Path3D', { curve: '"invalid_format"' })), {
          prop: 'resource reference',
          severity: 'error',
          contains: ['curve'],
        });
      });

      it('should reject curve with missing quotes', () => {
        expectDiagnostic(scene(node('Path3D', { curve: 'SubResource(curve_1)' })), {
          prop: 'resource reference',
        });
      });

      it('should reject curve with invalid resource type', () => {
        expectDiagnostic(scene(node('Path3D', { curve: 'InvalidResource("curve_1")' })), {
          prop: 'resource reference',
        });
      });

      it('should reject curve with plain string value', () => {
        expectDiagnostic(scene(node('Path3D', { curve: 'some_value' })), {
          ruleName: 'strict-parser',
          contains: ['resource reference'],
        });
      });
    });
  });

  describe('Semantic Validation (Resource Existence)', () => {
    describe('curve resource existence', () => {
      it('should detect missing curve property', () => {
        expectDiagnostic(scene(node('Path3D')), {
          ruleName: 'path3d-requires-curve',
          severity: 'warning',
          contains: ["missing required property 'curve'", 'useless'],
        });
      });

      it('should detect non-existent curve resource', () => {
        expectDiagnostic(scene(node('Path3D', { curve: 'SubResource("nonexistent_curve")' })), {
          ruleName: 'valid-path3d-resources',
          severity: 'error',
          contains: ['Curve resource not found'],
        });
      });

      it('should pass when curve resource exists', () => {
        expectClean(`[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="Path3D" type="Path3D"]
curve = SubResource("curve_1")

[node name="PathFollow3D" type="PathFollow3D" parent="."]
`);
      });

      it('should pass when curve ExtResource exists', () => {
        expectClean(`[gd_scene format=3]

[ext_resource type="Curve3D" path="res://curve.tres" id="curve_ext"]

[node name="Path3D" type="Path3D"]
curve = ExtResource("curve_ext")

[node name="PathFollow3D" type="PathFollow3D" parent="."]
`);
      });
    });
  });

  describe('Semantic Validation (PathFollow3D Children)', () => {
    it('should warn when Path3D has no PathFollow3D children', () => {
      expectDiagnostic(
        `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="Path3D" type="Path3D"]
curve = SubResource("curve_1")
`,
        {
          ruleName: 'path3d-unused',
          severity: 'warning',
          contains: ['no PathFollow3D children', 'programmatically'],
        }
      );
    });

    it('should not warn when Path3D has PathFollow3D child', () => {
      expectNoDiagnostic(
        `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="Path3D" type="Path3D"]
curve = SubResource("curve_1")

[node name="PathFollow3D" type="PathFollow3D" parent="."]
`,
        { ruleName: 'path3d-unused' }
      );
    });

    it('should not warn when Path3D has multiple PathFollow3D children', () => {
      expectNoDiagnostic(
        `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="CameraRail" type="Path3D"]
curve = SubResource("curve_1")

[node name="PathFollow3D1" type="PathFollow3D" parent="."]

[node name="PathFollow3D2" type="PathFollow3D" parent="."]
`,
        { ruleName: 'path3d-unused' }
      );
    });

    it('should detect nested PathFollow3D children', () => {
      expectNoDiagnostic(
        `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="Path3D" type="Path3D"]
curve = SubResource("curve_1")

[node name="Container" type="Node3D" parent="."]

[node name="PathFollow3D" type="PathFollow3D" parent="Container"]
`,
        { ruleName: 'path3d-unused' }
      );
    });

    it('should warn when Path3D has other children but no PathFollow3D', () => {
      expectDiagnostic(
        `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="Path3D" type="Path3D"]
curve = SubResource("curve_1")

[node name="MeshInstance3D" type="MeshInstance3D" parent="."]

[node name="Camera3D" type="Camera3D" parent="."]
`,
        { ruleName: 'path3d-unused', severity: 'warning' }
      );
    });
  });

  describe('Combined Validation', () => {
    it('should report errors for nonexistent curve resource', () => {
      const content = scene(
        node('Path3D', { curve: 'SubResource("nonexistent_curve")' }, { name: 'Path3D1' })
      );

      const diagnostics = lint(content);
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
      expectClean(`[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="CameraPath" type="Path3D"]
curve = SubResource("curve_1")

[node name="Camera" type="PathFollow3D" parent="."]
`);
    });

    it('should handle multiple Path3D nodes in scene', () => {
      expectClean(`[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]
[sub_resource type="Curve3D" id="curve_2"]

[node name="Root" type="Node3D"]

[node name="CameraRail" type="Path3D" parent="."]
curve = SubResource("curve_1")

[node name="Camera" type="PathFollow3D" parent="CameraRail"]

[node name="PlatformPath" type="Path3D" parent="."]
curve = SubResource("curve_2")

[node name="Platform" type="PathFollow3D" parent="PlatformPath"]
`);
    });
  });

  describe('Edge Cases', () => {
    it('should handle Path3D with ExtResource curve reference', () => {
      expectClean(`[gd_scene format=3]

[ext_resource type="Curve3D" path="res://paths/camera_rail.tres" id="curve_ext"]

[node name="Path3D" type="Path3D"]
curve = ExtResource("curve_ext")

[node name="PathFollow3D" type="PathFollow3D" parent="."]
`);
    });

    it('should handle missing curve and format error together', () => {
      const content = scene(node('Path3D'));

      // Should have missing curve error
      expectDiagnostic(content, { ruleName: 'path3d-requires-curve', severity: 'warning' });

      // Should also have unused warning
      expectDiagnostic(content, { ruleName: 'path3d-unused', severity: 'warning' });
    });

    it('should handle Path3D with invalid curve format', () => {
      // When there's a format error during strict parsing, semantic validation doesn't run
      // So we only expect the format error from the strict parser
      expectDiagnostic(scene(node('Path3D', { curve: 'invalid_value' })), {
        ruleName: 'strict-parser',
        severity: 'error',
        contains: ['resource reference'],
      });
    });

    it('should not run Path3D rules on other node types', () => {
      const diagnostics = lint(scene(node('Node3D', {}, { name: 'NotPath3D' })));
      // Should not produce Path3D-specific errors
      const path3dErrors = diagnostics.filter(d =>
        d.ruleName?.includes('path3d') ||
        d.nodeType === 'Path3D'
      );
      expect(path3dErrors).toHaveLength(0);
    });

    it('should handle Path3D with PathFollow3D via intermediate nodes', () => {
      expectNoDiagnostic(
        `[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="Path3D" type="Path3D"]
curve = SubResource("curve_1")

[node name="Container" type="Node3D" parent="."]

[node name="PathFollow3D" type="PathFollow3D" parent="Container"]
`,
        { ruleName: 'path3d-unused' }
      );
    });

    it('should handle Path3D as child of another node', () => {
      expectClean(`[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="Root" type="Node3D"]

[node name="CameraRail" type="Path3D" parent="."]
curve = SubResource("curve_1")

[node name="Camera" type="PathFollow3D" parent="CameraRail"]
`);
    });

    it('should handle Path3D with PathFollow3D child (enemy path use case)', () => {
      expectClean(`[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="EnemyPath" type="Path3D"]
curve = SubResource("curve_1")

[node name="Enemy" type="PathFollow3D" parent="."]
`);
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

      const diagnostics = lint(content);
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
      expectClean(`[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="CameraRail" type="Path3D"]
curve = SubResource("curve_1")

[node name="CameraPosition" type="PathFollow3D" parent="."]
rotation_mode = 4
cubic_interp = true

[node name="Camera3D" type="Camera3D" parent="CameraPosition"]
`);
    });

    it('should handle Path3D used for moving platforms (common use case)', () => {
      expectClean(`[gd_scene format=3]

[sub_resource type="Curve3D" id="curve_1"]

[node name="PlatformPath" type="Path3D"]
curve = SubResource("curve_1")

[node name="PathFollow3D" type="PathFollow3D" parent="."]
loop = true

[node name="Platform" type="MeshInstance3D" parent="PathFollow3D"]
`);
    });
  });
});
