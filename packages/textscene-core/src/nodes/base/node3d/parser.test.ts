/**
 * Tests for Node3D parser
 */

import { describe, it, expect } from 'vitest';
import { parseNode3D, isNode3D } from './parser';
import type { ParsedHeading } from '../../../parser/utils';
import { parseHeading } from '../../../parser/utils';

describe('Node3D Parser', () => {
  describe('isNode3D', () => {
    it('should identify Node3D nodes', () => {
      const heading: ParsedHeading = {
        type: 'node',
        attributes: {
          name: 'MyNode',
          type: 'Node3D',
        },
      };

      expect(isNode3D(heading)).toBe(true);
    });

    it('should reject MeshInstance3D nodes', () => {
      const heading: ParsedHeading = {
        type: 'node',
        attributes: {
          name: 'MyMesh',
          type: 'MeshInstance3D',
        },
      };

      expect(isNode3D(heading)).toBe(false);
    });

    it('should reject Camera3D nodes', () => {
      const heading: ParsedHeading = {
        type: 'node',
        attributes: {
          name: 'MyCamera',
          type: 'Camera3D',
        },
      };

      expect(isNode3D(heading)).toBe(false);
    });

    it('should reject non-node headings', () => {
      const heading: ParsedHeading = {
        type: 'ext_resource',
        attributes: {},
      };

      expect(isNode3D(heading)).toBe(false);
    });
  });

  describe('parseNode3D', () => {
    it('should parse basic Node3D with name and parent', () => {
      const heading = parseHeading('[node name="MyNode" type="Node3D" parent="."]');
      expect(heading).not.toBeNull();

      const result = parseNode3D(heading!, {});

      expect(result.name).toBe('MyNode');
      expect(result.parent).toBe('.');
      expect(result.transform).toBeUndefined();
      expect(result.instance).toBeUndefined();
    });

    it('should parse Node3D with named parent', () => {
      const heading = parseHeading('[node name="Child" type="Node3D" parent="Root"]');
      expect(heading).not.toBeNull();

      const result = parseNode3D(heading!, {});

      expect(result.name).toBe('Child');
      expect(result.parent).toBe('Root');
    });

    it('should handle missing name attribute', () => {
      const heading: ParsedHeading = {
        type: 'node',
        attributes: {
          type: 'Node3D',
          parent: '.',
        },
      };

      const result = parseNode3D(heading, {});

      expect(result.name).toBe('');
      expect(result.parent).toBe('.');
    });

    it('should handle missing parent attribute', () => {
      const heading = parseHeading('[node name="Root" type="Node3D"]');
      expect(heading).not.toBeNull();

      const result = parseNode3D(heading!, {});

      expect(result.name).toBe('Root');
      expect(result.parent).toBeUndefined();
    });

    it('should parse transform property', () => {
      const heading = parseHeading('[node name="Node" type="Node3D" parent="."]');
      expect(heading).not.toBeNull();

      const properties = {
        transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 5, 10, 15)',
      };

      const result = parseNode3D(heading!, properties);

      expect(result.transform).toBeDefined();
      expect(result.transform?.origin.x).toBe(5);
      expect(result.transform?.origin.y).toBe(10);
      expect(result.transform?.origin.z).toBe(15);
    });

    it('should parse identity transform', () => {
      const heading = parseHeading('[node name="Node" type="Node3D" parent="."]');
      expect(heading).not.toBeNull();

      const properties = {
        transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)',
      };

      const result = parseNode3D(heading!, properties);

      expect(result.transform).toBeDefined();
      expect(result.transform?.origin.x).toBe(0);
      expect(result.transform?.origin.y).toBe(0);
      expect(result.transform?.origin.z).toBe(0);
      expect(result.transform?.basis_x.x).toBe(1);
      expect(result.transform?.basis_y.y).toBe(1);
      expect(result.transform?.basis_z.z).toBe(1);
    });

    it('should parse instance attribute', () => {
      const heading = parseHeading('[node name="Enemy1" type="Node3D" instance=ExtResource("1_enemy")]');
      expect(heading).not.toBeNull();

      const result = parseNode3D(heading!, {});

      expect(result.name).toBe('Enemy1');
      expect(result.instance).toBe('ExtResource("1_enemy")');
    });

    it('should handle both transform and instance', () => {
      const heading = parseHeading('[node name="SpawnPoint" type="Node3D" parent="." instance=ExtResource("2_scene")]');
      expect(heading).not.toBeNull();

      const properties = {
        transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 10, 0, 0)',
      };

      const result = parseNode3D(heading!, properties);

      expect(result.name).toBe('SpawnPoint');
      expect(result.instance).toBe('ExtResource("2_scene")');
      expect(result.transform).toBeDefined();
      expect(result.transform?.origin.x).toBe(10);
    });

    it('should return identity transform for malformed transform', () => {
      const heading = parseHeading('[node name="Node" type="Node3D" parent="."]');
      expect(heading).not.toBeNull();

      const properties = {
        transform: 'invalid transform string',
      };

      const result = parseNode3D(heading!, properties);

      // parseOptionalTransform returns identity transform on parse failure
      expect(result.transform).toBeDefined();
      expect(result.transform?.origin.x).toBe(0);
      expect(result.transform?.origin.y).toBe(0);
      expect(result.transform?.origin.z).toBe(0);
      expect(result.transform?.basis_x.x).toBe(1);
      expect(result.transform?.basis_y.y).toBe(1);
      expect(result.transform?.basis_z.z).toBe(1);
    });

    it('should handle empty properties', () => {
      const heading = parseHeading('[node name="EmptyNode" type="Node3D" parent="."]');
      expect(heading).not.toBeNull();

      const result = parseNode3D(heading!, {});

      expect(result.name).toBe('EmptyNode');
      expect(result.parent).toBe('.');
      expect(result.transform).toBeUndefined();
      expect(result.instance).toBeUndefined();
    });

    it('should handle properties without transform key', () => {
      const heading = parseHeading('[node name="Node" type="Node3D" parent="."]');
      expect(heading).not.toBeNull();

      const properties = {
        other_property: 'value',
      };

      const result = parseNode3D(heading!, properties);

      expect(result.transform).toBeUndefined();
    });

    it('should parse node with complex parent path', () => {
      const heading = parseHeading('[node name="Leaf" type="Node3D" parent="Root/Branch/Twig"]');
      expect(heading).not.toBeNull();

      const result = parseNode3D(heading!, {});

      expect(result.name).toBe('Leaf');
      expect(result.parent).toBe('Root/Branch/Twig');
    });

    it('should return all properties for root node', () => {
      const heading = parseHeading('[node name="Root" type="Node3D"]');
      expect(heading).not.toBeNull();

      const properties = {
        transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)',
      };

      const result = parseNode3D(heading!, properties);

      expect(result.name).toBe('Root');
      expect(result.parent).toBeUndefined();
      expect(result.transform).toBeDefined();
      expect(result.instance).toBeUndefined();
    });

    it('should parse node with scaled transform', () => {
      const heading = parseHeading('[node name="Scaled" type="Node3D" parent="."]');
      expect(heading).not.toBeNull();

      const properties = {
        transform: 'Transform3D(2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0)',
      };

      const result = parseNode3D(heading!, properties);

      expect(result.transform).toBeDefined();
      expect(result.transform?.basis_x.x).toBe(2);
      expect(result.transform?.basis_y.y).toBe(2);
      expect(result.transform?.basis_z.z).toBe(2);
    });

    it('should parse node with rotated transform', () => {
      const heading = parseHeading('[node name="Rotated" type="Node3D" parent="."]');
      expect(heading).not.toBeNull();

      const properties = {
        // 90 degree rotation around Y axis
        transform: 'Transform3D(0, 0, 1, 0, 1, 0, -1, 0, 0, 0, 0, 0)',
      };

      const result = parseNode3D(heading!, properties);

      expect(result.transform).toBeDefined();
      expect(result.transform?.basis_x.x).toBe(0);
      expect(result.transform?.basis_x.z).toBe(1);
      expect(result.transform?.basis_z.x).toBe(-1);
    });
  });
});
