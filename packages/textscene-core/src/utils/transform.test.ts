import { describe, it, expect } from 'vitest';
import {
  parseTransform3D,
  decomposeTransform3D,
  identityTransform3D,
  parseOptionalTransform,
} from './transform';
import type { Transform3D } from '../nodes/base/node3d/types';

describe('transform utils', () => {
  describe('parseTransform3D', () => {
    it('should parse identity transform', () => {
      const result = parseTransform3D('Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)');

      expect(result).toEqual({
        basis_x: { x: 1, y: 0, z: 0 },
        basis_y: { x: 0, y: 1, z: 0 },
        basis_z: { x: 0, y: 0, z: 1 },
        origin: { x: 0, y: 0, z: 0 },
      });
    });

    it('should parse transform with translation', () => {
      const result = parseTransform3D('Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 5, 10, 15)');

      expect(result.origin).toEqual({ x: 5, y: 10, z: 15 });
    });

    it('should parse transform with negative values', () => {
      const result = parseTransform3D('Transform3D(-1, 0, 0, 0, -1, 0, 0, 0, -1, -5, -10, -15)');

      expect(result.basis_x).toEqual({ x: -1, y: 0, z: 0 });
      expect(result.origin).toEqual({ x: -5, y: -10, z: -15 });
    });

    it('should parse transform with floating point values', () => {
      const result = parseTransform3D('Transform3D(1.5, 0.5, 0.25, 0, 1, 0, 0, 0, 1, 2.5, 3.75, 4.125)');

      expect(result.basis_x.x).toBeCloseTo(1.5);
      expect(result.basis_x.y).toBeCloseTo(0.5);
      expect(result.basis_x.z).toBeCloseTo(0.25);
      expect(result.origin.x).toBeCloseTo(2.5);
      expect(result.origin.y).toBeCloseTo(3.75);
      expect(result.origin.z).toBeCloseTo(4.125);
    });

    it('should parse transform with scientific notation', () => {
      const result = parseTransform3D('Transform3D(1e-5, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)');

      expect(result.basis_x.x).toBeCloseTo(0.00001);
    });

    it('should handle extra whitespace', () => {
      const result = parseTransform3D('Transform3D( 1 ,  0 ,  0 ,  0 ,  1 ,  0 ,  0 ,  0 ,  1 ,  0 ,  0 ,  0 )');

      expect(result).toEqual({
        basis_x: { x: 1, y: 0, z: 0 },
        basis_y: { x: 0, y: 1, z: 0 },
        basis_z: { x: 0, y: 0, z: 1 },
        origin: { x: 0, y: 0, z: 0 },
      });
    });

    it('should throw error for invalid format', () => {
      expect(() => parseTransform3D('NotATransform')).toThrow('Invalid Transform3D format');
    });

    it('should throw error for missing values', () => {
      expect(() => parseTransform3D('Transform3D(1, 0, 0, 0, 1, 0)')).toThrow(
        'Transform3D must have 12 values'
      );
    });

    it('should throw error for too many values', () => {
      expect(() =>
        parseTransform3D('Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 2, 3)')
      ).toThrow('Transform3D must have 12 values');
    });

    it('should throw error for non-numeric values', () => {
      expect(() =>
        parseTransform3D('Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, a, b, c)')
      ).toThrow('Invalid Transform3D format');
    });

    it('should throw error for empty string', () => {
      expect(() => parseTransform3D('')).toThrow('Invalid Transform3D format');
    });
  });

  describe('decomposeTransform3D', () => {
    it('should decompose identity transform', () => {
      const transform: Transform3D = {
        basis_x: { x: 1, y: 0, z: 0 },
        basis_y: { x: 0, y: 1, z: 0 },
        basis_z: { x: 0, y: 0, z: 1 },
        origin: { x: 0, y: 0, z: 0 },
      };

      const result = decomposeTransform3D(transform);

      expect(result.position).toEqual({ x: 0, y: 0, z: 0 });
      expect(result.rotation.x).toBeCloseTo(0);
      expect(result.rotation.y).toBeCloseTo(0);
      expect(result.rotation.z).toBeCloseTo(0);
      expect(result.scale).toEqual({ x: 1, y: 1, z: 1 });
    });

    it('should decompose transform with translation only', () => {
      const transform: Transform3D = {
        basis_x: { x: 1, y: 0, z: 0 },
        basis_y: { x: 0, y: 1, z: 0 },
        basis_z: { x: 0, y: 0, z: 1 },
        origin: { x: 10, y: 20, z: 30 },
      };

      const result = decomposeTransform3D(transform);

      expect(result.position).toEqual({ x: 10, y: 20, z: 30 });
      expect(result.scale).toEqual({ x: 1, y: 1, z: 1 });
    });

    it('should decompose transform with uniform scale', () => {
      const transform: Transform3D = {
        basis_x: { x: 2, y: 0, z: 0 },
        basis_y: { x: 0, y: 2, z: 0 },
        basis_z: { x: 0, y: 0, z: 2 },
        origin: { x: 0, y: 0, z: 0 },
      };

      const result = decomposeTransform3D(transform);

      expect(result.scale.x).toBeCloseTo(2);
      expect(result.scale.y).toBeCloseTo(2);
      expect(result.scale.z).toBeCloseTo(2);
    });

    it('should decompose transform with non-uniform scale', () => {
      const transform: Transform3D = {
        basis_x: { x: 2, y: 0, z: 0 },
        basis_y: { x: 0, y: 3, z: 0 },
        basis_z: { x: 0, y: 0, z: 4 },
        origin: { x: 0, y: 0, z: 0 },
      };

      const result = decomposeTransform3D(transform);

      expect(result.scale.x).toBeCloseTo(2);
      expect(result.scale.y).toBeCloseTo(3);
      expect(result.scale.z).toBeCloseTo(4);
    });

    it('should decompose transform with rotation around Y axis', () => {
      // 90 degree rotation around Y axis
      const transform: Transform3D = {
        basis_x: { x: 0, y: 0, z: 1 },
        basis_y: { x: 0, y: 1, z: 0 },
        basis_z: { x: -1, y: 0, z: 0 },
        origin: { x: 0, y: 0, z: 0 },
      };

      const result = decomposeTransform3D(transform);

      expect(result.rotation.y).toBeCloseTo(Math.PI / 2, 5);
    });

    it('should decompose transform with small scale values', () => {
      const transform: Transform3D = {
        basis_x: { x: 0.1, y: 0, z: 0 },
        basis_y: { x: 0, y: 0.1, z: 0 },
        basis_z: { x: 0, y: 0, z: 0.1 },
        origin: { x: 0, y: 0, z: 0 },
      };

      const result = decomposeTransform3D(transform);

      expect(result.scale.x).toBeCloseTo(0.1);
      expect(result.scale.y).toBeCloseTo(0.1);
      expect(result.scale.z).toBeCloseTo(0.1);
    });

    it('should decompose transform with large scale values', () => {
      const transform: Transform3D = {
        basis_x: { x: 100, y: 0, z: 0 },
        basis_y: { x: 0, y: 100, z: 0 },
        basis_z: { x: 0, y: 0, z: 100 },
        origin: { x: 0, y: 0, z: 0 },
      };

      const result = decomposeTransform3D(transform);

      expect(result.scale.x).toBeCloseTo(100);
      expect(result.scale.y).toBeCloseTo(100);
      expect(result.scale.z).toBeCloseTo(100);
    });

    it('should handle gimbal lock singularity (basis_z.x near 1)', () => {
      const transform: Transform3D = {
        basis_x: { x: 0, y: 0, z: 1 },
        basis_y: { x: 0, y: 1, z: 0 },
        basis_z: { x: -0.99999999, y: 0, z: 0 },
        origin: { x: 0, y: 0, z: 0 },
      };

      const result = decomposeTransform3D(transform);

      // Should use alternative calculation for gimbal lock
      expect(result.rotation.z).toBe(0); // Gimbal lock sets Z to 0
      expect(typeof result.rotation.x).toBe('number');
      expect(typeof result.rotation.y).toBe('number');
    });

    it('should handle gimbal lock singularity (basis_z.x near -1)', () => {
      const transform: Transform3D = {
        basis_x: { x: 0, y: 1, z: 0 },
        basis_y: { x: -1, y: 0, z: 0 },
        basis_z: { x: 0.99999999, y: 0, z: 0 },
        origin: { x: 0, y: 0, z: 0 },
      };

      const result = decomposeTransform3D(transform);

      // Should use alternative calculation for gimbal lock
      expect(result.rotation.z).toBe(0); // Gimbal lock sets Z to 0
      expect(typeof result.rotation.x).toBe('number');
      expect(typeof result.rotation.y).toBe('number');
    });

    it('should decompose combined transform (translation + rotation + scale)', () => {
      const transform: Transform3D = {
        basis_x: { x: 2, y: 0, z: 0 },
        basis_y: { x: 0, y: 2, z: 0 },
        basis_z: { x: 0, y: 0, z: 2 },
        origin: { x: 5, y: 10, z: 15 },
      };

      const result = decomposeTransform3D(transform);

      expect(result.position).toEqual({ x: 5, y: 10, z: 15 });
      expect(result.scale.x).toBeCloseTo(2);
      expect(result.scale.y).toBeCloseTo(2);
      expect(result.scale.z).toBeCloseTo(2);
    });

    describe('rotation + scale combined (bug fix: column-major interpretation)', () => {
      it('should decompose 90° Y-rotation with Z-scale=6 (edge-plane-rotated-scaled.tscn TestWall)', () => {
        // The actual bug case from the fixture
        // Transform: basis rotated 90° around Y, then Z-axis scaled by 6
        const transform = parseTransform3D(
          'Transform3D(-4.371139e-08, 0, 6, 0, 1, 0, -1, 0, -2.6226832e-07, 0, 0, 0)'
        );
        const result = decomposeTransform3D(transform);

        // Expected: Rotation Y=90°, Scale Z=6
        // Bug: Currently extracts Scale X=6 (wrong axis)
        expect(result.scale.x).toBeCloseTo(1, 5);
        expect(result.scale.y).toBeCloseTo(1, 5);
        expect(result.scale.z).toBeCloseTo(6, 5); // FAILS: gets scaleX=6 instead
        expect(result.rotation.y).toBeCloseTo(Math.PI / 2, 5);
      });


      it('should match Godot for edge-plane-rotated-scaled.tscn ReferenceWall', () => {
        // This should already work (no rotation, just scale)
        const transformString = 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 6, 0, 0, 5)';
        const transform = parseTransform3D(transformString);
        const result = decomposeTransform3D(transform);

        // No rotation, Z-scale=6, Z-position=5
        expect(result.rotation.x).toBeCloseTo(0, 5);
        expect(result.rotation.y).toBeCloseTo(0, 5);
        expect(result.rotation.z).toBeCloseTo(0, 5);
        expect(result.scale.x).toBeCloseTo(1, 5);
        expect(result.scale.y).toBeCloseTo(1, 5);
        expect(result.scale.z).toBeCloseTo(6, 5);
        expect(result.position.z).toBeCloseTo(5, 5);
      });
    });
    it('should preserve original transform object (immutability)', () => {
      const transform: Transform3D = {
        basis_x: { x: 1, y: 0, z: 0 },
        basis_y: { x: 0, y: 1, z: 0 },
        basis_z: { x: 0, y: 0, z: 1 },
        origin: { x: 5, y: 10, z: 15 },
      };

      const originalOrigin = { ...transform.origin };
      decomposeTransform3D(transform);

      // Original should not be modified
      expect(transform.origin).toEqual(originalOrigin);
    });
  });

  describe('identityTransform3D', () => {
    it('should return identity transform', () => {
      const result = identityTransform3D();

      expect(result).toEqual({
        basis_x: { x: 1, y: 0, z: 0 },
        basis_y: { x: 0, y: 1, z: 0 },
        basis_z: { x: 0, y: 0, z: 1 },
        origin: { x: 0, y: 0, z: 0 },
      });
    });

    it('should return new object each time', () => {
      const identity1 = identityTransform3D();
      const identity2 = identityTransform3D();

      expect(identity1).toEqual(identity2);
      expect(identity1).not.toBe(identity2);
    });

    it('should decompose to zero rotation and unit scale', () => {
      const identity = identityTransform3D();
      const decomposed = decomposeTransform3D(identity);

      expect(decomposed.position).toEqual({ x: 0, y: 0, z: 0 });
      expect(decomposed.rotation.x).toBeCloseTo(0);
      expect(decomposed.rotation.y).toBeCloseTo(0);
      expect(decomposed.rotation.z).toBeCloseTo(0);
      expect(decomposed.scale).toEqual({ x: 1, y: 1, z: 1 });
    });
  });

  describe('parseOptionalTransform', () => {
    it('should return undefined for undefined input', () => {
      const result = parseOptionalTransform(undefined, 'TestNode');

      expect(result).toBeUndefined();
    });

    it('should parse valid transform string', () => {
      const result = parseOptionalTransform(
        'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 5, 10, 15)',
        'TestNode'
      );

      expect(result).toBeDefined();
      expect(result?.origin).toEqual({ x: 5, y: 10, z: 15 });
    });

    it('should return identity transform for invalid input (with warning)', () => {
      const result = parseOptionalTransform('InvalidTransform', 'TestNode');

      expect(result).toEqual(identityTransform3D());
    });

    it('should return identity transform for malformed string', () => {
      const result = parseOptionalTransform('Transform3D(1, 2, 3)', 'TestNode');

      expect(result).toEqual(identityTransform3D());
    });

    it('should handle node name in warning message', () => {
      const result = parseOptionalTransform('BadTransform', 'MySpecialNode');

      // Should return identity transform (warning is logged but we can't easily test that)
      expect(result).toEqual(identityTransform3D());
    });

    it('should handle Error objects in catch block', () => {
      const result = parseOptionalTransform('Transform3D()', 'TestNode');

      expect(result).toEqual(identityTransform3D());
    });
  });

  describe('integration', () => {
    it('should round-trip parse and decompose identity transform', () => {
      const transformString = 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)';
      const parsed = parseTransform3D(transformString);
      const decomposed = decomposeTransform3D(parsed);

      expect(decomposed.position).toEqual({ x: 0, y: 0, z: 0 });
      expect(decomposed.scale).toEqual({ x: 1, y: 1, z: 1 });
    });

    it('should handle real-world transform from TSCN file', () => {
      // Example from actual Godot scene
      const transformString = 'Transform3D(2.5, 0, 0, 0, 2.5, 0, 0, 0, 2.5, 10, 5, -3)';
      const parsed = parseTransform3D(transformString);
      const decomposed = decomposeTransform3D(parsed);

      expect(decomposed.position).toEqual({ x: 10, y: 5, z: -3 });
      expect(decomposed.scale.x).toBeCloseTo(2.5);
      expect(decomposed.scale.y).toBeCloseTo(2.5);
      expect(decomposed.scale.z).toBeCloseTo(2.5);
    });
  });
});
