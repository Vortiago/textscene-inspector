import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
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
      // Godot column-major basis for Ry(+π/2):
      // Ry(+90°) rotation matrix:
      //   |  0  0  1 |
      //   |  0  1  0 |
      //   | -1  0  0 |
      // Godot stores Basis as rows (Vector3 rows[3]); basis_x = row 0, etc.
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
      expect(result.rotation.z).toBeCloseTo(0, 5); // Gimbal lock sets Z to 0
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
      expect(result.rotation.z).toBeCloseTo(0, 5); // Gimbal lock sets Z to 0
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

    describe('rotation + scale combined', () => {
      it('should decompose 90° Y-rotation with Z-scale=6 (edge-plane-rotated-scaled.tscn TestWall)', () => {
        // Restored from 401f8f5 (#31 "Fix Transform3D decomposition for
        // rotated+scaled planes"). The intermediate commit b4ccaab
        // (WI-R3F-10) wrongly rewrote this test to assert the buggy
        // (transposed) decomposition output, with a rationalising comment
        // that the user's intent "isn't recoverable". That was wrong —
        // Godot's Basis is `Vector3 rows[3]`, so the matrix CAN be
        // recovered correctly; earlier code was transposing it.
        const transform = parseTransform3D(
          'Transform3D(-4.371139e-08, 0, 6, 0, 1, 0, -1, 0, -2.6226832e-07, 0, 0, 0)'
        );
        const result = decomposeTransform3D(transform);

        expect(result.scale.x).toBeCloseTo(1, 5);
        expect(result.scale.y).toBeCloseTo(1, 5);
        expect(result.scale.z).toBeCloseTo(6, 5);
        expect(result.rotation.y).toBeCloseTo(Math.PI / 2, 5);
      });


      it('ShortWall with origin: FACE_X vertex (0,0,1) maps to world x≈6 (12-unit wide wall)', () => {
        // Full ShortWall transform including origin=(0,0,1.75).
        // Decompose gives scale.z=6, rotation.y=+π/2, position=(0,0,1.75).
        // Applying that TRS to local (0, 0, 1):
        //   after scale:    (0, 0, 6)
        //   after Ry(+π/2): (6, 0, 0)  [Ry maps +Z → +X]
        //   after translate: (6, 0, 1.75)
        // world_x=6 confirms the wall is 12 units wide (z∈[-1,1] → x∈[-6,6]).
        const transform = parseTransform3D(
          'Transform3D(-4.371139e-08, 0, 6, 0, 1, 0, -1, 0, -2.6226832e-07, 0, 0, 1.75)'
        );
        const result = decomposeTransform3D(transform);

        // Manually apply TRS to local (0, 0, 1):
        //   scaled: (0, 0, scale.z * 1) = (0, 0, 6)
        //   rotated by Ry(rotation.y): (sin(ry)*z, 0, cos(ry)*z)
        //     ≈ (sin(π/2)*6, 0, cos(π/2)*6) = (6, 0, ≈0)
        //   translated: (6 + pos.x, 0 + pos.y, ≈0 + pos.z) = (6, 0, 1.75)
        const sz = result.scale.z;
        const ry = result.rotation.y;
        const worldX = Math.sin(ry) * sz * 1 + result.position.x;
        expect(worldX).toBeCloseTo(6, 3);
        expect(result.position.z).toBeCloseTo(1.75, 4);
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

  describe('nested-transform composition (HallwayGeometry parent chain)', () => {
    // Builds a THREE.Matrix4 from a Transform3D using the corrected row-major
    // interpretation, then recompose from TRS to simulate what R3F does when
    // updateMatrixWorld walks the hierarchy.
    function trsMatrixFromTransform3DString(s: string): THREE.Matrix4 {
      const t = parseTransform3D(s);
      const { position, rotation, scale } = decomposeTransform3D(t);
      const pos = new THREE.Vector3(position.x, position.y, position.z);
      const quat = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(rotation.x, rotation.y, rotation.z, 'XYZ')
      );
      const sc = new THREE.Vector3(scale.x, scale.y, scale.z);
      return new THREE.Matrix4().compose(pos, quat, sc);
    }

    it('EndWall world origin ≈ (9.025, 0, 8.75) — ShortCorridor + HallwayGeometry parent chain', () => {
      // Transform chain from example-hallway.tscn + HallwayGeometry.tscn:
      //   HallwayGeometry (in example-hallway.tscn): near-identity, tiny offsets
      //   ShortCorridor   (in HallwayGeometry.tscn): pure translation x=7.775
      //   EndWall         (in HallwayGeometry.tscn): rotated+scaled wall
      const mHallwayGeometry = trsMatrixFromTransform3DString(
        'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, -0.0010881424, 0.0035161972, 0.0035357475)'
      );
      const mShortCorridor = trsMatrixFromTransform3DString(
        'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 7.775, 0, 0)'
      );
      const mEndWall = trsMatrixFromTransform3DString(
        'Transform3D(-4.371139e-08, 0, 3, 0, 1, 0, -1, 0, -1.3113416e-07, 1.2504363, 0, 8.75)'
      );

      // World matrix = HallwayGeometry * ShortCorridor * EndWall
      const worldMatrix = new THREE.Matrix4()
        .multiplyMatrices(mHallwayGeometry, mShortCorridor)
        .multiply(mEndWall);

      const worldPos = new THREE.Vector3().setFromMatrixPosition(worldMatrix);

      // ShortCorridor x=7.775 + EndWall origin x=1.2504363 + HallwayGeometry offset ≈ 9.025
      expect(worldPos.x).toBeCloseTo(9.024, 2);
      // EndWall origin z=8.75 + HallwayGeometry offset z≈0.0035 ≈ 8.753
      expect(worldPos.z).toBeCloseTo(8.753, 2);
      expect(worldPos.y).toBeCloseTo(0.003, 2);
    });

    it('EndWall FACE_X vertex (0,0,1) maps to world x ≈ 9.025 + 3 = 12.025 (6-unit wide wall)', () => {
      // EndWall has scale.z≈3 (from basis_z column magnitude) and rotation.y≈π/2.
      // FACE_X local vertex (0, 0, 1) after TRS:
      //   scaled:  (0, 0, 3)
      //   Ry(π/2): (3, 0, ~0)  [sin(π/2)*3 = 3]
      //   translate: (1.2504363 + 3, 0, 8.75) = (4.2504363, 0, 8.75)
      // Through ShortCorridor (x+7.775): (12.025, 0, 8.75)
      // Through HallwayGeometry (tiny offsets): ≈(12.024, 0.003, 8.753)
      const mHallwayGeometry = trsMatrixFromTransform3DString(
        'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, -0.0010881424, 0.0035161972, 0.0035357475)'
      );
      const mShortCorridor = trsMatrixFromTransform3DString(
        'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 7.775, 0, 0)'
      );
      const mEndWall = trsMatrixFromTransform3DString(
        'Transform3D(-4.371139e-08, 0, 3, 0, 1, 0, -1, 0, -1.3113416e-07, 1.2504363, 0, 8.75)'
      );

      const worldMatrix = new THREE.Matrix4()
        .multiplyMatrices(mHallwayGeometry, mShortCorridor)
        .multiply(mEndWall);

      const localVertex = new THREE.Vector3(0, 0, 1);
      const worldVertex = localVertex.applyMatrix4(worldMatrix);

      // Wall is 6 units wide (z∈[-1,1] → world x ∈ [9.024-3, 9.024+3])
      expect(worldVertex.x).toBeCloseTo(12.024, 1);
      expect(worldVertex.z).toBeCloseTo(8.753, 1);
    });

    it('EndWall local origin without parent chain — confirms leaf decompose is correct', () => {
      // Isolated unit: just the EndWall transform, no parents.
      // Verifies the leaf decompose produces correct origin independent of composition.
      const endWall = parseTransform3D(
        'Transform3D(-4.371139e-08, 0, 3, 0, 1, 0, -1, 0, -1.3113416e-07, 1.2504363, 0, 8.75)'
      );
      const result = decomposeTransform3D(endWall);

      expect(result.position.x).toBeCloseTo(1.2504363, 4);
      expect(result.position.y).toBeCloseTo(0, 4);
      expect(result.position.z).toBeCloseTo(8.75, 4);
      expect(result.scale.z).toBeCloseTo(3, 4);
      expect(result.rotation.y).toBeCloseTo(Math.PI / 2, 4);
    });
  });
});
