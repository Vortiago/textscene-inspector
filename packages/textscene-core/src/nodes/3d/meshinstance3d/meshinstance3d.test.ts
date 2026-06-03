/**
 * Tests for MeshInstance3D parser
 */

import { describe, it, expect } from 'vitest';
import { parseMeshInstance3D } from './parser';
import { parseHeading } from '../../../parser/utils';

describe('MeshInstance3D Parser', () => {
  describe('parseMeshInstance3D', () => {
    it('should parse basic MeshInstance3D without properties', () => {
      const heading = parseHeading('[node name="MeshInstance" type="MeshInstance3D" parent="."]');
      expect(heading).not.toBeNull();

      const result = parseMeshInstance3D(heading!, {});

      expect(result.name).toBe('MeshInstance');
      expect(result.parent).toBe('.');
      expect(result.mesh).toBeUndefined();
      expect(result.surfaceMaterialOverrides.size).toBe(0);
    });

    it('should parse MeshInstance3D with mesh reference', () => {
      const heading = parseHeading('[node name="MeshInstance" type="MeshInstance3D" parent="."]');
      expect(heading).not.toBeNull();

      const properties = {
        mesh: 'SubResource("BoxMesh_1")',
      };

      const result = parseMeshInstance3D(heading!, properties);

      expect(result.name).toBe('MeshInstance');
      expect(result.mesh).toBe('SubResource("BoxMesh_1")');
    });

    it('should parse indexed surface_material_override properties', () => {
      const heading = parseHeading('[node name="MeshInstance" type="MeshInstance3D" parent="."]');
      expect(heading).not.toBeNull();

      const properties = {
        'surface_material_override/0': 'SubResource("StandardMaterial3D_1")',
        'surface_material_override/1': 'SubResource("StandardMaterial3D_2")',
        'surface_material_override/5': 'SubResource("StandardMaterial3D_3")',
      };

      const result = parseMeshInstance3D(heading!, properties);

      expect(result.surfaceMaterialOverrides.size).toBe(3);
      expect(result.surfaceMaterialOverrides.get(0)).toBe('SubResource("StandardMaterial3D_1")');
      expect(result.surfaceMaterialOverrides.get(1)).toBe('SubResource("StandardMaterial3D_2")');
      expect(result.surfaceMaterialOverrides.get(5)).toBe('SubResource("StandardMaterial3D_3")');
    });

    it('should parse cast_shadow property', () => {
      const heading = parseHeading('[node name="MeshInstance" type="MeshInstance3D" parent="."]');
      expect(heading).not.toBeNull();

      const properties = {
        cast_shadow: '1',
      };

      const result = parseMeshInstance3D(heading!, properties);

      expect(result.castShadow).toBe(1);
    });

    it('should parse skeleton and skin properties', () => {
      const heading = parseHeading('[node name="MeshInstance" type="MeshInstance3D" parent="."]');
      expect(heading).not.toBeNull();

      const properties = {
        skeleton: 'NodePath("../Armature")',
        skin: 'SubResource("Skin_1")',
      };

      const result = parseMeshInstance3D(heading!, properties);

      expect(result.skeleton).toBe('NodePath("../Armature")');
      expect(result.skin).toBe('SubResource("Skin_1")');
    });

    it('should inherit transform from Node3D', () => {
      const heading = parseHeading('[node name="MeshInstance" type="MeshInstance3D" parent="."]');
      expect(heading).not.toBeNull();

      const properties = {
        transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 2, 3, 4)',
        mesh: 'SubResource("BoxMesh_1")',
      };

      const result = parseMeshInstance3D(heading!, properties);

      expect(result.transform).toBeDefined();
      expect(result.transform?.origin.x).toBe(2);
      expect(result.transform?.origin.y).toBe(3);
      expect(result.transform?.origin.z).toBe(4);
      expect(result.mesh).toBe('SubResource("BoxMesh_1")');
    });

    it('should parse complete MeshInstance3D from TSCN fixture format', () => {
      const heading = parseHeading('[node name="MeshInstance" type="MeshInstance3D" parent="."]');
      expect(heading).not.toBeNull();

      const properties = {
        transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)',
        mesh: 'SubResource("BoxMesh_1")',
        'surface_material_override/0': 'SubResource("StandardMaterial3D_1")',
      };

      const result = parseMeshInstance3D(heading!, properties);

      expect(result.name).toBe('MeshInstance');
      expect(result.parent).toBe('.');
      expect(result.transform).toBeDefined();
      expect(result.mesh).toBe('SubResource("BoxMesh_1")');
      expect(result.surfaceMaterialOverrides.size).toBe(1);
      expect(result.surfaceMaterialOverrides.get(0)).toBe('SubResource("StandardMaterial3D_1")');
    });

    it('should handle ExtResource mesh references', () => {
      const heading = parseHeading('[node name="MeshInstance" type="MeshInstance3D" parent="."]');
      expect(heading).not.toBeNull();

      const properties = {
        mesh: 'ExtResource("1_abc")',
      };

      const result = parseMeshInstance3D(heading!, properties);

      expect(result.mesh).toBe('ExtResource("1_abc")');
    });

    it('should handle all cast_shadow enum values', () => {
      const heading = parseHeading('[node name="MeshInstance" type="MeshInstance3D" parent="."]');
      expect(heading).not.toBeNull();

      const testCases = [
        { value: '0', expected: 0 }, // OFF
        { value: '1', expected: 1 }, // ON
        { value: '2', expected: 2 }, // DOUBLE_SIDED
        { value: '3', expected: 3 }, // SHADOWS_ONLY
      ];

      for (const testCase of testCases) {
        const result = parseMeshInstance3D(heading!, { cast_shadow: testCase.value });
        expect(result.castShadow).toBe(testCase.expected);
      }
    });
  });
});
