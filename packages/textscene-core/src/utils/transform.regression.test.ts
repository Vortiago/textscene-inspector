/**
 * Regression guard for the row-vs-column basis interpretation of
 * decomposeTransform3D. Godot serializes Basis as three ROWS; treating
 * them as columns transposes every rotation. This file pins the correct
 * row-major behavior with the original assertions from the fix history:
 *
 * 401f8f5 ("Fix Transform3D decomposition for rotated+scaled planes", Nov 2025)
 * established that the ShortWall transform decomposes to scale.z=6, rotation.y=+π/2.
 *
 * b4ccaab (May 2026) re-broke decomposeTransform3D by treating basis
 * vectors as columns instead of rows, then rewrote tests to assert the buggy output
 * (scale.x=6, rotation.y=-π/2) with a comment saying the user intent "isn't
 * recoverable from the flat serialisation". That was incorrect.
 *
 * 99c1479 ("fix(walls)", May 2026) corrected the row-vector convention again.
 *
 * A test failing here means the transposition bug is back.
 */

import { describe, it, expect } from 'vitest';
import { parseTransform3D, decomposeTransform3D } from './transform';
import type { Transform3D } from '../nodes/base/node3d/types';

describe('row-major basis regression: 401f8f5 assertions vs current code', () => {
  describe('ShortWall transform (the known smoking gun)', () => {
    it('[401f8f5] scale.z should be 6 for the ShortWall-like transform', () => {
      // The original correct assertion from 401f8f5.
      // b4ccaab changed this to scale.x=6, rotation.y=-pi/2 (the transposed/buggy output).
      // 99c1479 restored the correct row-vector interpretation.
      const transform = parseTransform3D(
        'Transform3D(-4.371139e-08, 0, 6, 0, 1, 0, -1, 0, -2.6226832e-07, 0, 0, 0)'
      );
      const result = decomposeTransform3D(transform);

      expect(result.scale.x).toBeCloseTo(1, 5);
      expect(result.scale.y).toBeCloseTo(1, 5);
      expect(result.scale.z).toBeCloseTo(6, 5);
      expect(result.rotation.y).toBeCloseTo(Math.PI / 2, 5);
    });

    it('[401f8f5] ReferenceWall (no rotation, just Z-scale) should decompose correctly', () => {
      const transformString = 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 6, 0, 0, 5)';
      const transform = parseTransform3D(transformString);
      const result = decomposeTransform3D(transform);

      expect(result.rotation.x).toBeCloseTo(0, 5);
      expect(result.rotation.y).toBeCloseTo(0, 5);
      expect(result.rotation.z).toBeCloseTo(0, 5);
      expect(result.scale.x).toBeCloseTo(1, 5);
      expect(result.scale.y).toBeCloseTo(1, 5);
      expect(result.scale.z).toBeCloseTo(6, 5);
      expect(result.position.z).toBeCloseTo(5, 5);
    });
  });

  describe('Y-axis rotation basis (b4ccaab changed the input data in transform.test.ts)', () => {
    it('[pre-b4ccaab] Ry(+pi/2) row-major basis should yield rotation.y = +pi/2', () => {
      // Original test data from before b4ccaab.
      // b4ccaab swapped to column-major: basis_x={z:-1}, basis_z={x:1}
      // 99c1479 restored to row-major: basis_x={z:1}, basis_z={x:-1}
      const transform: Transform3D = {
        basis_x: { x: 0, y: 0, z: 1 },
        basis_y: { x: 0, y: 1, z: 0 },
        basis_z: { x: -1, y: 0, z: 0 },
        origin: { x: 0, y: 0, z: 0 },
      };

      const result = decomposeTransform3D(transform);
      expect(result.rotation.y).toBeCloseTo(Math.PI / 2, 5);
    });
  });

  describe('Component.transform.test.tsx rotation basis vectors (d7a69da original WI-R3F-9)', () => {
    // These tests verify that the row-major interpretation is consistent
    // with the Godot Basis documentation (rows[3]).
    // b4ccaab passed these tests by keeping the WRONG basis vectors from the original
    // d7a69da column-major interpretation — the implementation was changed to match,
    // but the test data itself was WRONG for what the test claimed to test.
    // 99c1479 corrected the test data to use proper row-major vectors.

    it('[d7a69da original] Rx(90°) — column-major input from d7a69da should NOT give rotation.x=+pi/2', () => {
      // d7a69da used column-major convention: basis_y={(0,0,1)}, basis_z={(0,-1,0)}
      // This is actually Rx(+90°) in COLUMN-major — i.e., Rx(-90°) in row-major.
      // b4ccaab claimed to "fix" by swapping the decompose algorithm, making these pass.
      // But those basis vectors are the WRONG representation of Rx(+90°) in row-major.
      // 99c1479 changed the test data to row-major: basis_y={(0,0,-1)}, basis_z={(0,1,0)}.
      const columnMajorBasis: Transform3D = {
        basis_x: { x: 1, y: 0, z: 0 },
        basis_y: { x: 0, y: 0, z: 1 },   // column-major Rx(+90°)
        basis_z: { x: 0, y: -1, z: 0 },
        origin: { x: 0, y: 0, z: 0 },
      };
      const rowMajorBasis: Transform3D = {
        basis_x: { x: 1, y: 0, z: 0 },
        basis_y: { x: 0, y: 0, z: -1 },  // row-major Rx(+90°)
        basis_z: { x: 0, y: 1, z: 0 },
        origin: { x: 0, y: 0, z: 0 },
      };

      const resultColumn = decomposeTransform3D(columnMajorBasis);
      const resultRow = decomposeTransform3D(rowMajorBasis);

      // Only the row-major version should give rotation.x ≈ +π/2
      expect(resultRow.rotation.x).toBeCloseTo(Math.PI / 2, 4);
      // The column-major version gives the TRANSPOSED result (rotation.x ≈ -π/2)
      expect(resultColumn.rotation.x).toBeCloseTo(-Math.PI / 2, 4);
    });
  });

  describe('end-to-end wall width verification', () => {
    it('ShortWall with origin: FACE_X vertex (0,0,1) maps to world x≈6', () => {
      // Verify the concrete visual effect: the ShortWall should be 12 units wide
      // (z∈[-1,1] → x∈[-6,6] after Ry(+π/2) with scale.z=6).
      const transform = parseTransform3D(
        'Transform3D(-4.371139e-08, 0, 6, 0, 1, 0, -1, 0, -2.6226832e-07, 0, 0, 1.75)'
      );
      const result = decomposeTransform3D(transform);

      // Apply TRS to local (0, 0, 1): scale → rotate → translate
      const sz = result.scale.z;
      const ry = result.rotation.y;
      const worldX = Math.sin(ry) * sz * 1 + result.position.x;
      expect(worldX).toBeCloseTo(6, 3);
      expect(result.position.z).toBeCloseTo(1.75, 4);
    });
  });
});
