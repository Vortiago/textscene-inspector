/**
 * Tests for WorldEnvironment linter (strict parser + semantic rules)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../linter/Linter';
import './linterParser';
import './linter';

describe('WorldEnvironment Linter', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  describe('Strict Parser Validation (Format)', () => {
    it('should pass validation for valid WorldEnvironment with environment', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Environment" id="env_1"]

[node name="WorldEnvironment" type="WorldEnvironment"]
environment = SubResource("env_1")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should pass validation for valid WorldEnvironment with both properties', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Environment" id="env_1"]
[sub_resource type="CameraAttributesPractical" id="cam_attr_1"]

[node name="WorldEnvironment" type="WorldEnvironment"]
environment = SubResource("env_1")
camera_attributes = SubResource("cam_attr_1")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    describe('environment property validation', () => {
      it('should accept valid environment SubResource reference', () => {
        const content = `[gd_scene format=3]

[sub_resource type="Environment" id="env_1"]

[node name="WorldEnvironment" type="WorldEnvironment"]
environment = SubResource("env_1")
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept valid environment ExtResource reference', () => {
        const content = `[gd_scene format=3]

[ext_resource type="Environment" path="res://environment.tres" id="env_ext"]

[node name="WorldEnvironment" type="WorldEnvironment"]
environment = ExtResource("env_ext")
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject invalid environment reference format', () => {
        const content = `[gd_scene format=3]

[node name="WorldEnvironment" type="WorldEnvironment"]
environment = "invalid_format"
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const formatError = diagnostics.find(d => d.message.includes('resource reference'));
        expect(formatError).toBeDefined();
        expect(formatError?.severity).toBe('error');
        expect(formatError?.message).toContain('environment');
      });

      it('should reject environment with missing quotes', () => {
        const content = `[gd_scene format=3]

[node name="WorldEnvironment" type="WorldEnvironment"]
environment = SubResource(env_1)
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const formatError = diagnostics.find(d => d.message.includes('resource reference'));
        expect(formatError).toBeDefined();
      });

      it('should reject environment with invalid resource type', () => {
        const content = `[gd_scene format=3]

[node name="WorldEnvironment" type="WorldEnvironment"]
environment = InvalidResource("env_1")
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const formatError = diagnostics.find(d => d.message.includes('resource reference'));
        expect(formatError).toBeDefined();
      });
    });

    describe('camera_attributes property validation', () => {
      it('should accept valid camera_attributes SubResource reference', () => {
        const content = `[gd_scene format=3]

[sub_resource type="Environment" id="env_1"]
[sub_resource type="CameraAttributesPractical" id="cam_attr_1"]

[node name="WorldEnvironment" type="WorldEnvironment"]
environment = SubResource("env_1")
camera_attributes = SubResource("cam_attr_1")
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept valid camera_attributes ExtResource reference', () => {
        const content = `[gd_scene format=3]

[sub_resource type="Environment" id="env_1"]
[ext_resource type="CameraAttributesPhysical" path="res://camera.tres" id="cam_ext"]

[node name="WorldEnvironment" type="WorldEnvironment"]
environment = SubResource("env_1")
camera_attributes = ExtResource("cam_ext")
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject invalid camera_attributes reference format', () => {
        const content = `[gd_scene format=3]

[sub_resource type="Environment" id="env_1"]

[node name="WorldEnvironment" type="WorldEnvironment"]
environment = SubResource("env_1")
camera_attributes = invalid
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const formatError = diagnostics.find(d => d.message.includes('camera_attributes') && d.message.includes('resource reference'));
        expect(formatError).toBeDefined();
        expect(formatError?.severity).toBe('error');
      });
    });
  });

  describe('Semantic Validation (Resource Existence)', () => {
    describe('environment resource existence', () => {
      it('should detect missing environment property', () => {
        const content = `[gd_scene format=3]

[node name="WorldEnvironment" type="WorldEnvironment"]
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const missingError = diagnostics.find(d => d.ruleName === 'worldenvironment-requires-environment');
        expect(missingError).toBeDefined();
        expect(missingError?.severity).toBe('error');
        expect(missingError?.message).toContain('requires an \'environment\' property');
        expect(missingError?.message).toContain('does nothing');
      });

      it('should detect non-existent environment resource', () => {
        const content = `[gd_scene format=3]

[node name="WorldEnvironment" type="WorldEnvironment"]
environment = SubResource("nonexistent_env")
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const resourceError = diagnostics.find(d => d.message.includes('Environment resource not found'));
        expect(resourceError).toBeDefined();
        expect(resourceError?.severity).toBe('error');
        expect(resourceError?.ruleName).toBe('valid-worldenvironment-resources');
      });

      it('should pass when environment resource exists', () => {
        const content = `[gd_scene format=3]

[sub_resource type="Environment" id="env_1"]

[node name="WorldEnvironment" type="WorldEnvironment"]
environment = SubResource("env_1")
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });
    });

    describe('camera_attributes resource existence', () => {
      it('should warn about non-existent camera_attributes resource', () => {
        const content = `[gd_scene format=3]

[sub_resource type="Environment" id="env_1"]

[node name="WorldEnvironment" type="WorldEnvironment"]
environment = SubResource("env_1")
camera_attributes = SubResource("nonexistent_cam")
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const warningDiag = diagnostics.find(d => d.message.includes('Camera attributes resource not found'));
        expect(warningDiag).toBeDefined();
        expect(warningDiag?.severity).toBe('warning');
        expect(warningDiag?.ruleName).toBe('valid-worldenvironment-resources');
      });

      it('should pass when camera_attributes resource exists', () => {
        const content = `[gd_scene format=3]

[sub_resource type="Environment" id="env_1"]
[sub_resource type="CameraAttributesPractical" id="cam_attr_1"]

[node name="WorldEnvironment" type="WorldEnvironment"]
environment = SubResource("env_1")
camera_attributes = SubResource("cam_attr_1")
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should pass when camera_attributes is not specified', () => {
        const content = `[gd_scene format=3]

[sub_resource type="Environment" id="env_1"]

[node name="WorldEnvironment" type="WorldEnvironment"]
environment = SubResource("env_1")
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });
    });
  });

  describe('Semantic Validation (Multiple WorldEnvironment)', () => {
    it('should warn when multiple WorldEnvironment nodes exist', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Environment" id="env_1"]
[sub_resource type="Environment" id="env_2"]

[node name="Root" type="Node3D"]

[node name="WorldEnvironment1" type="WorldEnvironment" parent="."]
environment = SubResource("env_1")

[node name="WorldEnvironment2" type="WorldEnvironment" parent="."]
environment = SubResource("env_2")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);

      const multipleWarnings = diagnostics.filter(d => d.ruleName === 'single-worldenvironment');
      expect(multipleWarnings.length).toBeGreaterThan(0);

      // Each WorldEnvironment node should get the warning
      expect(multipleWarnings[0].severity).toBe('warning');
      expect(multipleWarnings[0].message).toContain('2 WorldEnvironment nodes');
      expect(multipleWarnings[0].message).toContain('Only one WorldEnvironment should be active');
    });

    it('should warn with correct count for three WorldEnvironment nodes', () => {
      const content = `[gd_scene format=3]

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
`;

      const diagnostics = linter.lint(content);
      const multipleWarnings = diagnostics.filter(d => d.ruleName === 'single-worldenvironment');
      expect(multipleWarnings.length).toBeGreaterThan(0);
      expect(multipleWarnings[0].message).toContain('3 WorldEnvironment nodes');
    });

    it('should not warn when only one WorldEnvironment exists', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Environment" id="env_1"]

[node name="WorldEnvironment" type="WorldEnvironment"]
environment = SubResource("env_1")
`;

      const diagnostics = linter.lint(content);
      const multipleWarnings = diagnostics.filter(d => d.ruleName === 'single-worldenvironment');
      expect(multipleWarnings).toHaveLength(0);
    });

    it('should detect nested WorldEnvironment nodes', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Environment" id="env_1"]
[sub_resource type="Environment" id="env_2"]

[node name="Root" type="Node3D"]

[node name="WorldEnvironment1" type="WorldEnvironment" parent="."]
environment = SubResource("env_1")

[node name="Container" type="Node3D" parent="."]

[node name="WorldEnvironment2" type="WorldEnvironment" parent="Container"]
environment = SubResource("env_2")
`;

      const diagnostics = linter.lint(content);
      const multipleWarnings = diagnostics.filter(d => d.ruleName === 'single-worldenvironment');
      expect(multipleWarnings.length).toBeGreaterThan(0);
      expect(multipleWarnings[0].message).toContain('2 WorldEnvironment nodes');
    });
  });

  describe('Combined Validation', () => {
    it('should report multiple errors and warnings', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Environment" id="env_1"]

[node name="Root" type="Node3D"]

[node name="WorldEnvironment1" type="WorldEnvironment" parent="."]
environment = SubResource("nonexistent_env")
camera_attributes = SubResource("nonexistent_cam")

[node name="WorldEnvironment2" type="WorldEnvironment" parent="."]
environment = SubResource("env_1")
`;

      const diagnostics = linter.lint(content);
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
      const content = `[gd_scene format=3]

[sub_resource type="Environment" id="env_1"]
background_mode = 1
background_color = Color(0.2, 0.2, 0.3, 1)

[sub_resource type="CameraAttributesPractical" id="cam_attr_1"]
dof_blur_far_enabled = true

[node name="Root" type="Node3D"]

[node name="WorldEnvironment" type="WorldEnvironment" parent="."]
environment = SubResource("env_1")
camera_attributes = SubResource("cam_attr_1")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle WorldEnvironment with only environment (no camera_attributes)', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Environment" id="env_1"]

[node name="WorldEnvironment" type="WorldEnvironment"]
environment = SubResource("env_1")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle WorldEnvironment with ExtResource references', () => {
      const content = `[gd_scene format=3]

[ext_resource type="Environment" path="res://default_env.tres" id="env_ext"]
[ext_resource type="CameraAttributesPhysical" path="res://camera.tres" id="cam_ext"]

[node name="WorldEnvironment" type="WorldEnvironment"]
environment = ExtResource("env_ext")
camera_attributes = ExtResource("cam_ext")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle missing environment and format error together', () => {
      const content = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="WorldEnvironment" type="WorldEnvironment" parent="."]
camera_attributes = invalid_format
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

    it('should handle WorldEnvironment with no properties at all', () => {
      const content = `[gd_scene format=3]

[node name="WorldEnvironment" type="WorldEnvironment"]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const missingError = diagnostics.find(d => d.ruleName === 'worldenvironment-requires-environment');
      expect(missingError).toBeDefined();
      expect(missingError?.severity).toBe('error');
    });

    it('should not run WorldEnvironment rules on other node types', () => {
      const content = `[gd_scene format=3]

[node name="NotWorldEnv" type="Node3D"]
`;

      const diagnostics = linter.lint(content);
      // Should not produce WorldEnvironment-specific errors
      const worldEnvErrors = diagnostics.filter(d =>
        d.ruleName?.includes('worldenvironment') ||
        d.nodeType === 'WorldEnvironment'
      );
      expect(worldEnvErrors).toHaveLength(0);
    });

    it('should handle mixed valid and invalid WorldEnvironment nodes', () => {
      const content = `[gd_scene format=3]

[sub_resource type="Environment" id="env_1"]

[node name="Root" type="Node3D"]

[node name="ValidWorldEnv" type="WorldEnvironment" parent="."]
environment = SubResource("env_1")

[node name="InvalidWorldEnv" type="WorldEnvironment" parent="."]
environment = SubResource("nonexistent")
`;

      const diagnostics = linter.lint(content);
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
