/** The three unit axes that Godot's CPUParticles3D gizmo draws from the centre of its box. */
import { describe, expect, it } from 'vitest';
import { EMPTY_AABB } from '../../../../godot/math/aabb';
import { centreAxisLines } from './centreAxes';

describe('centreAxisLines', () => {
  it('runs a segment of length 1 along +X, +Y and +Z from the centre of the box', () => {
    const box = { position: { x: -1, y: 0, z: -1 }, size: { x: 2, y: 3, z: 2 } };
    expect(centreAxisLines(box)).toEqual([0, 1.5, 0, 1, 1.5, 0, 0, 1.5, 0, 0, 2.5, 0, 0, 1.5, 0, 0, 1.5, 1]);
  });

  it('starts at the origin for AABB() (edge case)', () => {
    expect(centreAxisLines(EMPTY_AABB)).toEqual([0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1]);
  });

  it('keeps the length of 1 whatever the size of the box (edge case)', () => {
    const box = { position: { x: 0, y: 0, z: 0 }, size: { x: 100, y: 100, z: 100 } };
    expect(centreAxisLines(box).slice(0, 6)).toEqual([50, 50, 50, 51, 50, 50]);
  });
});
