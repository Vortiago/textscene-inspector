import { describe, expect, it } from 'vitest';
import { transform3DOf } from '../../../godot/math/transform3d';
import { PARTICLE_FLOATS } from '../particles3d/particleBuffer';
import { BASE_MATERIAL, originOf, requestInput, settle } from './gpuparticles.testkit';
import { gpuSettleSeconds, settleFor, settleFrameDeltas } from './settle';

/** Godot 4.6.3 `capture_aabb()` of one-particle emitters, to the 1e-5 the brief of #1157 gives. */
function expectOrigin(actual: readonly number[], expected: readonly number[]): void {
  expected.forEach((value, axis) => expect(Math.abs(actual[axis]! - value)).toBeLessThan(1e-5));
}

describe('settleGpuParticles at the measured positions', () => {
  it.each([
    [0, [1.455826, 0.687942, -0.099241]],
    [1, [-0.511006, 0.943711, 0.126788]],
    [2, [-1.266381, 0.268109, -1.333548]],
    [12345, [-1.241663, 1.284223, -1.15771]],
  ])('puts the point emitter of seed %i where Godot does', (seed, expected) => {
    expectOrigin(originOf(settle({ seed }).buffer), expected!);
  });

  it('steps at fixed_fps 24 (a different frame time)', () => {
    expectOrigin(originOf(settle({ fixedFps: 24 }).buffer), [1.465936, 0.672581, -0.09993]);
  });

  it.each([
    ['fixed_fps 0, which steps at 1/30', { fixedFps: 0 }],
    ['speed_scale 2, which never moves the pose', { speedScale: 2 }],
  ])('keeps the pose for %s', (_name, emitter) => {
    expectOrigin(originOf(settle(emitter).buffer), [1.455826, 0.687942, -0.099241]);
  });

  it('draws one particle for one live particle', () => {
    expect(settle({}).buffer.length).toBe(PARTICLE_FLOATS);
  });
});

describe('settleGpuParticles in the coordinates of the emitter', () => {
  const turnedAboutZ = transform3DOf([0, -1, 0, 1, 0, 0, 0, 0, 1], { x: 1, y: 0, z: 0 });

  it('keeps the world-space particle in node space, as capture_aabb reports it', () => {
    expectOrigin(
      originOf(settle({ localCoords: false }, BASE_MATERIAL, turnedAboutZ).buffer),
      [-0.024174, 2.167943, -0.099241]
    );
  });

  it('keeps the local-coordinate particle as the unturned node holds it', () => {
    expectOrigin(
      originOf(settle({ localCoords: true }, BASE_MATERIAL, turnedAboutZ).buffer),
      [1.455826, 0.687942, -0.099241]
    );
  });
});

describe('settleGpuParticles over the emission shapes', () => {
  /** No gravity and no speed, so that the pose is where the shape put the particle. */
  const AT_BIRTH = { gravity: 'Vector3(0, 0, 0)', initial_velocity_min: '0', initial_velocity_max: '0' };
  const BRIEF = { emitter: { amount: 1, preprocess: 0.0001 } };

  it.each([
    ['a sphere', 7, { emission_shape: '1', emission_sphere_radius: '1' }, [-0.208726, 0.865506, 0.146535]],
    [
      'a sphere surface',
      9,
      { emission_shape: '2', emission_sphere_radius: '1.5' },
      [-0.4613, -0.000419, 1.427306],
    ],
    [
      'a box',
      3,
      { emission_shape: '3', emission_box_extents: 'Vector3(1, 2, 3)' },
      [0.687037, -1.948424, 2.264546],
    ],
    [
      'a ring',
      5,
      {
        emission_shape: '6',
        emission_ring_radius: '2',
        emission_ring_inner_radius: '1',
        emission_ring_height: '0.5',
      },
      [1.40405, -0.188809, 0.215934],
    ],
  ])('places a particle born in %s where Godot does', (_name, seed, shape, expected) => {
    const settled = settle({ ...BRIEF.emitter, seed }, { ...AT_BIRTH, ...shape });
    expectOrigin(originOf(settled.buffer), expected);
  });

  it('spreads a sphere particle in every direction (spread 180)', () => {
    const material = {
      spread: '180',
      initial_velocity_min: '1',
      initial_velocity_max: '1',
      gravity: 'Vector3(0, 0, 0)',
      emission_shape: '1',
      emission_sphere_radius: '1',
    };
    expectOrigin(
      originOf(settle({ seed: 7, preprocess: 0.5 }, material).buffer),
      [-0.619718, 0.693142, -0.146418]
    );
  });
});

describe('settleGpuParticles over the life of an emitter', () => {
  const BURST = { amount: 4, explosiveness: 1, oneShot: true, preprocess: 0.5 };

  it('draws a one-shot burst inside the box Godot measures', () => {
    const { buffer } = settle(BURST);
    const origins = Array.from({ length: buffer.length / PARTICLE_FLOATS }, (_, i) => originOf(buffer, i));
    const lows = [0, 1, 2].map((axis) => Math.min(...origins.map((o) => o[axis]!)));
    const highs = [0, 1, 2].map((axis) => Math.max(...origins.map((o) => o[axis]!)));
    expectOrigin(lows, [-0.562836, 0.440523, -0.592688]);
    expectOrigin(
      highs.map((high, axis) => high - lows[axis]!),
      [1.268911, 0.33446, 1.037505]
    );
  });

  it('draws nothing for a one-shot emitter settled past its lifetime', () => {
    expect(settle({ ...BURST, preprocess: 2.5 }).buffer.length).toBe(0);
  });

  it('draws nothing for an emitter that is not emitting', () => {
    expect(settle({ emitting: false }).buffer.length).toBe(0);
  });

  it('kills the particles whose draw is above amount_ratio', () => {
    expect(settle({ amount: 8, amountRatio: 0 }).buffer.length).toBe(0);
  });

  it('settles an unseeded emitter with the preview seed', () => {
    expect(settle({ useFixedSeed: false, seed: 99 }).buffer).toEqual(settle({ seed: 0 }).buffer);
  });

  it('settles at one lifetime for a preprocess of 0, and at half of it for a one-shot emitter', () => {
    const emitter = { preprocess: 0, lifetime: 2, oneShot: false, fixedFps: 30, speedScale: 1 };
    expect(gpuSettleSeconds({ ...emitter } as never)).toBe(2);
    expect(gpuSettleSeconds({ ...emitter, oneShot: true } as never)).toBe(1);
  });

  it('rounds the seconds that stand for --particles to a float, which takes one more step', () => {
    const frameTime = 1 / 30;
    expect(settleFrameDeltas(1.2, frameTime)).toHaveLength(36);
    expect(settleFrameDeltas(Math.fround(1.2), frameTime)).toHaveLength(37);
  });

  it('puts the particle one step further on for the float seconds (request_particles_process)', () => {
    const atFloat = originOf(settleFor(requestInput(), Math.fround(1.2)).buffer);
    expectOrigin(atFloat, [1.496266, 0.665941, -0.101997]);
  });
});
