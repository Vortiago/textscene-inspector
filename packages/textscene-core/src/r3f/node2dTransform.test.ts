import { describe, it, expect } from 'vitest';
import { node2dGroupProps, node2dGroupSpread } from './node2dTransform';

describe('node2dGroupProps', () => {
  it('conjugates by diag(1,-1,1): negates Y translation and rotation, preserves scale', () => {
    const r = node2dGroupProps({ position: { x: 100, y: 50 }, rotation: Math.PI / 4, scale: { x: 2, y: 3 } }, 0.5);
    expect(r.position).toEqual([100, -50, 0.5]);
    expect(r.rotation).toEqual([0, 0, -Math.PI / 4]);
    expect(r.scale).toEqual([2, 3, 1]);
  });

  it('omits a matrix when skew is zero/absent (TRS fast path)', () => {
    expect(node2dGroupProps({ position: { x: 0, y: 0 }, rotation: 0, scale: { x: 1, y: 1 } }).matrix).toBeUndefined();
    expect(
      node2dGroupProps({ position: { x: 0, y: 0 }, rotation: 0, scale: { x: 1, y: 1 }, skew: 0 }).matrix
    ).toBeUndefined();
  });

  it('bakes a non-zero skew into a Matrix4 (T·R·Skew·S conjugated by F)', () => {
    const skew = Math.PI / 6;
    const r = node2dGroupProps({ position: { x: 10, y: 20 }, rotation: 0, scale: { x: 1, y: 1 }, skew }, 0.3);
    expect(r.matrix).toBeDefined();
    // Matrix4.elements is column-major. Linear part (rot=0, scale=1):
    // [[1, sin(skew)], [0, cos(skew)]] in three.js space, and the translation is (10, -20, 0.3).
    const e = r.matrix!.elements;
    expect(e[0]).toBeCloseTo(1, 6); // n11 = cos(rot)*sx
    expect(e[1]).toBeCloseTo(0, 6); // n21 = -sin(rot)*sx
    expect(e[4]).toBeCloseTo(Math.sin(skew), 6); // n12 = sin(rot+skew)*sy
    expect(e[5]).toBeCloseTo(Math.cos(skew), 6); // n22 = cos(rot+skew)*sy
    expect(e[12]).toBeCloseTo(10, 6); // n14 = position.x
    expect(e[13]).toBeCloseTo(-20, 6); // n24 = -position.y
    expect(e[14]).toBeCloseTo(0.3, 6); // n34 = z
  });

  it('node2dGroupSpread → TRS props when no skew, matrix props when skewed', () => {
    const trs = node2dGroupSpread(node2dGroupProps({ position: { x: 1, y: 2 }, rotation: 0, scale: { x: 1, y: 1 } }));
    expect(trs).toHaveProperty('position');
    expect(trs).not.toHaveProperty('matrix');

    const skewed = node2dGroupSpread(
      node2dGroupProps({ position: { x: 1, y: 2 }, rotation: 0, scale: { x: 1, y: 1 }, skew: 0.5 })
    );
    expect(skewed).toHaveProperty('matrix');
    expect((skewed as { matrixAutoUpdate: boolean }).matrixAutoUpdate).toBe(false);
  });

  it('defaults z to 0', () => {
    const r = node2dGroupProps({ position: { x: 0, y: 0 }, rotation: 0, scale: { x: 1, y: 1 } });
    expect(r.position).toEqual([0, 0, 0]);
  });

  it('is its own inverse on Y so nesting composes (double-conjugation cancels)', () => {
    // A child at the same Godot Y as a parent ends at the same three.js Y.
    const parent = node2dGroupProps({ position: { x: 0, y: 30 }, rotation: 0, scale: { x: 1, y: 1 } });
    const child = node2dGroupProps({ position: { x: 0, y: 30 }, rotation: 0, scale: { x: 1, y: 1 } });
    expect(parent.position[1]).toBe(child.position[1]); // both -30
  });
});
