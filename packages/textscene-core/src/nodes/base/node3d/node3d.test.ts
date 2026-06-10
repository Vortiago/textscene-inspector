/**
 * Tests for Node3D parser - Vertical slice testing
 */

import { describe, it, expect } from 'vitest';
import { parseNode3D } from './parser';
import { parseHeading } from '../../../parser/utils';
import { parseTransform3D, decomposeTransform3D, identityTransform3D } from '../../../utils/transform';

describe('Node3D Parser', () => {
  describe('parseNode3D', () => {
    it('should parse basic Node3D without transform', () => {
      const heading = parseHeading('[node name="Root" type="Node3D"]');
      expect(heading).not.toBeNull();

      const result = parseNode3D(heading!, {});

      expect(result.name).toBe('Root');
      expect(result.parent).toBeUndefined();
      expect(result.transform).toBeUndefined();
    });

    it('should parse Node3D with parent', () => {
      const heading = parseHeading('[node name="Child" type="Node3D" parent="."]');
      expect(heading).not.toBeNull();

      const result = parseNode3D(heading!, {});

      expect(result.name).toBe('Child');
      expect(result.parent).toBe('.');
    });

    it('should parse Node3D with transform', () => {
      const heading = parseHeading('[node name="Child" type="Node3D" parent="."]');
      expect(heading).not.toBeNull();

      const properties = {
        transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 2, 0, 0)',
      };

      const result = parseNode3D(heading!, properties);

      expect(result.transform).toBeDefined();
      expect(result.transform?.origin.x).toBe(2);
      expect(result.transform?.origin.y).toBe(0);
      expect(result.transform?.origin.z).toBe(0);
    });

    it('should handle invalid transform gracefully', () => {
      const heading = parseHeading('[node name="Child" type="Node3D"]');
      expect(heading).not.toBeNull();

      const properties = {
        transform: 'InvalidTransform',
      };

      const result = parseNode3D(heading!, properties);

      // Should use identity transform as fallback
      expect(result.transform).toBeDefined();
      expect(result.transform?.origin.x).toBe(0);
    });

    it('should parse Node3D with instance reference', () => {
      const heading = parseHeading('[node name="Hallway" type="Node3D" instance=ExtResource("1_abc")]');
      expect(heading).not.toBeNull();

      const result = parseNode3D(heading!, {});

      expect(result.name).toBe('Hallway');
      expect(result.instance).toBe('ExtResource("1_abc")');
    });
  });
});

describe('Transform3D utilities', () => {
  describe('parseTransform3D', () => {
    it('should parse identity transform', () => {
      const transform = parseTransform3D('Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)');

      expect(transform.basis_x).toEqual({ x: 1, y: 0, z: 0 });
      expect(transform.basis_y).toEqual({ x: 0, y: 1, z: 0 });
      expect(transform.basis_z).toEqual({ x: 0, y: 0, z: 1 });
      expect(transform.origin).toEqual({ x: 0, y: 0, z: 0 });
    });

    it('should parse transform with translation', () => {
      const transform = parseTransform3D('Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 2, 3, 4)');

      expect(transform.origin).toEqual({ x: 2, y: 3, z: 4 });
    });

    it('should parse transform with scale', () => {
      const transform = parseTransform3D('Transform3D(2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0)');

      expect(transform.basis_x).toEqual({ x: 2, y: 0, z: 0 });
      expect(transform.basis_y).toEqual({ x: 0, y: 2, z: 0 });
      expect(transform.basis_z).toEqual({ x: 0, y: 0, z: 2 });
    });

    it('should throw on invalid format', () => {
      expect(() => parseTransform3D('NotATransform')).toThrow();
    });

    it('should throw on wrong number of values', () => {
      expect(() => parseTransform3D('Transform3D(1, 0, 0)')).toThrow();
    });
  });

  describe('decomposeTransform3D', () => {
    it('should decompose identity transform', () => {
      const transform = identityTransform3D();
      const decomposed = decomposeTransform3D(transform);

      expect(decomposed.position).toEqual({ x: 0, y: 0, z: 0 });
      expect(decomposed.rotation.x).toBeCloseTo(0);
      expect(decomposed.rotation.y).toBeCloseTo(0);
      expect(decomposed.rotation.z).toBeCloseTo(0);
      expect(decomposed.scale).toEqual({ x: 1, y: 1, z: 1 });
    });

    it('should extract position', () => {
      const transform = parseTransform3D('Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 2, 3, 4)');
      const decomposed = decomposeTransform3D(transform);

      expect(decomposed.position).toEqual({ x: 2, y: 3, z: 4 });
    });

    it('should extract scale', () => {
      const transform = parseTransform3D('Transform3D(2, 0, 0, 0, 3, 0, 0, 0, 4, 0, 0, 0)');
      const decomposed = decomposeTransform3D(transform);

      expect(decomposed.scale.x).toBeCloseTo(2);
      expect(decomposed.scale.y).toBeCloseTo(3);
      expect(decomposed.scale.z).toBeCloseTo(4);
    });

    it('should extract rotation', () => {
      // 90-degree rotation around Y axis
      const transform = parseTransform3D('Transform3D(0, 0, -1, 0, 1, 0, 1, 0, 0, 0, 0, 0)');
      const decomposed = decomposeTransform3D(transform);

      // Should have rotation around Y axis (approximately PI/2)
      expect(Math.abs(decomposed.rotation.y)).toBeGreaterThan(1.5);
    });
  });
});
