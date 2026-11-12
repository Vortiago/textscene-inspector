import { describe, expect, it } from 'vitest';
import { identityTransform3D, transform3DOf } from '../../../godot/math/transform3d';
import { GpuDrawOrder, GpuTransformAlign } from '../../../godot/scene/particles3d';
import { PARTICLE_FLOATS } from '../particles3d/particleBuffer';
import { copyInstances, type InstanceCopy } from './instanceCopy';
import type { SettledGpuParticles } from './settle';

interface HandParticle {
  origin?: [number, number, number];
  /** The columns of the basis; the identity when unset. */
  columns?: [number, number, number][];
  velocity?: [number, number, number];
}

/** Settled particles with the given index, in the order given. Particle `n` is born at `origin` and numbered `n` in its custom angle. */
function settled(particles: HandParticle[], phase = 0, indices?: number[]): SettledGpuParticles {
  const buffer = new Float32Array(particles.length * PARTICLE_FLOATS);
  const velocity = new Float32Array(particles.length * 3);
  particles.forEach(({ origin = [0, 0, 0], columns, velocity: v = [0, 0, 0] }, row) => {
    const [x, y, z] = columns ?? [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
    const at = row * PARTICLE_FLOATS;
    buffer.set([x![0]!, y![0]!, z![0]!, origin[0]], at);
    buffer.set([x![1]!, y![1]!, z![1]!, origin[1]], at + 4);
    buffer.set([x![2]!, y![2]!, z![2]!, origin[2]], at + 8);
    buffer[at + 16] = indices ? indices[row]! : row;
    velocity.set(v, row * 3);
  });
  return { buffer, velocity, indices: Int32Array.from(indices ?? particles.map((_, row) => row)), phase };
}

const FRONT_VIEW = { axis: { x: 0, y: 0, z: 1 }, up: { x: 0, y: 1, z: 0 } };

function request(overrides: Partial<InstanceCopy>): InstanceCopy {
  return {
    amount: 8,
    drawOrder: GpuDrawOrder.INDEX,
    transformAlign: GpuTransformAlign.DISABLED,
    localCoords: false,
    emissionTransform: identityTransform3D(),
    view: FRONT_VIEW,
    ...overrides,
  };
}

/** The index of each drawn particle, in draw order. */
function drawnIndices(buffer: Float32Array): number[] {
  return Array.from(
    { length: buffer.length / PARTICLE_FLOATS },
    (_, row) => buffer[row * PARTICLE_FLOATS + 16]!
  );
}

/** Column `column` of particle `row`'s basis. */
function columnOf(buffer: Float32Array, row: number, column: number): number[] {
  const at = row * PARTICLE_FLOATS + column;
  return [buffer[at]!, buffer[at + 4]!, buffer[at + 8]!];
}

function expectVector(actual: number[], expected: number[]): void {
  expected.forEach((value, axis) => expect(actual[axis]).toBeCloseTo(value, 5));
}

const EIGHT = Array.from({ length: 8 }, () => ({}));

describe('copyInstances by lifetime', () => {
  it.each([
    ['LIFETIME at phase 0', GpuDrawOrder.LIFETIME, 0, [1, 2, 3, 4, 5, 6, 7, 0]],
    ['LIFETIME at phase 0.3', GpuDrawOrder.LIFETIME, 0.3, [3, 4, 5, 6, 7, 0, 1, 2]],
    [
      'LIFETIME at phase 0.999, which wraps the split to 0',
      GpuDrawOrder.LIFETIME,
      0.999,
      [0, 1, 2, 3, 4, 5, 6, 7],
    ],
    ['REVERSE_LIFETIME at phase 0', GpuDrawOrder.REVERSE_LIFETIME, 0, [0, 7, 6, 5, 4, 3, 2, 1]],
    ['REVERSE_LIFETIME at phase 0.3', GpuDrawOrder.REVERSE_LIFETIME, 0.3, [2, 1, 0, 7, 6, 5, 4, 3]],
  ])('draws %s oldest first as the copy shader reads the slots', (_name, drawOrder, phase, expected) => {
    expect(drawnIndices(copyInstances(settled(EIGHT, phase), request({ drawOrder })))).toEqual(expected);
  });

  it('draws the one particle of an amount of 1', () => {
    const one = copyInstances(settled([{}], 0.5), request({ amount: 1, drawOrder: GpuDrawOrder.LIFETIME }));
    expect(drawnIndices(one)).toEqual([0]);
  });

  it('orders only the live particles when others have not been born', () => {
    const live = settled([{}, {}, {}], 0.3, [1, 4, 6]);
    expect(drawnIndices(copyInstances(live, request({ drawOrder: GpuDrawOrder.LIFETIME })))).toEqual([
      4, 6, 1,
    ]);
  });
});

describe('copyInstances by view depth', () => {
  const ALONG_Z = [{ origin: [0, 0, 2] }, { origin: [0, 0, -1] }, { origin: [0, 0, 1] }] as HandParticle[];

  it('draws the far particle first, ascending along the view axis', () => {
    const copied = copyInstances(settled(ALONG_Z), request({ drawOrder: GpuDrawOrder.VIEW_DEPTH }));
    expect(drawnIndices(copied)).toEqual([1, 2, 0]);
  });

  it('keeps the index order of particles at one depth', () => {
    const level = [{ origin: [1, 0, 0] }, { origin: [-1, 0, 0] }, { origin: [0, 5, 0] }] as HandParticle[];
    const copied = copyInstances(settled(level), request({ drawOrder: GpuDrawOrder.VIEW_DEPTH }));
    expect(drawnIndices(copied)).toEqual([0, 1, 2]);
  });

  it('sorts in node space for local coordinates, through the turned node', () => {
    // The node turns 90° about Y, so world +Z is the node's -X, and a non-local sort would tie.
    const turned = transform3DOf([0, 0, 1, 0, 1, 0, -1, 0, 0], { x: 0, y: 0, z: 0 });
    const alongX = [{ origin: [-1, 0, 0] }, { origin: [2, 0, 0] }] as HandParticle[];
    const copied = copyInstances(
      settled(alongX),
      request({ drawOrder: GpuDrawOrder.VIEW_DEPTH, localCoords: true, emissionTransform: turned })
    );
    expect(drawnIndices(copied)).toEqual([1, 0]);
  });

  it('keeps the index order when the camera is not known yet', () => {
    const copied = copyInstances(
      settled(ALONG_Z),
      request({ drawOrder: GpuDrawOrder.VIEW_DEPTH, view: null })
    );
    expect(drawnIndices(copied)).toEqual([0, 1, 2]);
  });
});

describe('copyInstances alignment', () => {
  // A camera turned 90° about Y: it looks along world -X, so its +Z axis is world +X and its up stays +Y.
  const SIDE_VIEW = { axis: { x: 1, y: 0, z: 0 }, up: { x: 0, y: 1, z: 0 } };
  const align = (transformAlign: number, particle: HandParticle, overrides: Partial<InstanceCopy> = {}) =>
    copyInstances(settled([particle]), request({ transformAlign, ...overrides }));

  it('keeps the basis for DISABLED', () => {
    const copied = align(GpuTransformAlign.DISABLED, {
      columns: [
        [2, 0, 0],
        [0, 3, 0],
        [0, 0, 4],
      ],
    });
    expect(columnOf(copied, 0, 1)).toEqual([0, 3, 0]);
  });

  it('turns the basis to face the camera for Z_BILLBOARD', () => {
    const copied = align(GpuTransformAlign.Z_BILLBOARD, {}, { view: SIDE_VIEW });
    expectVector(columnOf(copied, 0, 0), [0, 0, -1]);
    expectVector(columnOf(copied, 0, 1), [0, 1, 0]);
    expectVector(columnOf(copied, 0, 2), [1, 0, 0]);
  });

  it('keeps the scale of the basis for Z_BILLBOARD', () => {
    const copied = align(GpuTransformAlign.Z_BILLBOARD, {
      columns: [
        [2, 0, 0],
        [0, 3, 0],
        [0, 0, 4],
      ],
    });
    expectVector(columnOf(copied, 0, 0), [2, 0, 0]);
    expectVector(columnOf(copied, 0, 2), [0, 0, 4]);
  });

  it('points Y along the velocity for Y_TO_VELOCITY', () => {
    const copied = align(GpuTransformAlign.Y_TO_VELOCITY, { velocity: [3, 0, 0] });
    expectVector(columnOf(copied, 0, 1), [1, 0, 0]);
    expectVector(columnOf(copied, 0, 0), [0, -1, 0]);
    expectVector(columnOf(copied, 0, 2), [0, 0, 1]);
  });

  it('keeps Y for a particle at rest under Y_TO_VELOCITY', () => {
    const copied = align(GpuTransformAlign.Y_TO_VELOCITY, { velocity: [0, 0, 0] });
    expectVector(columnOf(copied, 0, 1), [0, 1, 0]);
    expectVector(columnOf(copied, 0, 0), [1, 0, 0]);
  });

  it('gives each Y_TO_VELOCITY axis the mean scale of the basis', () => {
    const copied = align(GpuTransformAlign.Y_TO_VELOCITY, {
      columns: [
        [1, 0, 0],
        [0, 2, 0],
        [0, 0, 3],
      ],
      velocity: [0, 5, 0],
    });
    for (const column of [0, 1, 2]) {
      expect(Math.hypot(...(columnOf(copied, 0, column) as [number, number, number]))).toBeCloseTo(2, 5);
    }
  });

  it('points Y along the velocity on screen for Z_BILLBOARD_Y_TO_VELOCITY', () => {
    const copied = align(
      GpuTransformAlign.Z_BILLBOARD_Y_TO_VELOCITY,
      { velocity: [7, 0, 0] },
      { view: SIDE_VIEW }
    );
    // The velocity runs along the view axis, so no screen velocity is left and Y falls back to up.
    expectVector(columnOf(copied, 0, 1), [0, 1, 0]);
    expectVector(columnOf(copied, 0, 2), [1, 0, 0]);
  });

  it('removes the part of the velocity along the view axis for Z_BILLBOARD_Y_TO_VELOCITY', () => {
    const copied = align(GpuTransformAlign.Z_BILLBOARD_Y_TO_VELOCITY, { velocity: [4, 0, 2] });
    expectVector(columnOf(copied, 0, 1), [1, 0, 0]);
    expectVector(columnOf(copied, 0, 2), [0, 0, 1]);
  });

  it('turns a world-space particle in the world, then writes it back in the turned node', () => {
    const turned = transform3DOf([0, 0, 1, 0, 1, 0, -1, 0, 0], { x: 0, y: 0, z: 0 });
    // The node-space columns that are the world identity.
    const worldIdentity: [number, number, number][] = [
      [0, 0, 1],
      [0, 1, 0],
      [-1, 0, 0],
    ];
    const copied = align(
      GpuTransformAlign.Z_BILLBOARD,
      { columns: worldIdentity },
      { emissionTransform: turned, view: SIDE_VIEW }
    );
    // The world basis turns to (0,0,-1), (0,1,0), (1,0,0), which the node sees as (1,0,0), (0,1,0), (0,0,1).
    expectVector(columnOf(copied, 0, 0), [1, 0, 0]);
    expectVector(columnOf(copied, 0, 2), [0, 0, 1]);
  });

  it('keeps the basis while the camera is not known yet', () => {
    const copied = align(
      GpuTransformAlign.Z_BILLBOARD,
      {
        columns: [
          [2, 0, 0],
          [0, 2, 0],
          [0, 0, 2],
        ],
      },
      { view: null }
    );
    expect(columnOf(copied, 0, 0)).toEqual([2, 0, 0]);
  });
});

describe('copyInstances with nothing to copy', () => {
  it('hands back the settled buffer for INDEX and DISABLED', () => {
    const particles = settled(EIGHT);
    expect(copyInstances(particles, request({}))).toBe(particles.buffer);
  });
});
