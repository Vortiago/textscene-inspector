/** MeshInstance3D parser tests. */

import { describe, it, expect } from 'vitest';
import { parseMeshInstance3D } from './parser';
import { heading } from '../../../parser/testing/parserKit';

describe('MeshInstance3D Parser', () => {
  describe('parseMeshInstance3D', () => {
    it('should parse basic MeshInstance3D with defaults', () => {
      const h = heading('MeshInstance3D', { name: 'Cube', parent: '.' });

      const result = parseMeshInstance3D(h, {});

      expect(result.name).toBe('Cube');
      expect(result.parent).toBe('.');
      expect(result.mesh).toBeUndefined();
      expect(result.surfaceMaterialOverrides.size).toBe(0);
    });

    it('should parse mesh property', () => {
      const h = heading('MeshInstance3D', { name: 'Cube', parent: '.' });

      const properties = {
        mesh: 'SubResource("BoxMesh_abc123")',
      };

      const result = parseMeshInstance3D(h, properties);

      expect(result.mesh).toBe('SubResource("BoxMesh_abc123")');
    });

    it('should parse material_override property', () => {
      const h = heading('MeshInstance3D', { name: 'Cube', parent: '.' });

      const properties = {
        material_override: 'SubResource("StandardMaterial3D_xyz")',
      };

      const result = parseMeshInstance3D(h, properties);

      expect(result.materialOverride).toBe('SubResource("StandardMaterial3D_xyz")');
    });

    it('should parse material_overlay property', () => {
      const h = heading('MeshInstance3D', { name: 'Cube', parent: '.' });

      const properties = {
        material_overlay: 'ExtResource("1_abc")',
      };

      const result = parseMeshInstance3D(h, properties);

      expect(result.materialOverlay).toBe('ExtResource("1_abc")');
    });

    it('should parse single surface material override', () => {
      const h = heading('MeshInstance3D', { name: 'Cube', parent: '.' });

      const properties = {
        'surface_material_override/0': 'SubResource("Material_0")',
      };

      const result = parseMeshInstance3D(h, properties);

      expect(result.surfaceMaterialOverrides.size).toBe(1);
      expect(result.surfaceMaterialOverrides.get(0)).toBe('SubResource("Material_0")');
    });

    it('should parse multiple surface material overrides', () => {
      const h = heading('MeshInstance3D', { name: 'Cube', parent: '.' });

      const properties = {
        'surface_material_override/0': 'SubResource("Material_0"))',
        'surface_material_override/1': 'SubResource("Material_1")',
        'surface_material_override/2': 'SubResource("Material_2")',
      };

      const result = parseMeshInstance3D(h, properties);

      expect(result.surfaceMaterialOverrides.size).toBe(3);
      expect(result.surfaceMaterialOverrides.get(0)).toBe('SubResource("Material_0"))');
      expect(result.surfaceMaterialOverrides.get(1)).toBe('SubResource("Material_1")');
      expect(result.surfaceMaterialOverrides.get(2)).toBe('SubResource("Material_2")');
    });

    // `_set` reads the index from `get_slicec('/', 1)` (mesh_instance_3d.cpp:66), which
    // returns that slice alone (ustring.cpp:941-964), so
    // `surface_material_override/0/extra` names surface 0.
    it('parses an override key carrying a trailing segment', () => {
      const h = heading('MeshInstance3D', { name: 'Cube', parent: '.' });

      const result = parseMeshInstance3D(h, {
        'surface_material_override/0/extra': 'SubResource("Material_0")',
      });

      expect(result.surfaceMaterialOverrides.get(0)).toBe('SubResource("Material_0")');
    });

    it('should parse cast_shadow property', () => {
      const h = heading('MeshInstance3D', { name: 'Cube', parent: '.' });

      const properties = {
        cast_shadow: '1', // SHADOWS_ON
      };

      const result = parseMeshInstance3D(h, properties);

      expect(result.castShadow).toBe(1);
    });

    it('should parse gi_mode property', () => {
      const h = heading('MeshInstance3D', { name: 'Cube', parent: '.' });

      const properties = {
        gi_mode: '1', // STATIC
      };

      const result = parseMeshInstance3D(h, properties);

      expect(result.giMode).toBe(1);
    });

    it('should parse gi_lightmap_scale property', () => {
      const h = heading('MeshInstance3D', { name: 'Cube', parent: '.' });

      const properties = {
        gi_lightmap_scale: '2', // 4x scale
      };

      const result = parseMeshInstance3D(h, properties);

      expect(result.giLightmapScale).toBe(2);
    });

    it('should parse visibility range properties', () => {
      const h = heading('MeshInstance3D', { name: 'Cube', parent: '.' });

      const properties = {
        visibility_range_begin: '10.0',
        visibility_range_begin_margin: '1.0',
        visibility_range_end: '100.0',
        visibility_range_end_margin: '5.0',
        visibility_range_fade_mode: '1',
      };

      const result = parseMeshInstance3D(h, properties);

      expect(result.visibilityRangeBegin).toBe(10.0);
      expect(result.visibilityRangeBeginMargin).toBe(1.0);
      expect(result.visibilityRangeEnd).toBe(100.0);
      expect(result.visibilityRangeEndMargin).toBe(5.0);
      expect(result.visibilityRangeFadeMode).toBe(1);
    });

    it('should parse layers property', () => {
      const h = heading('MeshInstance3D', { name: 'Cube', parent: '.' });

      const properties = {
        layers: '3', // Binary 11 = layers 1 and 2
      };

      const result = parseMeshInstance3D(h, properties);

      expect(result.layers).toBe(3);
    });

    it('should parse skeleton property', () => {
      const h = heading('MeshInstance3D', { name: 'Character', parent: '.' });

      const properties = {
        skeleton: 'NodePath("../Skeleton3D")',
      };

      const result = parseMeshInstance3D(h, properties);

      expect(result.skeleton).toBe('NodePath("../Skeleton3D")');
    });

    it('should parse skin property', () => {
      const h = heading('MeshInstance3D', { name: 'Character', parent: '.' });

      const properties = {
        skin: 'ExtResource("1_skin")',
      };

      const result = parseMeshInstance3D(h, properties);

      expect(result.skin).toBe('ExtResource("1_skin")');
    });

    it('should parse MeshInstance3D with all properties', () => {
      const h = heading('MeshInstance3D', { name: 'ComplexMesh', parent: 'Root' });

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

      const result = parseMeshInstance3D(h, properties);

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
      const h = heading('MeshInstance3D', { name: 'Cube', parent: '.' });

      const properties = {
        transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 5, 10, 15)',
      };

      const result = parseMeshInstance3D(h, properties);

      expect(result.transform).toBeDefined();
      expect(result.transform?.origin.x).toBe(5);
      expect(result.transform?.origin.y).toBe(10);
      expect(result.transform?.origin.z).toBe(15);
      expect(result.name).toBe('Cube');
      expect(result.parent).toBe('.');
    });

    it('should be undefined for invalid cast_shadow', () => {
      const h = heading('MeshInstance3D', { name: 'Cube', parent: '.' });
      const result = parseMeshInstance3D(h, { cast_shadow: 'invalid' });
      expect(result.castShadow).toBeUndefined();
    });

    it('should be undefined for invalid gi_mode', () => {
      const h = heading('MeshInstance3D', { name: 'Cube', parent: '.' });
      const result = parseMeshInstance3D(h, { gi_mode: 'invalid' });
      expect(result.giMode).toBeUndefined();
    });

    it('should be undefined for invalid visibility range values', () => {
      const h = heading('MeshInstance3D', { name: 'Cube', parent: '.' });
      const result = parseMeshInstance3D(h, {
        visibility_range_begin: 'invalid',
        visibility_range_end: 'bad',
      });
      expect(result.visibilityRangeBegin).toBeUndefined();
      expect(result.visibilityRangeEnd).toBeUndefined();
    });

    it('should handle empty surface material override map', () => {
      const h = heading('MeshInstance3D', { name: 'Cube', parent: '.' });

      const result = parseMeshInstance3D(h, { mesh: 'SubResource("1")' });

      expect(result.surfaceMaterialOverrides).toBeInstanceOf(Map);
      expect(result.surfaceMaterialOverrides.size).toBe(0);
    });

    it('should handle sparse surface material override indices', () => {
      const h = heading('MeshInstance3D', { name: 'Cube', parent: '.' });

      const properties = {
        'surface_material_override/0': 'SubResource("Material_0")',
        'surface_material_override/5': 'SubResource("Material_5")',
        'surface_material_override/10': 'SubResource("Material_10")',
      };

      const result = parseMeshInstance3D(h, properties);

      expect(result.surfaceMaterialOverrides.size).toBe(3);
      expect(result.surfaceMaterialOverrides.get(0)).toBe('SubResource("Material_0")');
      expect(result.surfaceMaterialOverrides.get(5)).toBe('SubResource("Material_5")');
      expect(result.surfaceMaterialOverrides.get(10)).toBe('SubResource("Material_10")');
      expect(result.surfaceMaterialOverrides.has(1)).toBe(false);
      expect(result.surfaceMaterialOverrides.has(2)).toBe(false);
    });

    // `_set` reads the index with a bare `get_slicec('/', 1).to_int()`
    // (mesh_instance_3d.cpp:66). `to_int` skips a character it cannot use
    // (ustring.cpp:2280-2293), so `+2` names surface 2 and `abc` surface 0. `:68`
    // returns false for a negative index.
    it('resolves a surface index the way to_int does', () => {
      const h = heading('MeshInstance3D', { name: 'Cube', parent: '.' });

      const result = parseMeshInstance3D(h, {
        'surface_material_override/+2': 'SubResource("Material_2")',
        'surface_material_override/abc': 'SubResource("Material_0")',
        'surface_material_override/-1': 'SubResource("Material_neg")',
      });

      expect(result.surfaceMaterialOverrides.size).toBe(2);
      expect(result.surfaceMaterialOverrides.get(2)).toBe('SubResource("Material_2")');
      expect(result.surfaceMaterialOverrides.get(0)).toBe('SubResource("Material_0")');
      expect(result.surfaceMaterialOverrides.has(-1)).toBe(false);
    });

    it('should ignore properties with invalid surface_material_override format', () => {
      const h = heading('MeshInstance3D', { name: 'Cube', parent: '.' });

      const properties = {
        // `begins_with("surface_material_override/")` (mesh_instance_3d.cpp:65)
        // never sees this one.
        'surface_material_override': 'SubResource("Material_invalid")',
        // An empty index segment: the shared grammar requires a non-empty one,
        // so this reaches no reader here (`godot/indexedKey.ts`).
        'surface_material_override/': 'SubResource("Material_empty")',
      };

      const result = parseMeshInstance3D(h, properties);

      expect(result.surfaceMaterialOverrides.size).toBe(0);
    });
  });
});
