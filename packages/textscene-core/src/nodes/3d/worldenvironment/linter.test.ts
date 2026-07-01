/**
 * Tests for WorldEnvironment linter (strict parser + semantic rules)
 *
 * Fixtures use `sub_resource`/`ext_resource` headings (resource existence is the
 * point of these rules), which the kit's node()/scene() builders can't express,
 * so the content strings stay raw — but every assert triplet collapses onto the
 * kit helpers.
 */

import { describe, it, expect } from 'vitest';
import {
  lint,
  expectClean,
  expectDiagnostic,
  expectNoDiagnostic,
} from '../../../linter/testing/testkit';
import './linterParser';
import './linter';

describe('WorldEnvironment Linter', () => {
  describe('Strict Parser Validation (Format)', () => {
    it('should pass validation for valid WorldEnvironment with environment', () => {
      expectClean(`[gd_scene format=3]

[sub_resource type="Environment" id="env_1"]

[node name="WorldEnvironment" type="WorldEnvironment"]
environment = SubResource("env_1")
`);
    });

    it('should pass validation for valid WorldEnvironment with both properties', () => {
      expectClean(`[gd_scene format=3]

[sub_resource type="Environment" id="env_1"]
[sub_resource type="CameraAttributesPractical" id="cam_attr_1"]

[node name="WorldEnvironment" type="WorldEnvironment"]
environment = SubResource("env_1")
camera_attributes = SubResource("cam_attr_1")
`);
    });

    describe('environment property validation', () => {
      it('should accept valid environment SubResource reference', () => {
        expectClean(`[gd_scene format=3]

[sub_resource type="Environment" id="env_1"]

[node name="WorldEnvironment" type="WorldEnvironment"]
environment = SubResource("env_1")
`);
      });

      it('should accept valid environment ExtResource reference', () => {
        expectClean(`[gd_scene format=3]

[ext_resource type="Environment" path="res://environment.tres" id="env_ext"]

[node name="WorldEnvironment" type="WorldEnvironment"]
environment = ExtResource("env_ext")
`);
      });

      it('should reject invalid environment reference format', () => {
        expectDiagnostic(
          `[gd_scene format=3]

[node name="WorldEnvironment" type="WorldEnvironment"]
environment = "invalid_format"
`,
          { prop: 'resource reference', severity: 'error', contains: ['environment'] }
        );
      });

      it('should reject environment with missing quotes', () => {
        expectDiagnostic(
          `[gd_scene format=3]

[node name="WorldEnvironment" type="WorldEnvironment"]
environment = SubResource(env_1)
`,
          { prop: 'resource reference' }
        );
      });

      it('should reject environment with invalid resource type', () => {
        expectDiagnostic(
          `[gd_scene format=3]

[node name="WorldEnvironment" type="WorldEnvironment"]
environment = InvalidResource("env_1")
`,
          { prop: 'resource reference' }
        );
      });
    });

    describe('camera_attributes property validation', () => {
      it('should accept valid camera_attributes SubResource reference', () => {
        expectClean(`[gd_scene format=3]

[sub_resource type="Environment" id="env_1"]
[sub_resource type="CameraAttributesPractical" id="cam_attr_1"]

[node name="WorldEnvironment" type="WorldEnvironment"]
environment = SubResource("env_1")
camera_attributes = SubResource("cam_attr_1")
`);
      });

      it('should accept valid camera_attributes ExtResource reference', () => {
        expectClean(`[gd_scene format=3]

[sub_resource type="Environment" id="env_1"]
[ext_resource type="CameraAttributesPhysical" path="res://camera.tres" id="cam_ext"]

[node name="WorldEnvironment" type="WorldEnvironment"]
environment = SubResource("env_1")
camera_attributes = ExtResource("cam_ext")
`);
      });

      it('should reject invalid camera_attributes reference format', () => {
        expectDiagnostic(
          `[gd_scene format=3]

[sub_resource type="Environment" id="env_1"]

[node name="WorldEnvironment" type="WorldEnvironment"]
environment = SubResource("env_1")
camera_attributes = invalid
`,
          { prop: 'camera_attributes', severity: 'error', contains: ['resource reference'] }
        );
      });
    });
  });

  describe('Semantic Validation (Resource Existence)', () => {
    describe('environment resource existence', () => {
      it('should detect missing environment property', () => {
        expectDiagnostic(
          `[gd_scene format=3]

[node name="WorldEnvironment" type="WorldEnvironment"]
`,
          {
            ruleName: 'worldenvironment-requires-environment',
            severity: 'error',
            contains: ["requires an 'environment' property", 'does nothing'],
          }
        );
      });

      it('should detect non-existent environment resource', () => {
        expectDiagnostic(
          `[gd_scene format=3]

[node name="WorldEnvironment" type="WorldEnvironment"]
environment = SubResource("nonexistent_env")
`,
          {
            ruleName: 'valid-worldenvironment-resources',
            severity: 'error',
            contains: ['Environment resource not found'],
          }
        );
      });

      it('should pass when environment resource exists', () => {
        expectClean(`[gd_scene format=3]

[sub_resource type="Environment" id="env_1"]

[node name="WorldEnvironment" type="WorldEnvironment"]
environment = SubResource("env_1")
`);
      });
    });

    describe('camera_attributes resource existence', () => {
      it('should warn about non-existent camera_attributes resource', () => {
        expectDiagnostic(
          `[gd_scene format=3]

[sub_resource type="Environment" id="env_1"]

[node name="WorldEnvironment" type="WorldEnvironment"]
environment = SubResource("env_1")
camera_attributes = SubResource("nonexistent_cam")
`,
          {
            ruleName: 'valid-worldenvironment-resources',
            severity: 'warning',
            contains: ['Camera attributes resource not found'],
          }
        );
      });

      it('should pass when camera_attributes resource exists', () => {
        expectClean(`[gd_scene format=3]

[sub_resource type="Environment" id="env_1"]
[sub_resource type="CameraAttributesPractical" id="cam_attr_1"]

[node name="WorldEnvironment" type="WorldEnvironment"]
environment = SubResource("env_1")
camera_attributes = SubResource("cam_attr_1")
`);
      });

      it('should pass when camera_attributes is not specified', () => {
        expectClean(`[gd_scene format=3]

[sub_resource type="Environment" id="env_1"]

[node name="WorldEnvironment" type="WorldEnvironment"]
environment = SubResource("env_1")
`);
      });
    });
  });

  describe('Semantic Validation (Multiple WorldEnvironment)', () => {
    it('should warn when multiple WorldEnvironment nodes exist', () => {
      expectDiagnostic(
        `[gd_scene format=3]

[sub_resource type="Environment" id="env_1"]
[sub_resource type="Environment" id="env_2"]

[node name="Root" type="Node3D"]

[node name="WorldEnvironment1" type="WorldEnvironment" parent="."]
environment = SubResource("env_1")

[node name="WorldEnvironment2" type="WorldEnvironment" parent="."]
environment = SubResource("env_2")
`,
        {
          ruleName: 'single-worldenvironment',
          severity: 'warning',
          contains: ['2 WorldEnvironment nodes', 'Only one WorldEnvironment should be active'],
        }
      );
    });

    it('should warn with correct count for three WorldEnvironment nodes', () => {
      expectDiagnostic(
        `[gd_scene format=3]

[sub_resource type="Environment" id="env_1"]
[sub_resource type="Environment" id="env_2"]
[sub_resource type="Environment" id="env_3"]

[node name="Root" type="Node3D"]

[node name="WorldEnvironment1" type="WorldEnvironment" parent="."]
environment = SubResource("env_1")

[node name="WorldEnvironment2" type="WorldEnvironment" parent="."]
environment = SubResource("env_2")

[node name="WorldEnvironment3" type="WorldEnvironment" parent="."]
environment = SubResource("env_3")
`,
        { ruleName: 'single-worldenvironment', contains: ['3 WorldEnvironment nodes'] }
      );
    });

    it('should not warn when only one WorldEnvironment exists', () => {
      expectNoDiagnostic(
        `[gd_scene format=3]

[sub_resource type="Environment" id="env_1"]

[node name="WorldEnvironment" type="WorldEnvironment"]
environment = SubResource("env_1")
`,
        { ruleName: 'single-worldenvironment' }
      );
    });

    it('should detect nested WorldEnvironment nodes', () => {
      expectDiagnostic(
        `[gd_scene format=3]

[sub_resource type="Environment" id="env_1"]
[sub_resource type="Environment" id="env_2"]

[node name="Root" type="Node3D"]

[node name="WorldEnvironment1" type="WorldEnvironment" parent="."]
environment = SubResource("env_1")

[node name="Container" type="Node3D" parent="."]

[node name="WorldEnvironment2" type="WorldEnvironment" parent="Container"]
environment = SubResource("env_2")
`,
        { ruleName: 'single-worldenvironment', contains: ['2 WorldEnvironment nodes'] }
      );
    });
  });

  describe('Combined Validation', () => {
    it('should report multiple errors and warnings', () => {
      const diagnostics = lint(`[gd_scene format=3]

[sub_resource type="Environment" id="env_1"]

[node name="Root" type="Node3D"]

[node name="WorldEnvironment1" type="WorldEnvironment" parent="."]
environment = SubResource("nonexistent_env")
camera_attributes = SubResource("nonexistent_cam")

[node name="WorldEnvironment2" type="WorldEnvironment" parent="."]
environment = SubResource("env_1")
`);
      expect(diagnostics.length).toBeGreaterThan(0);

      // Should have environment resource not found error
      const envError = diagnostics.find(d => d.message.includes('Environment resource not found'));
      expect(envError).toBeDefined();

      // Should have camera attributes warning
      const camWarning = diagnostics.find(d => d.message.includes('Camera attributes resource not found'));
      expect(camWarning).toBeDefined();

      // Should have multiple WorldEnvironment warning
      const multipleWarning = diagnostics.find(d => d.ruleName === 'single-worldenvironment');
      expect(multipleWarning).toBeDefined();
    });

    it('should validate WorldEnvironment with all properties and resources', () => {
      expectClean(`[gd_scene format=3]

[sub_resource type="Environment" id="env_1"]
background_mode = 1
background_color = Color(0.2, 0.2, 0.3, 1)

[sub_resource type="CameraAttributesPractical" id="cam_attr_1"]
dof_blur_far_enabled = true

[node name="Root" type="Node3D"]

[node name="WorldEnvironment" type="WorldEnvironment" parent="."]
environment = SubResource("env_1")
camera_attributes = SubResource("cam_attr_1")
`);
    });

    it('should handle WorldEnvironment with only environment (no camera_attributes)', () => {
      expectClean(`[gd_scene format=3]

[sub_resource type="Environment" id="env_1"]

[node name="WorldEnvironment" type="WorldEnvironment"]
environment = SubResource("env_1")
`);
    });
  });

  describe('Edge Cases', () => {
    it('should handle WorldEnvironment with ExtResource references', () => {
      expectClean(`[gd_scene format=3]

[ext_resource type="Environment" path="res://default_env.tres" id="env_ext"]
[ext_resource type="CameraAttributesPhysical" path="res://camera.tres" id="cam_ext"]

[node name="WorldEnvironment" type="WorldEnvironment"]
environment = ExtResource("env_ext")
camera_attributes = ExtResource("cam_ext")
`);
    });

    it('should handle missing environment and format error together', () => {
      // When there's a format error during strict parsing, semantic validation doesn't run
      // So we only expect the format error from the strict parser
      expectDiagnostic(
        `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="WorldEnvironment" type="WorldEnvironment" parent="."]
camera_attributes = invalid_format
`,
        { ruleName: 'strict-parser', severity: 'error', contains: ['resource reference'] }
      );
    });

    it('should handle WorldEnvironment with no properties at all', () => {
      expectDiagnostic(
        `[gd_scene format=3]

[node name="WorldEnvironment" type="WorldEnvironment"]
`,
        { ruleName: 'worldenvironment-requires-environment', severity: 'error' }
      );
    });

    it('should not run WorldEnvironment rules on other node types', () => {
      const diagnostics = lint(`[gd_scene format=3]

[node name="NotWorldEnv" type="Node3D"]
`);
      // Should not produce WorldEnvironment-specific errors
      const worldEnvErrors = diagnostics.filter(d =>
        d.ruleName?.includes('worldenvironment') ||
        d.nodeType === 'WorldEnvironment'
      );
      expect(worldEnvErrors).toHaveLength(0);
    });

    it('should handle mixed valid and invalid WorldEnvironment nodes', () => {
      const diagnostics = lint(`[gd_scene format=3]

[sub_resource type="Environment" id="env_1"]

[node name="Root" type="Node3D"]

[node name="ValidWorldEnv" type="WorldEnvironment" parent="."]
environment = SubResource("env_1")

[node name="InvalidWorldEnv" type="WorldEnvironment" parent="."]
environment = SubResource("nonexistent")
`);
      expect(diagnostics.length).toBeGreaterThan(0);

      // Should have resource not found error for InvalidWorldEnv
      const resourceError = diagnostics.find(d =>
        d.nodeName === 'InvalidWorldEnv' &&
        d.message.includes('Environment resource not found')
      );
      expect(resourceError).toBeDefined();

      // Should also have multiple WorldEnvironment warning
      const multipleWarning = diagnostics.find(d => d.ruleName === 'single-worldenvironment');
      expect(multipleWarning).toBeDefined();
    });
  });
});
