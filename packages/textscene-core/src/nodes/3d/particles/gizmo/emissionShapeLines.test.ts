/**
 * The emission shape lines of Godot's `Particles3DEmissionShapeGizmoPlugin`. Every expected vertex
 * is a value that Godot 4.6.3 computes for the same input: a GDScript transcription of
 * `particles_3d_emission_shape_gizmo_plugin.cpp:95-216`, run on the engine's own `Vector3` and
 * `Basis`, so the cases are independent of this port.
 */
import { describe, expect, it } from 'vitest';
import { PARTICLE_EMISSION_DEFAULTS } from '../../../../godot/scene/particles3d';
import type { Vector3 } from '../../../../godot/math/vector';
import type { ParticleEmission } from '../emission/types';
import { emissionShapeLines } from './emissionShapeLines';

const SPHERE = 1;
const SPHERE_SURFACE = 2;
const BOX = 3;
const POINTS = 4;
const DIRECTED_POINTS = 5;
const RING = 6;

const NO_OFFSET: Vector3 = { x: 0, y: 0, z: 0 };
const NO_SCALE: Vector3 = { x: 1, y: 1, z: 1 };
const OFFSET: Vector3 = { x: 0, y: 1, z: 0 };
const SCALE: Vector3 = { x: 2, y: 1, z: 1 };

const emission = (overrides: Partial<ParticleEmission>): ParticleEmission => ({
  shape: PARTICLE_EMISSION_DEFAULTS.shape,
  sphereRadius: PARTICLE_EMISSION_DEFAULTS.sphereRadius,
  boxExtents: PARTICLE_EMISSION_DEFAULTS.boxExtents,
  ringAxis: PARTICLE_EMISSION_DEFAULTS.ringAxis,
  ringHeight: PARTICLE_EMISSION_DEFAULTS.ringHeight,
  ringRadius: PARTICLE_EMISSION_DEFAULTS.ringRadius,
  ringInnerRadius: PARTICLE_EMISSION_DEFAULTS.ringInnerRadius,
  ringConeAngle: PARTICLE_EMISSION_DEFAULTS.ringConeAngle,
  ...overrides,
});

const lines = (shape: Partial<ParticleEmission>, offset = NO_OFFSET, scale = NO_SCALE): number[] =>
  emissionShapeLines(emission(shape), offset, scale);

const vertexCount = (positions: number[]): number => positions.length / 3;

/** Asserts that vertex `index` is `expected`, to the float precision Godot draws at. */
function expectVertex(positions: number[], index: number, expected: [number, number, number]): void {
  expected.forEach((value, axis) => expect(positions[index * 3 + axis]).toBeCloseTo(value, 5));
}

describe('emissionShapeLines: shapes without lines', () => {
  it.each([
    ['Point', 0],
    ['Points', POINTS],
    ['Directed Points', DIRECTED_POINTS],
  ])('builds no line for %s', (_name, shape) => {
    expect(lines({ shape })).toEqual([]);
  });
});

describe('emissionShapeLines: sphere', () => {
  it('draws three circles of 121 segments, in the XZ, YZ and XY planes', () => {
    const sphere = lines({ shape: SPHERE });
    expect(vertexCount(sphere)).toBe(726);
    expectVertex(sphere, 0, [0, 0, 1]);
    expectVertex(sphere, 1, [0.052336, 0, 0.99863]);
    expectVertex(sphere, 3, [0, 0.052336, 0.99863]);
    expectVertex(sphere, 5, [0.052336, 0.99863, 0]);
  });

  it('turns a quarter way round at segment 30', () => {
    const sphere = lines({ shape: SPHERE });
    expectVertex(sphere, 180, [1, 0, 0]);
    expectVertex(sphere, 181, [0.99863, 0, -0.052336]);
  });

  it('closes the circle with a last segment that overlaps the first', () => {
    const sphere = lines({ shape: SPHERE });
    expectVertex(sphere, 720, [0, 0, 1]);
    expectVertex(sphere, 721, [0.052336, 0, 0.99863]);
  });

  it('draws a Sphere Surface as the Sphere', () => {
    expect(lines({ shape: SPHERE_SURFACE })).toEqual(lines({ shape: SPHERE }));
  });

  it('scales the circles with the radius', () => {
    const sphere = lines({ shape: SPHERE, sphereRadius: 0.5 });
    expectVertex(sphere, 0, [0, 0, 0.5]);
    expectVertex(sphere, 181, [0.499315, 0, -0.026168]);
  });

  it('scales each circle by the shape scale and moves it by the offset (GPU)', () => {
    const sphere = lines({ shape: SPHERE }, OFFSET, SCALE);
    expectVertex(sphere, 0, [0, 1, 1]);
    expectVertex(sphere, 1, [0.104672, 1, 0.99863]);
    expectVertex(sphere, 4, [0, 2, 0]);
    expectVertex(sphere, 181, [1.997259, 1, -0.052336]);
  });

  it('draws a radius of 0 as lines at the centre (edge case)', () => {
    expect(lines({ shape: SPHERE, sphereRadius: 0 }).every((c) => c === 0)).toBe(true);
  });

  it('draws a negative radius mirrored through the centre, with no guard (edge case)', () => {
    expectVertex(lines({ shape: SPHERE, sphereRadius: -1 }), 0, [0, 0, -1]);
  });
});

describe('emissionShapeLines: box', () => {
  it('draws the 12 edges of the unit box times twice the extents', () => {
    const box = lines({ shape: BOX, boxExtents: { x: 1, y: 1, z: 1 } });
    expect(vertexCount(box)).toBe(24);
    expectVertex(box, 0, [1, -1, -1]);
    expectVertex(box, 1, [-1, -1, -1]);
  });

  it('draws the box of extents (2, 0.5, 1)', () => {
    const box = lines({ shape: BOX, boxExtents: { x: 2, y: 0.5, z: 1 } });
    expectVertex(box, 0, [2, -0.5, -1]);
    expectVertex(box, 1, [-2, -0.5, -1]);
    expectVertex(box, 4, [-2, -0.5, 1]);
    expectVertex(box, 8, [-2, 0.5, -1]);
  });

  it('scales and offsets all 24 vertices (GPU)', () => {
    const box = lines({ shape: BOX }, OFFSET, SCALE);
    const expected = [
      [2, 0, -1],
      [-2, 0, -1],
      [2, 0, 1],
      [2, 0, -1],
      [-2, 0, 1],
      [2, 0, 1],
      [-2, 0, -1],
      [-2, 0, 1],
      [-2, 2, -1],
      [2, 2, -1],
      [2, 2, -1],
      [2, 2, 1],
      [2, 2, 1],
      [-2, 2, 1],
      [-2, 2, 1],
      [-2, 2, -1],
      [-2, 0, 1],
      [-2, 2, 1],
      [-2, 0, -1],
      [-2, 2, -1],
      [2, 0, -1],
      [2, 2, -1],
      [2, 0, 1],
      [2, 2, 1],
    ] as const;
    expected.forEach((vertex, index) => expectVertex(box, index, [...vertex]));
  });

  it('collapses onto the offset for extents of 0 (edge case)', () => {
    const box = lines({ shape: BOX, boxExtents: { x: 0, y: 0, z: 0 } }, OFFSET, NO_SCALE);
    expect(box.filter((_c, i) => i % 3 === 1).every((y) => y === 1)).toBe(true);
    expect(box.filter((_c, i) => i % 3 !== 1).every((c) => c === 0)).toBe(true);
  });
});

describe('emissionShapeLines: ring', () => {
  it('draws the default ring: four caps of 121 segments and five vertical lines each for outer and inner', () => {
    const ring = lines({ shape: RING });
    expect(vertexCount(ring)).toBe(988);
    expectVertex(ring, 0, [-1, 0, 0.5]);
    expectVertex(ring, 1, [-0.99863, -0.052336, 0.5]);
    expectVertex(ring, 2, [-1, 0, -0.5]);
    expectVertex(ring, 4, [0, 0, 0.5]);
    expectVertex(ring, 6, [0, 0, -0.5]);
  });

  it('draws the vertical lines at 0, 90, 180, 270 and 360 degrees after the caps', () => {
    const ring = lines({ shape: RING });
    expectVertex(ring, 968, [-1, 0, 0.5]);
    expectVertex(ring, 969, [-1, 0, -0.5]);
    expectVertex(ring, 970, [0, 0, 0.5]);
    expectVertex(ring, 971, [0, 0, -0.5]);
  });

  it('draws the ring of unit-cpu-particles-3d.tscn: axis Y, height 2, radius 1.5, inner 0.5, cone 45', () => {
    const ring = lines({
      shape: RING,
      ringAxis: { x: 0, y: 1, z: 0 },
      ringHeight: 2,
      ringRadius: 1.5,
      ringInnerRadius: 0.5,
      ringConeAngle: 45,
    });
    expectVertex(ring, 0, [0, 1, 0]);
    expectVertex(ring, 2, [0, -1, 1.5]);
    expectVertex(ring, 3, [0.078504, -1, 1.497944]);
    expectVertex(ring, 6, [0, -1, 0.5]);
    expectVertex(ring, 7, [0.026168, -1, 0.499315]);
    expectVertex(ring, 969, [0, -1, 1.5]);
  });

  it('turns a tilted axis through a basis built from its normal (axis (1, 2, 3), cone 60)', () => {
    const ring = lines({
      shape: RING,
      ringAxis: { x: 1, y: 2, z: 3 },
      ringHeight: 2,
      ringRadius: 1.5,
      ringInnerRadius: 0.5,
      ringConeAngle: 60,
    });
    expectVertex(ring, 0, [0.067903, 0.335164, 1.001143]);
    expectVertex(ring, 2, [-1.133286, -1.400548, 0.064242]);
    expectVertex(ring, 987, [-0.555936, -0.823198, -0.513109]);
  });

  it('scales and offsets the ring (GPU)', () => {
    const ring = lines(
      {
        shape: RING,
        ringAxis: { x: 0, y: 1, z: 0 },
        ringHeight: 2,
        ringRadius: 1.5,
        ringInnerRadius: 0.5,
        ringConeAngle: 45,
      },
      OFFSET,
      SCALE
    );
    expectVertex(ring, 0, [0, 2, 0]);
    expectVertex(ring, 2, [0, 0, 1.5]);
    expectVertex(ring, 3, [0.157008, 0, 1.497944]);
  });

  it('widens the top of a ring with a negative height, with no guard (edge case)', () => {
    const ring = lines({
      shape: RING,
      ringAxis: { x: 0, y: 1, z: 0 },
      ringHeight: -2,
      ringInnerRadius: 0.25,
      ringConeAngle: 45,
    });
    expectVertex(ring, 0, [0, -1, 3]);
    expectVertex(ring, 2, [0, 1, 1]);
    expectVertex(ring, 4, [0, -1, 0.75]);
  });

  it('draws every vertex at the offset for a zero axis, whose basis cannot be inverted (edge case)', () => {
    const ring = lines({ shape: RING, ringAxis: { x: 0, y: 0, z: 0 } });
    expect(vertexCount(ring)).toBe(988);
    expect(ring.every((c) => c === 0)).toBe(true);
  });

  it('keeps the rounding noise of an axis whose start vector is parallel to it, as float arithmetic leaves it (axis (1, 1, -1), edge case)', () => {
    const ring = lines({ shape: RING, ringAxis: { x: 1, y: 1, z: -1 } });
    expectVertex(ring, 0, [-0.288675, -0.288675, 0]);
    expectVertex(ring, 2, [-0.866025, -0.866025, 0]);
    expectVertex(ring, 4, [0.288675, 0.288675, 0]);
  });

  it('builds a ring of radius 0 without throwing, and leaves NaN in the inner top cap (edge case)', () => {
    const ring = lines({ shape: RING, ringRadius: 0 });
    expect(vertexCount(ring)).toBe(988);
    expectVertex(ring, 0, [0, 0, 0.5]);
    expect(ring.slice(12, 18).every(Number.isNaN)).toBe(true);
  });
});
