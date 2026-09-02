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
// The Environment slice's validators: the `sky` slot inside the sub-resource.
import '../../../resources/environment/index.linter';

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
            severity: 'warning',
            contains: ["neither an 'environment' nor a 'camera_attributes'", 'no visible effect'],
          }
        );
      });

      it('stays quiet on a camera_attributes-only node, which Godot accepts', () => {
        // world_environment.cpp:187 guards on `environment.is_null() &&
        // camera_attributes.is_null()`. Either resource gives the node an
        // effect; testing `environment` alone warned about a valid scene.
        expectNoDiagnostic(
          `[gd_scene load_steps=2 format=3]

[sub_resource type="CameraAttributesPractical" id="Cam_1"]

[node name="WorldEnvironment" type="WorldEnvironment"]
camera_attributes = SubResource("Cam_1")
`,
          { ruleName: 'worldenvironment-requires-environment' }
        );
      });

      it('treats a leading cleared environment as an empty slot, not as the winner', () => {
        // `environment = null` is `Ref::is_null()`, so the node never joins the
        // group (world_environment.cpp:39-40) and the next one along is the one
        // Godot honours — while the cleared node itself has no visible effect.
        const content = `[gd_scene format=3]

[sub_resource type="Environment" id="env_1"]

[node name="Root" type="Node3D"]

[node name="ClearedEnv" type="WorldEnvironment" parent="."]
environment = null

[node name="RealEnv" type="WorldEnvironment" parent="."]
environment = SubResource("env_1")
`;

        expectNoDiagnostic(content, { ruleName: 'single-worldenvironment' });
        expectNoDiagnostic(content, { ruleName: 'dangling-resource-reference' });
        const cleared = expectDiagnostic(content, {
          ruleName: 'worldenvironment-requires-environment',
          severity: 'warning',
        });
        expect(cleared.nodeName).toBe('ClearedEnv');
      });

      it('should detect non-existent environment resource', () => {
        expectDiagnostic(
          `[gd_scene format=3]

[node name="WorldEnvironment" type="WorldEnvironment"]
environment = SubResource("nonexistent_env")
`,
          {
            ruleName: 'dangling-resource-reference',
            severity: 'error',
            contains: ["'environment'"],
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

    describe('sky resource existence (inside the Environment subresource)', () => {
      it('should detect a non-existent sky resource', () => {
        expectDiagnostic(
          `[gd_scene format=3]

[sub_resource type="Environment" id="env_1"]
background_mode = 2
sky = SubResource("Sky_missing")

[node name="WorldEnvironment" type="WorldEnvironment"]
environment = SubResource("env_1")
`,
          {
            ruleName: 'dangling-resource-reference',
            severity: 'error',
            contains: ["'sky'"],
          }
        );
      });

      it('should pass when the sky resource exists', () => {
        expectClean(`[gd_scene format=3]

[sub_resource type="ProceduralSkyMaterial" id="Sky_mat"]

[sub_resource type="Sky" id="Sky_1"]
sky_material = SubResource("Sky_mat")

[sub_resource type="Environment" id="env_1"]
background_mode = 2
sky = SubResource("Sky_1")

[node name="WorldEnvironment" type="WorldEnvironment"]
environment = SubResource("env_1")
`);
      });

      it('should pass when the Environment has no sky property', () => {
        expectNoDiagnostic(
          `[gd_scene format=3]

[sub_resource type="Environment" id="env_1"]
background_mode = 1

[node name="WorldEnvironment" type="WorldEnvironment"]
environment = SubResource("env_1")
`,
          { prop: "'sky'" }
        );
      });
    });

    describe('camera_attributes resource existence', () => {
      it('errors on a non-existent camera_attributes resource', () => {
        expectDiagnostic(
          `[gd_scene format=3]

[sub_resource type="Environment" id="env_1"]

[node name="WorldEnvironment" type="WorldEnvironment"]
environment = SubResource("env_1")
camera_attributes = SubResource("nonexistent_cam")
`,
          {
            ruleName: 'dangling-resource-reference',
            severity: 'error',
            contains: ["'camera_attributes'"],
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

  // `get_configuration_warnings` carries the same first-wins test three times,
  // one per resource slot (world_environment.cpp:195-205), each fed by its own
  // group and its own `_update_current_*` (:39-52, :75-105). A node can win one
  // group and lose another, so the winner is resolved per slot.
  describe('the camera_attributes and compositor groups', () => {
    it('warns on the second node to declare camera_attributes', () => {
      expectDiagnostic(
        `[gd_scene format=3]

[sub_resource type="CameraAttributesPractical" id="cam_1"]
[sub_resource type="CameraAttributesPractical" id="cam_2"]

[node name="Root" type="Node3D"]

[node name="WE1" type="WorldEnvironment" parent="."]
camera_attributes = SubResource("cam_1")

[node name="WE2" type="WorldEnvironment" parent="."]
camera_attributes = SubResource("cam_2")
`,
        {
          ruleName: 'single-worldenvironment',
          severity: 'warning',
          prop: "'WE2'",
          contains: ['Only one WorldEnvironment is allowed per scene'],
        }
      );
    });

    it('warns on the second node to declare a compositor', () => {
      expectDiagnostic(
        `[gd_scene format=3]

[sub_resource type="Compositor" id="c_1"]
[sub_resource type="Compositor" id="c_2"]

[node name="Root" type="Node3D"]

[node name="WE1" type="WorldEnvironment" parent="."]
compositor = SubResource("c_1")

[node name="WE2" type="WorldEnvironment" parent="."]
compositor = SubResource("c_2")
`,
        {
          ruleName: 'single-worldenvironment',
          severity: 'warning',
          prop: "'WE2'",
          contains: ['Only the first Compositor has an effect'],
        }
      );
    });

    it('resolves each group independently, so an environment-only leader does not claim the rest', () => {
      // WE1 joins only the environment group, so WE2 is FIRST in the compositor
      // one and Godot says nothing about its compositor.
      const diagnostics = lint(`[gd_scene format=3]

[sub_resource type="Environment" id="env_1"]
[sub_resource type="Compositor" id="c_1"]

[node name="Root" type="Node3D"]

[node name="WE1" type="WorldEnvironment" parent="."]
environment = SubResource("env_1")

[node name="WE2" type="WorldEnvironment" parent="."]
compositor = SubResource("c_1")
`);
      expect(diagnostics.filter((d) => d.ruleName === 'single-worldenvironment')).toEqual([]);
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
          prop: "'WorldEnvironment2'",
          contains: ['Only the first Environment has an effect'],
        }
      );
    });

    // world_environment.cpp:195 compares against the world's own Environment, and
    // `_update_current_environment` (:76-80) took that from the FIRST node in the
    // group. The first node's comparison is therefore equal, and Godot says nothing.
    it('leaves the first WorldEnvironment alone, since it is the one that wins', () => {
      const diagnostics = lint(`[gd_scene format=3]

[sub_resource type="Environment" id="env_1"]
[sub_resource type="Environment" id="env_2"]

[node name="Root" type="Node3D"]

[node name="WorldEnvironment1" type="WorldEnvironment" parent="."]
environment = SubResource("env_1")

[node name="WorldEnvironment2" type="WorldEnvironment" parent="."]
environment = SubResource("env_2")
`);
      const named = diagnostics.filter((d) => d.ruleName === 'single-worldenvironment');
      expect(named.map((d) => d.nodeName)).toEqual(['WorldEnvironment2']);
    });

    // The engine's test is `Ref<Environment> != environment`, i.e. resource
    // identity. Two nodes naming one ExtResource hold the same instance.
    it('stays silent when both nodes name the same environment resource', () => {
      expectNoDiagnostic(
        `[gd_scene format=3]

[ext_resource type="Environment" path="res://shared.tres" id="env_1"]

[node name="Root" type="Node3D"]

[node name="WorldEnvironment1" type="WorldEnvironment" parent="."]
environment = ExtResource("env_1")

[node name="WorldEnvironment2" type="WorldEnvironment" parent="."]
environment = ExtResource("env_1")
`,
        { ruleName: 'single-worldenvironment' }
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
        { ruleName: 'single-worldenvironment', prop: "'WorldEnvironment3'" }
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
        { ruleName: 'single-worldenvironment', prop: "'WorldEnvironment2'" }
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

      const envError = diagnostics.find(d => d.message.includes("'environment'"));
      expect(envError).toBeDefined();

      const camWarning = diagnostics.find(d => d.message.includes("'camera_attributes'"));
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

    it('reads an empty environment value as an empty slot, not as a reference that failed to resolve', () => {
      // `environment = ` is a format error, and the strict parser reports it.
      // The semantic rule must then read the slot the way every other swept
      // resource slot reads it, as holding nothing, rather than resolving
      // `''` as a reference and reporting a second, rule-level error, and
      // rather than counting the node as one that declares an environment,
      // which hands it the group's first place and blames the node that
      // actually has one.
      const content = `[gd_scene format=3]

[sub_resource type="Environment" id="env_1"]

[node name="Root" type="Node3D"]

[node name="Empty" type="WorldEnvironment" parent="."]
environment =

[node name="Real" type="WorldEnvironment" parent="."]
environment = SubResource("env_1")
`;
      expectDiagnostic(content, { ruleName: 'strict-parser', severity: 'error' });
      expectNoDiagnostic(content, { ruleName: 'dangling-resource-reference' });
      expectNoDiagnostic(content, { ruleName: 'single-worldenvironment' });
      expectDiagnostic(content, {
        ruleName: 'worldenvironment-requires-environment',
        severity: 'warning',
      });
    });

    it('should handle WorldEnvironment with no properties at all', () => {
      expectDiagnostic(
        `[gd_scene format=3]

[node name="WorldEnvironment" type="WorldEnvironment"]
`,
        { ruleName: 'worldenvironment-requires-environment', severity: 'warning' }
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
        d.message.includes("'environment'")
      );
      expect(resourceError).toBeDefined();

      // Should also have multiple WorldEnvironment warning
      const multipleWarning = diagnostics.find(d => d.ruleName === 'single-worldenvironment');
      expect(multipleWarning).toBeDefined();
    });
  });
});
