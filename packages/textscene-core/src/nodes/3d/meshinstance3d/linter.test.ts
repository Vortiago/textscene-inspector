/**
 * Tests for MeshInstance3D linter (strict parser + semantic rules)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../linter/Linter';
import './linterParser';
import './linter';

describe('MeshInstance3D Linter', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  describe('Strict Parser Validation (Format)', () => {
    it('should pass validation for valid MeshInstance3D properties', () => {
      const content = `[gd_scene format=3]

[sub_resource type="BoxMesh" id="mesh_1"]

[sub_resource type="StandardMaterial3D" id="mat_1"]

[node name="ValidMesh" type="MeshInstance3D"]
cast_shadow = 1
mesh = SubResource("mesh_1")
surface_material_override/0 = SubResource("mat_1")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    describe('cast_shadow validation', () => {
      it('should detect invalid cast_shadow value', () => {
        const content = `[gd_scene format=3]

[node name="InvalidShadow" type="MeshInstance3D"]
cast_shadow = 99
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0]).toMatchObject({
          severity: 'error',
          ruleName: 'strict-parser',
        });
        expect(diagnostics[0].message).toContain('cast_shadow');
        expect(diagnostics[0].message).toContain('0-3');
      });

      it('should validate all valid cast_shadow values', () => {
        const validValues = [0, 1, 2, 3]; // OFF, ON, DOUBLE_SIDED, SHADOWS_ONLY

        for (const value of validValues) {
          const content = `[gd_scene format=3]

[node name="ValidShadow${value}" type="MeshInstance3D"]
cast_shadow = ${value}
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject negative cast_shadow value', () => {
        const content = `[gd_scene format=3]

[node name="NegativeShadow" type="MeshInstance3D"]
cast_shadow = -1
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('cast_shadow');
      });
    });

    describe('gi_mode validation', () => {
      it('should validate all valid gi_mode values', () => {
        const validValues = [0, 1, 2]; // DISABLED, STATIC, DYNAMIC

        for (const value of validValues) {
          const content = `[gd_scene format=3]

[node name="ValidGI${value}" type="MeshInstance3D"]
gi_mode = ${value}
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject invalid gi_mode value', () => {
        const content = `[gd_scene format=3]

[node name="InvalidGI" type="MeshInstance3D"]
gi_mode = 5
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('gi_mode');
        expect(diagnostics[0].message).toContain('0-2');
      });
    });

    describe('gi_lightmap_scale validation', () => {
      it('should validate all valid gi_lightmap_scale values', () => {
        const validValues = [0, 1, 2, 3]; // 1x, 2x, 4x, 8x

        for (const value of validValues) {
          const content = `[gd_scene format=3]

[node name="ValidLightmap${value}" type="MeshInstance3D"]
gi_lightmap_scale = ${value}
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject invalid gi_lightmap_scale value', () => {
        const content = `[gd_scene format=3]

[node name="InvalidLightmap" type="MeshInstance3D"]
gi_lightmap_scale = 10
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('gi_lightmap_scale');
        expect(diagnostics[0].message).toContain('0-3');
      });
    });

    describe('visibility_range properties validation', () => {
      it('should accept valid visibility_range_begin', () => {
        const content = `[gd_scene format=3]

[node name="ValidRange" type="MeshInstance3D"]
visibility_range_begin = 10.5
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject negative visibility_range_begin', () => {
        const content = `[gd_scene format=3]

[node name="NegativeRange" type="MeshInstance3D"]
visibility_range_begin = -5.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('visibility_range_begin');
        expect(diagnostics[0].message).toContain('non-negative');
      });

      it('should accept valid visibility_range_end', () => {
        const content = `[gd_scene format=3]

[node name="ValidRange" type="MeshInstance3D"]
visibility_range_end = 100.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject negative visibility_range_end', () => {
        const content = `[gd_scene format=3]

[node name="NegativeRange" type="MeshInstance3D"]
visibility_range_end = -10.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('visibility_range_end');
        expect(diagnostics[0].message).toContain('non-negative');
      });

      it('should accept valid visibility_range_begin_margin', () => {
        const content = `[gd_scene format=3]

[node name="ValidMargin" type="MeshInstance3D"]
visibility_range_begin_margin = 2.5
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject negative visibility_range_begin_margin', () => {
        const content = `[gd_scene format=3]

[node name="NegativeMargin" type="MeshInstance3D"]
visibility_range_begin_margin = -1.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('visibility_range_begin_margin');
        expect(diagnostics[0].message).toContain('non-negative');
      });

      it('should accept valid visibility_range_end_margin', () => {
        const content = `[gd_scene format=3]

[node name="ValidMargin" type="MeshInstance3D"]
visibility_range_end_margin = 5.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject negative visibility_range_end_margin', () => {
        const content = `[gd_scene format=3]

[node name="NegativeMargin" type="MeshInstance3D"]
visibility_range_end_margin = -3.0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('visibility_range_end_margin');
        expect(diagnostics[0].message).toContain('non-negative');
      });
    });

    describe('visibility_range_fade_mode validation', () => {
      it('should validate all valid visibility_range_fade_mode values', () => {
        const validValues = [0, 1, 2]; // DISABLED, SELF, DEPENDENCIES

        for (const value of validValues) {
          const content = `[gd_scene format=3]

[node name="ValidFade${value}" type="MeshInstance3D"]
visibility_range_fade_mode = ${value}
`;

          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject invalid visibility_range_fade_mode value', () => {
        const content = `[gd_scene format=3]

[node name="InvalidFade" type="MeshInstance3D"]
visibility_range_fade_mode = 5
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('visibility_range_fade_mode');
        expect(diagnostics[0].message).toContain('0-2');
      });
    });

    describe('layers validation', () => {
      it('should accept valid layers value', () => {
        const content = `[gd_scene format=3]

[node name="ValidLayers" type="MeshInstance3D"]
layers = 1
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept maximum valid layers value', () => {
        const content = `[gd_scene format=3]

[node name="MaxLayers" type="MeshInstance3D"]
layers = 1048575
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject layers value of 0', () => {
        const content = `[gd_scene format=3]

[node name="ZeroLayers" type="MeshInstance3D"]
layers = 0
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('layers');
        expect(diagnostics[0].message).toContain('1 and 1048575');
      });

      it('should reject layers value exceeding maximum', () => {
        const content = `[gd_scene format=3]

[node name="ExcessiveLayers" type="MeshInstance3D"]
layers = 2000000
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('layers');
        expect(diagnostics[0].message).toContain('1 and 1048575');
      });
    });

    describe('material resource reference validation', () => {
      it('should accept valid material_override format', () => {
        const content = `[gd_scene format=3]

[sub_resource type="StandardMaterial3D" id="mat_1"]

[node name="ValidMaterial" type="MeshInstance3D"]
material_override = SubResource("mat_1")
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject invalid material_override format', () => {
        const content = `[gd_scene format=3]

[node name="InvalidMaterial" type="MeshInstance3D"]
material_override = "invalid_format"
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('material_override');
        expect(diagnostics[0].message).toContain('resource reference');
      });

      it('should accept valid material_overlay format', () => {
        const content = `[gd_scene format=3]

[sub_resource type="StandardMaterial3D" id="mat_overlay"]

[node name="ValidOverlay" type="MeshInstance3D"]
material_overlay = SubResource("mat_overlay")
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject invalid material_overlay format', () => {
        const content = `[gd_scene format=3]

[node name="InvalidOverlay" type="MeshInstance3D"]
material_overlay = invalid
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('material_overlay');
        expect(diagnostics[0].message).toContain('resource reference');
      });
    });

    it('should detect invalid transform format', () => {
      const content = `[gd_scene format=3]

[node name="InvalidTransform" type="MeshInstance3D"]
transform = Transform3D(1, 0, 0)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]).toMatchObject({
        severity: 'error',
        ruleName: 'strict-parser',
      });
      expect(diagnostics[0].message).toContain('transform');
    });
  });

  describe('Semantic Validation (Resource References)', () => {
    it('should detect missing mesh resource', () => {
      const content = `[gd_scene format=3]

[node name="MissingMesh" type="MeshInstance3D"]
mesh = SubResource("nonexistent")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]).toMatchObject({
        severity: 'error',
        nodeName: 'MissingMesh',
        nodeType: 'MeshInstance3D',
        ruleName: 'valid-meshinstance3d-resources',
      });
      expect(diagnostics[0].message).toContain('Mesh resource not found');
    });

    it('should pass when all resources exist', () => {
      const content = `[gd_scene format=3]

[sub_resource type="BoxMesh" id="mesh_1"]

[node name="ValidMesh" type="MeshInstance3D"]
mesh = SubResource("mesh_1")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should detect missing material_override resource', () => {
      const content = `[gd_scene format=3]

[node name="MissingMaterial" type="MeshInstance3D"]
material_override = SubResource("nonexistent_material")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const materialError = diagnostics.find(d => d.message.includes('Material override resource not found'));
      expect(materialError).toBeDefined();
      expect(materialError?.message).toContain('Material override resource not found');
    });

    it('should detect missing material_overlay resource', () => {
      const content = `[gd_scene format=3]

[node name="MissingOverlay" type="MeshInstance3D"]
material_overlay = SubResource("nonexistent_overlay")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const overlayError = diagnostics.find(d => d.message.includes('Material overlay resource not found'));
      expect(overlayError).toBeDefined();
      expect(overlayError?.message).toContain('Material overlay resource not found');
    });

    it('should detect missing skin resource', () => {
      const content = `[gd_scene format=3]

[node name="MissingSkin" type="MeshInstance3D"]
skin = SubResource("nonexistent_skin")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].message).toContain('Skin resource not found');
    });

    it('should detect missing surface material override resource', () => {
      const content = `[gd_scene format=3]

[node name="MissingSurfaceMat" type="MeshInstance3D"]
surface_material_override/0 = SubResource("nonexistent_surface")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const surfaceError = diagnostics.find(d => d.message.includes('Surface material override resource not found'));
      expect(surfaceError).toBeDefined();
      expect(surfaceError?.message).toContain('Surface material override resource not found');
    });
  });

  describe('Semantic Validation (Visibility Range)', () => {
    it('should detect invalid visibility range (begin > end)', () => {
      const content = `[gd_scene format=3]

[node name="InvalidRange" type="MeshInstance3D"]
visibility_range_begin = 100.0
visibility_range_end = 50.0
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const rangeError = diagnostics.find(d => d.ruleName === 'valid-meshinstance3d-visibility-range');
      expect(rangeError).toBeDefined();
      expect(rangeError).toMatchObject({
        severity: 'error',
        ruleName: 'valid-meshinstance3d-visibility-range',
      });
      expect(rangeError?.message).toContain('begin');
      expect(rangeError?.message).toContain('end');
    });

    it('should accept valid visibility range (begin < end)', () => {
      const content = `[gd_scene format=3]

[node name="ValidRange" type="MeshInstance3D"]
visibility_range_begin = 10.0
visibility_range_end = 100.0
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should accept valid visibility range (begin = end)', () => {
      const content = `[gd_scene format=3]

[node name="EqualRange" type="MeshInstance3D"]
visibility_range_begin = 50.0
visibility_range_end = 50.0
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should not validate range when only begin is specified', () => {
      const content = `[gd_scene format=3]

[node name="OnlyBegin" type="MeshInstance3D"]
visibility_range_begin = 100.0
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should not validate range when only end is specified', () => {
      const content = `[gd_scene format=3]

[node name="OnlyEnd" type="MeshInstance3D"]
visibility_range_end = 50.0
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });
  });

  describe('Semantic Validation (Skeleton)', () => {
    it('should detect missing skeleton node', () => {
      const content = `[gd_scene format=3]

[node name="MissingSkeleton" type="MeshInstance3D"]
skeleton = NodePath("NonexistentSkeleton")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]).toMatchObject({
        severity: 'error',
        ruleName: 'valid-meshinstance3d-skeleton',
      });
      expect(diagnostics[0].message).toContain('Skeleton node not found');
    });

    it('should pass when skeleton node exists', () => {
      const content = `[gd_scene format=3]

[node name="MySkeleton" type="Skeleton3D"]

[node name="MyMesh" type="MeshInstance3D"]
skeleton = NodePath("MySkeleton")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should detect skeleton pointing to wrong node type', () => {
      const content = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="NotASkeleton" type="Node3D" parent="."]

[node name="MyMesh" type="MeshInstance3D" parent="."]
skeleton = NodePath("NotASkeleton")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const skeletonError = diagnostics.find(d => d.message.includes('must point to a Skeleton3D node'));
      expect(skeletonError).toBeDefined();
      expect(skeletonError?.message).toContain('must point to a Skeleton3D node');
    });

    it('should accept empty skeleton path', () => {
      const content = `[gd_scene format=3]

[node name="MyMesh" type="MeshInstance3D"]
skeleton = NodePath("")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple validation errors', () => {
      const content = `[gd_scene format=3]

[node name="MultipleErrors" type="MeshInstance3D"]
cast_shadow = 10
gi_mode = 5
mesh = SubResource("nonexistent")
visibility_range_begin = 100.0
visibility_range_end = 50.0
`;

      const diagnostics = linter.lint(content);
      // We expect multiple errors: cast_shadow, gi_mode format errors
      // plus potentially mesh resource not found and visibility range error
      expect(diagnostics.length).toBeGreaterThan(1);
      // Verify at least some of the expected errors are present
      const hasCastShadowError = diagnostics.some(d => d.message.includes('cast_shadow'));
      const hasGiModeError = diagnostics.some(d => d.message.includes('gi_mode'));
      expect(hasCastShadowError || hasGiModeError).toBe(true);
    });

    it('should handle all properties together', () => {
      const content = `[gd_scene format=3]

[sub_resource type="BoxMesh" id="mesh_1"]
[sub_resource type="StandardMaterial3D" id="mat_1"]
[sub_resource type="StandardMaterial3D" id="mat_2"]
[sub_resource type="Skin" id="skin_1"]

[node name="MySkeleton" type="Skeleton3D"]

[node name="ComplexMesh" type="MeshInstance3D"]
mesh = SubResource("mesh_1")
material_override = SubResource("mat_1")
material_overlay = SubResource("mat_2")
surface_material_override/0 = SubResource("mat_1")
skin = SubResource("skin_1")
skeleton = NodePath("MySkeleton")
cast_shadow = 2
gi_mode = 1
gi_lightmap_scale = 2
visibility_range_begin = 10.0
visibility_range_begin_margin = 2.0
visibility_range_end = 100.0
visibility_range_end_margin = 5.0
visibility_range_fade_mode = 1
layers = 1023
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle node with no properties', () => {
      const content = `[gd_scene format=3]

[node name="EmptyMesh" type="MeshInstance3D"]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });
  });
});
