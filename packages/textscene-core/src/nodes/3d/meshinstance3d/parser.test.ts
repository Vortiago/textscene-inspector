/**
 * Tests for MeshInstance3D parser
 */

import { describe, it, expect } from 'vitest';
import { parseMeshInstance3D } from './parser';
import { parseHeading } from '../../../parser/utils';

describe('MeshInstance3D Parser', () => {
  describe('parseMeshInstance3D', () => {
    it('should parse basic MeshInstance3D with defaults', () => {
      const heading = parseHeading('[node name="Cube" type="MeshInstance3D" parent="."]');
      expect(heading).not.toBeNull();

      const result = parseMeshInstance3D(heading!, {});

      expect(result.name).toBe('Cube');
      expect(result.parent).toBe('.');
      expect(result.mesh).toBeUndefined();
      expect(result.surfaceMaterialOverrides.size).toBe(0);
    });

    it('should parse mesh property', () => {
      const heading = parseHeading('[node name="Cube" type="MeshInstance3D" parent="."]');
      expect(heading).not.toBeNull();

      const properties = {
        mesh: 'SubResource("BoxMesh_abc123")',
      };

      const result = parseMeshInstance3D(heading!, properties);

      expect(result.mesh).toBe('SubResource("BoxMesh_abc123")');
    });

    it('should parse material_override property', () => {
      const heading = parseHeading('[node name="Cube" type="MeshInstance3D" parent="."]');
      expect(heading).not.toBeNull();

      const properties = {
        material_override: 'SubResource("StandardMaterial3D_xyz")',
      };

      const result = parseMeshInstance3D(heading!, properties);

      expect(result.materialOverride).toBe('SubResource("StandardMaterial3D_xyz")');
    });

    it('should parse material_overlay property', () => {
      const heading = parseHeading('[node name="Cube" type="MeshInstance3D" parent="."]');
      expect(heading).not.toBeNull();

      const properties = {
        material_overlay: 'ExtResource("1_abc")',
      };

      const result = parseMeshInstance3D(heading!, properties);

      expect(result.materialOverlay).toBe('ExtResource("1_abc")');
    });

    it('should parse single surface material override', () => {
      const heading = parseHeading('[node name="Cube" type="MeshInstance3D" parent="."]');
      expect(heading).not.toBeNull();

      const properties = {
        'surface_material_override/0': 'SubResource("Material_0")',
      };

      const result = parseMeshInstance3D(heading!, properties);

      expect(result.surfaceMaterialOverrides.size).toBe(1);
      expect(result.surfaceMaterialOverrides.get(0)).toBe('SubResource("Material_0")');
    });

    it('should parse multiple surface material overrides', () => {
      const heading = parseHeading('[node name="Cube" type="MeshInstance3D" parent="."]');
      expect(heading).not.toBeNull();

      const properties = {
        'surface_material_override/0': 'SubResource("Material_0"))',
        'surface_material_override/1': 'SubResource("Material_1")',
        'surface_material_override/2': 'SubResource("Material_2")',
      };

      const result = parseMeshInstance3D(heading!, properties);

      expect(result.surfaceMaterialOverrides.size).toBe(3);
      expect(result.surfaceMaterialOverrides.get(0)).toBe('SubResource("Material_0"))');
      expect(result.surfaceMaterialOverrides.get(1)).toBe('SubResource("Material_1")');
      expect(result.surfaceMaterialOverrides.get(2)).toBe('SubResource("Material_2")');
    });

    it('should parse cast_shadow property', () => {
      const heading = parseHeading('[node name="Cube" type="MeshInstance3D" parent="."]');
      expect(heading).not.toBeNull();

      const properties = {
        cast_shadow: '1', // SHADOWS_ON
      };

      const result = parseMeshInstance3D(heading!, properties);

      expect(result.castShadow).toBe(1);
    });

    it('should parse gi_mode property', () => {
      const heading = parseHeading('[node name="Cube" type="MeshInstance3D" parent="."]');
      expect(heading).not.toBeNull();

      const properties = {
        gi_mode: '1', // STATIC
      };

      const result = parseMeshInstance3D(heading!, properties);

      expect(result.giMode).toBe(1);
    });

    it('should parse gi_lightmap_scale property', () => {
      const heading = parseHeading('[node name="Cube" type="MeshInstance3D" parent="."]');
      expect(heading).not.toBeNull();

      const properties = {
        gi_lightmap_scale: '2', // 4x scale
      };

      const result = parseMeshInstance3D(heading!, properties);

      expect(result.giLightmapScale).toBe(2);
    });

    it('should parse visibility range properties', () => {
      const heading = parseHeading('[node name="Cube" type="MeshInstance3D" parent="."]');
      expect(heading).not.toBeNull();

      const properties = {
        visibility_range_begin: '10.0',
        visibility_range_begin_margin: '1.0',
        visibility_range_end: '100.0',
        visibility_range_end_margin: '5.0',
        visibility_range_fade_mode: '1',
      };

      const result = parseMeshInstance3D(heading!, properties);

      expect(result.visibilityRangeBegin).toBe(10.0);
      expect(result.visibilityRangeBeginMargin).toBe(1.0);
      expect(result.visibilityRangeEnd).toBe(100.0);
      expect(result.visibilityRangeEndMargin).toBe(5.0);
      expect(result.visibilityRangeFadeMode).toBe(1);
    });

    it('should parse layers property', () => {
      const heading = parseHeading('[node name="Cube" type="MeshInstance3D" parent="."]');
      expect(heading).not.toBeNull();

      const properties = {
        layers: '3', // Binary 11 = layers 1 and 2
      };

      const result = parseMeshInstance3D(heading!, properties);

      expect(result.layers).toBe(3);
    });

    it('should parse skeleton property', () => {
      const heading = parseHeading('[node name="Character" type="MeshInstance3D" parent="."]');
      expect(heading).not.toBeNull();

      const properties = {
        skeleton: 'NodePath("../Skeleton3D")',
      };

      const result = parseMeshInstance3D(heading!, properties);

      expect(result.skeleton).toBe('NodePath("../Skeleton3D")');
    });

    it('should parse skin property', () => {
      const heading = parseHeading('[node name="Character" type="MeshInstance3D" parent="."]');
      expect(heading).not.toBeNull();

      const properties = {
        skin: 'ExtResource("1_skin")',
      };

      const result = parseMeshInstance3D(heading!, properties);

      expect(result.skin).toBe('ExtResource("1_skin")');
    });

    it('should parse MeshInstance3D with all properties', () => {
      const heading = parseHeading('[node name="ComplexMesh" type="MeshInstance3D" parent="Root"]');
      expect(heading).not.toBeNull();

      const properties = {
        mesh: 'SubResource("BoxMesh_1")',
        material_override: 'SubResource("Material_base")',
        material_overlay: 'SubResource("Material_overlay")',
        'surface_material_override/0': 'SubResource("Material_surface0")',
        'surface_material_override/1': 'SubResource("Material_surface1")',
        cast_shadow: '1',
        gi_mode: '1',
        gi_lightmap_scale: '1',
        visibility_range_begin: '5.0',
        visibility_range_begin_margin: '0.5',
        visibility_range_end: '50.0',
        visibility_range_end_margin: '2.0',
        visibility_range_fade_mode: '1',
        layers: '7',
        skeleton: 'NodePath("../Armature/Skeleton3D")',
        skin: 'ExtResource("2_skin")',
        transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)',
      };

      const result = parseMeshInstance3D(heading!, properties);

      expect(result.name).toBe('ComplexMesh');
      expect(result.parent).toBe('Root');
      expect(result.mesh).toBe('SubResource("BoxMesh_1")');
      expect(result.materialOverride).toBe('SubResource("Material_base")');
      expect(result.materialOverlay).toBe('SubResource("Material_overlay")');
      expect(result.surfaceMaterialOverrides.size).toBe(2);
      expect(result.castShadow).toBe(1);
      expect(result.giMode).toBe(1);
      expect(result.giLightmapScale).toBe(1);
      expect(result.visibilityRangeBegin).toBe(5.0);
      expect(result.visibilityRangeEnd).toBe(50.0);
      expect(result.layers).toBe(7);
      expect(result.skeleton).toBeDefined();
      expect(result.skin).toBeDefined();
      expect(result.transform).toBeDefined();
    });

    it('should inherit Node3D properties', () => {
      const heading = parseHeading('[node name="Cube" type="MeshInstance3D" parent="."]');
      expect(heading).not.toBeNull();

      const properties = {
        transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 5, 10, 15)',
      };

      const result = parseMeshInstance3D(heading!, properties);

      expect(result.transform).toBeDefined();
      expect(result.transform?.origin.x).toBe(5);
      expect(result.transform?.origin.y).toBe(10);
      expect(result.transform?.origin.z).toBe(15);
      expect(result.name).toBe('Cube');
      expect(result.parent).toBe('.');
    });

    it('should return NaN for invalid cast_shadow', () => {
      const heading = parseHeading('[node name="Cube" type="MeshInstance3D" parent="."]');
      expect(heading).not.toBeNull();

      const result = parseMeshInstance3D(heading!, { cast_shadow: 'invalid' });

      expect(result.castShadow).toBeNaN();
    });

    it('should return NaN for invalid gi_mode', () => {
      const heading = parseHeading('[node name="Cube" type="MeshInstance3D" parent="."]');
      expect(heading).not.toBeNull();

      const result = parseMeshInstance3D(heading!, { gi_mode: 'invalid' });

      expect(result.giMode).toBeNaN();
    });

    it('should return NaN for invalid visibility range values', () => {
      const heading = parseHeading('[node name="Cube" type="MeshInstance3D" parent="."]');
      expect(heading).not.toBeNull();

      const result = parseMeshInstance3D(heading!, {
        visibility_range_begin: 'invalid',
        visibility_range_end: 'bad',
      });

      expect(result.visibilityRangeBegin).toBeNaN();
      expect(result.visibilityRangeEnd).toBeNaN();
    });

    it('should handle empty surface material override map', () => {
      const heading = parseHeading('[node name="Cube" type="MeshInstance3D" parent="."]');
      expect(heading).not.toBeNull();

      const result = parseMeshInstance3D(heading!, { mesh: 'SubResource("1")' });

      expect(result.surfaceMaterialOverrides).toBeInstanceOf(Map);
      expect(result.surfaceMaterialOverrides.size).toBe(0);
    });

    it('should handle sparse surface material override indices', () => {
      const heading = parseHeading('[node name="Cube" type="MeshInstance3D" parent="."]');
      expect(heading).not.toBeNull();

      const properties = {
        'surface_material_override/0': 'SubResource("Material_0")',
        'surface_material_override/5': 'SubResource("Material_5")',
        'surface_material_override/10': 'SubResource("Material_10")',
      };

      const result = parseMeshInstance3D(heading!, properties);

      expect(result.surfaceMaterialOverrides.size).toBe(3);
      expect(result.surfaceMaterialOverrides.get(0)).toBe('SubResource("Material_0")');
      expect(result.surfaceMaterialOverrides.get(5)).toBe('SubResource("Material_5")');
      expect(result.surfaceMaterialOverrides.get(10)).toBe('SubResource("Material_10")');
      expect(result.surfaceMaterialOverrides.has(1)).toBe(false);
      expect(result.surfaceMaterialOverrides.has(2)).toBe(false);
    });

    it('should ignore properties with invalid surface_material_override format', () => {
      const heading = parseHeading('[node name="Cube" type="MeshInstance3D" parent="."]');
      expect(heading).not.toBeNull();

      const properties = {
        'surface_material_override': 'SubResource("Material_invalid")', // Missing index
        'surface_material_override/': 'SubResource("Material_empty")', // Empty index
        'surface_material_override/abc': 'SubResource("Material_text")', // Non-numeric index
      };

      const result = parseMeshInstance3D(heading!, properties);

      expect(result.surfaceMaterialOverrides.size).toBe(0);
    });
  });
});
