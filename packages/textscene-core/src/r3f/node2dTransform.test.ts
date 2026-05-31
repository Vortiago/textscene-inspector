import { describe, it, expect } from 'vitest';
import { node2dGroupProps } from './node2dTransform';

describe('node2dGroupProps', () => {
  it('conjugates by diag(1,-1,1): negates Y translation and rotation, preserves scale', () => {
    const r = node2dGroupProps({ position: { x: 100, y: 50 }, rotation: Math.PI / 4, scale: { x: 2, y: 3 } }, 0.5);
    expect(r.position).toEqual([100, -50, 0.5]);
    expect(r.rotation).toEqual([0, 0, -Math.PI / 4]);
    expect(r.scale).toEqual([2, 3, 1]);
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
