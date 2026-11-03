import { describe, expect, it } from 'vitest';
import { occluderAabb } from './occluder';

/** Every value below is measured in Godot 4.6.3 (`/mnt/project-files/aabb-1122/occluder-oracle.out.txt`). */
/** Adding 0 turns the negative zero of `-size / 2` into 0. */
const corner = ({ x, y, z }: { x: number; y: number; z: number }) => [x + 0, y + 0, z + 0];

describe('Occluder3D::get_aabb (occluder_instance_3d.cpp:50-58, 120)', () => {
  it('is the box of the size for a BoxOccluder3D', () => {
    const aabb = occluderAabb({ kind: 'box', size: { x: 4, y: 2, z: 6 } });
    expect(corner(aabb.position)).toEqual([-2, -1, -3]);
    expect(corner(aabb.size)).toEqual([4, 2, 6]);
  });

  it('clamps a negative box size to 0', () => {
    const aabb = occluderAabb({ kind: 'box', size: { x: -1, y: 2, z: 3 } });
    expect(corner(aabb.position)).toEqual([0, -1, -1.5]);
    expect(corner(aabb.size)).toEqual([0, 2, 3]);
  });

  it('is flat in z for a QuadOccluder3D', () => {
    const aabb = occluderAabb({ kind: 'quad', size: { x: 3, y: 5 } });
    expect(corner(aabb.position)).toEqual([-1.5, -2.5, 0]);
    expect(corner(aabb.size)).toEqual([3, 5, 0]);
  });

  it('is the box of the 72 vertices of the sphere mesh for a SphereOccluder3D, which 7 segments leave uneven', () => {
    const aabb = occluderAabb({ kind: 'sphere', radius: 2 });
    expect(aabb.position.x).toBeCloseTo(-1.801938, 5);
    expect(aabb.position.y).toBeCloseTo(-2, 5);
    expect(aabb.position.z).toBeCloseTo(-1.949856, 5);
    expect(aabb.size.x).toBeCloseTo(3.801938, 5);
    expect(aabb.size.y).toBeCloseTo(4, 5);
    expect(aabb.size.z).toBeCloseTo(3.899712, 5);
  });

  it('is empty for a negative radius', () => {
    expect(corner(occluderAabb({ kind: 'sphere', radius: -3 }).size)).toEqual([0, 0, 0]);
  });

  it('includes the origin for a polygon off it, as the box starts from AABB()', () => {
    const aabb = occluderAabb({
      kind: 'polygon',
      polygon: [
        { x: 1, y: 1 },
        { x: 5, y: 1 },
        { x: 5, y: 4 },
        { x: 1, y: 4 },
      ],
    });
    expect(corner(aabb.position)).toEqual([0, 0, 0]);
    expect(corner(aabb.size)).toEqual([5, 4, 0]);
  });

  it('is the box of a clockwise polygon', () => {
    const aabb = occluderAabb({
      kind: 'polygon',
      polygon: [
        { x: -2, y: -1 },
        { x: -2, y: 3 },
        { x: 2, y: 3 },
        { x: 2, y: -1 },
      ],
    });
    expect(corner(aabb.position)).toEqual([-2, -1, 0]);
    expect(corner(aabb.size)).toEqual([4, 4, 0]);
  });

  it.each([
    [
      'two points',
      [
        { x: 1, y: 1 },
        { x: 5, y: 1 },
      ],
    ],
    [
      'a bow tie',
      [
        { x: 1, y: 1 },
        { x: 5, y: 4 },
        { x: 5, y: 1 },
        { x: 1, y: 4 },
      ],
    ],
  ])('is empty for a polygon of %s, which Godot clears of vertices', (_label, polygon) => {
    expect(corner(occluderAabb({ kind: 'polygon', polygon }).size)).toEqual([0, 0, 0]);
  });

  it('is the box of the vertices and the origin for an ArrayOccluder3D', () => {
    const aabb = occluderAabb({
      kind: 'array',
      vertices: [
        { x: 1, y: 2, z: 3 },
        { x: 4, y: 5, z: 6 },
        { x: 2, y: 3, z: 9 },
      ],
    });
    expect(corner(aabb.position)).toEqual([0, 0, 0]);
    expect(corner(aabb.size)).toEqual([4, 5, 9]);
  });

  it('is empty for an ArrayOccluder3D with no vertices', () => {
    expect(corner(occluderAabb({ kind: 'array', vertices: [] }).size)).toEqual([0, 0, 0]);
  });
});
