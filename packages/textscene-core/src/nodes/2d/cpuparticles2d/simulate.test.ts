import { describe, expect, it } from 'vitest';
import { heading } from '../../../parser/testing/parserKit';
import { parseCPUParticles2D } from './parser';
import { simulateFrozenPose, type ParticleSimInput } from './simulate';
import { type CPUParticles2DProperties } from './types';
import { TRANSFORM2D_IDENTITY, transform2DFromParts } from '../../../godot/math/transform2d.js';
import type { Gradient } from '../../../resources/textures/gradienttexture2d/types';
import { DEFAULT_BAKE_RESOLUTION, type Curve } from '../../../resources/curves/curve/types';
import { CPUParticlesParameter } from '../../../godot/scene/cpuParticles';
import { GradientInterpolationMode } from '../../../godot/scene/gradientTexture';
import { CurveTangentMode } from '../../../godot/scene/curve';

const NO_CURVES: (Curve | null)[] = Array.from({ length: 12 }, () => null);

function props(overrides: Record<string, string> = {}): CPUParticles2DProperties {
  return parseCPUParticles2D(heading('CPUParticles2D', { name: 'P' }), {
    use_fixed_seed: 'true',
    seed: '4242',
    fixed_fps: '30',
    preprocess: '0.95',
    ...overrides,
  });
}

function input(overrides: Partial<ParticleSimInput> = {}): ParticleSimInput {
  return {
    props: props(),
    curves: NO_CURVES,
    colorRamp: null,
    colorInitialRamp: null,
    emissionTransform: TRANSFORM2D_IDENTITY,
    ...overrides,
  };
}

/** The age, in seconds, of a lone particle born on the first settle step. */
function loneParticleAge(overrides: Record<string, string>): number {
  const pose = simulateFrozenPose(input({ props: props({ amount: '1', ...overrides }) }));
  return pose[0]!.age;
}

describe('the settle window', () => {
  it('spends the authored preprocess (happy path)', () => {
    // 2.51 s at 1/30 s is 76 whole frames, and the particle born on the first is 75 frames old.
    expect(loneParticleAge({ lifetime: '10', preprocess: '2.51', speed_scale: '3.0' })).toBeCloseTo(2.5, 9);
  });

  it('spends half a lifetime for a one_shot burst so it is caught mid-flight', () => {
    const substituted = simulateFrozenPose(
      input({ props: props({ preprocess: '0', lifetime: '0.4', one_shot: 'true' }) })
    );
    const half = simulateFrozenPose(
      input({ props: props({ preprocess: '0.2', lifetime: '0.4', one_shot: 'true' }) })
    );
    const later = simulateFrozenPose(
      input({ props: props({ preprocess: '0.3', lifetime: '0.4', one_shot: 'true' }) })
    );
    expect(substituted).toEqual(half);
    expect(substituted).not.toEqual(later);
  });

  it('spends a positive window for a degenerate lifetime (edge case)', () => {
    expect(
      simulateFrozenPose(input({ props: props({ preprocess: '0', lifetime: '0' }) })).length
    ).toBeGreaterThan(0);
  });

  it('stops after 4096 steps so an absurd preprocess cannot hang the previewer (edge case)', () => {
    expect(loneParticleAge({ lifetime: '1000', preprocess: '100000' })).toBeCloseTo(4095 / 30, 6);
  });
});

// Godot's `local_delta` is `p_delta` unless a restart branch shortens it
// (`cpu_particles_2d.cpp:829-852`). Eight steps of 1/8 s over a 0.9375 s cycle wrap
// on the last step: `prev_time` 0.875, `time` 0.0625. Particle i restarts at
// i × 0.05859375 and spawns at the origin moving at 120 px/s, so `tx` is 120 × its motion.
describe('a restart on the step that wraps the cycle', () => {
  const wrapProps = {
    amount: '16',
    lifetime: '0.9375',
    fixed_fps: '8',
    preprocess: '1.0',
    direction: 'Vector2(1, 0)',
    spread: '0',
    initial_velocity_min: '120',
    initial_velocity_max: '120',
    gravity: 'Vector2(0, 0)',
  };

  function txOf(overrides: Record<string, string>, index: number): number {
    const pose = simulateFrozenPose(input({ props: props({ ...wrapProps, ...overrides }) }));
    return pose.find((p) => p.index === index)!.transform.tx;
  }

  it('gives a restart at the tail of the cycle the slice to the boundary plus time (:839-844)', () => {
    expect(txOf({}, 15)).toBeCloseTo(120 * (0.9375 - 0.87890625 + 0.0625), 9);
  });

  it('gives a restart just after zero the slice since its instant (:845-850)', () => {
    expect(txOf({}, 1)).toBeCloseTo(120 * (0.0625 - 0.05859375), 9);
  });

  it('advances a particle that does not restart by the whole step', () => {
    // Particle 8 restarts at 0.46875, inside step 4, and then advances four whole steps.
    expect(txOf({}, 8)).toBeCloseTo(120 * (0.5 - 0.46875 + 4 * 0.125), 9);
  });

  it('gives every wrapped restart the whole step with fract_delta disabled (:842,848)', () => {
    expect(txOf({ fract_delta: 'false' }, 15)).toBeCloseTo(120 * 0.125, 9);
    expect(txOf({ fract_delta: 'false' }, 1)).toBeCloseTo(120 * 0.125, 9);
  });
});

describe('a particle past its own lifetime (cpu_particles_2d.cpp:971)', () => {
  // Under full explosiveness every particle restarts only at the cycle start, so one whose
  // randomised lifetime ends first leaves the pose before the cycle wraps.
  const burst = { amount: '32', explosiveness: '1', lifetime: '1', preprocess: '0.9' };

  it('keeps every particle alive while each lifetime spans the cycle', () => {
    expect(simulateFrozenPose(input({ props: props(burst) }))).toHaveLength(32);
  });

  it('drops the particles whose randomised lifetime has passed', () => {
    const pose = simulateFrozenPose(input({ props: props({ ...burst, lifetime_randomness: '0.9' }) }));
    expect(pose.length).toBeGreaterThan(0);
    expect(pose.length).toBeLessThan(32);
  });

  it('advances a particle exactly at its lifetime one more step before it expires', () => {
    // Seed 4242's lifetime draw is 0.5929864645004272, so this randomness halves the lifetime
    // to exactly 0.5 s. Six steps of 1/8 s check it at age 0.5 and leave it at 0.625.
    const atLifetime = { ...burst, amount: '1', fixed_fps: '8', preprocess: '0.75' };
    const pose = simulateFrozenPose(
      input({ props: props({ ...atLifetime, lifetime_randomness: '0.8431895665969956' }) })
    );
    expect(pose.map((p) => p.age)).toEqual([0.625]);
  });
});

// Godot integrates `p.transform[2] += p.velocity * local_delta` for every
// particle, restart included (`cpu_particles_2d.cpp:1151`). With `fract_delta`
// (default on, `cpu_particles_2d.h:138`) a mid-frame restart gets only the
// remainder of the frame, which spreads same-step births into a solid bar.
describe('a restarting particle’s partial first step (comb vs. bar)', () => {
  // Particle i restarts at i/100. At the first step (time = 1/30) only i=0..3
  // restart, each with local_delta = time - i/100, and a restarting particle
  // spawns at the origin, so tx is exactly `120 * local_delta`.
  const streamProps = {
    amount: '100',
    lifetime: '1.0',
    fixed_fps: '30',
    preprocess: '0.01', // < 1/30, so the settle loop runs exactly one step
    direction: 'Vector2(1, 0)',
    spread: '0',
    initial_velocity_min: '120',
    initial_velocity_max: '120',
    gravity: 'Vector2(0, 0)',
  };

  it('spreads the newest particles across the frame (fract_delta default true — a solid bar)', () => {
    const pose = simulateFrozenPose(input({ props: props(streamProps) }));
    const txOf = (index: number) => pose.find((p) => p.index === index)!.transform.tx;

    expect(txOf(0)).toBeCloseTo(4.0, 6);
    expect(txOf(1)).toBeCloseTo(2.8, 6);
    expect(txOf(2)).toBeCloseTo(1.6, 6);
    expect(txOf(3)).toBeCloseTo(0.4, 6);
    // Every y stays 0: direction is pure +X and spread is 0.
    for (const index of [0, 1, 2, 3]) {
      expect(pose.find((p) => p.index === index)!.transform.ty).toBeCloseTo(0, 6);
    }
  });

  it('bunches the newest particles at one position with fract_delta disabled (the comb)', () => {
    const pose = simulateFrozenPose(input({ props: props({ ...streamProps, fract_delta: 'false' }) }));
    const txOf = (index: number) => pose.find((p) => p.index === index)!.transform.tx;

    // Every particle that restarted this step gets the whole frame's motion, so
    // all land at the same displacement.
    expect(txOf(0)).toBeCloseTo(4.0, 6);
    expect(txOf(1)).toBeCloseTo(4.0, 6);
    expect(txOf(2)).toBeCloseTo(4.0, 6);
    expect(txOf(3)).toBeCloseTo(4.0, 6);
  });
});

describe('the substituted window is one of Godot’s own settles', () => {
  // `_update_internal` spends a requested advance and an authored `preprocess`
  // through one loop, with `speed_scale` forced to 1 (`cpu_particles_2d.cpp:727-738`).
  // Measured: a fixture without its `preprocess` line, rendered with
  // `pnpm ref:godot … --particles <that preprocess>`, is byte-identical.
  it('matches the pose the same emitter would settle to with `preprocess = lifetime`', () => {
    const substituted = simulateFrozenPose(input({ props: props({ preprocess: '0', lifetime: '0.95' }) }));
    const authored = simulateFrozenPose(input({ props: props({ preprocess: '0.95', lifetime: '0.95' }) }));
    expect(substituted).toEqual(authored);
    expect(substituted.length).toBeGreaterThan(0);
  });

  it('ignores speed_scale, because Godot’s settle forces it to 1', () => {
    const fast = simulateFrozenPose(input({ props: props({ preprocess: '0', speed_scale: '3' }) }));
    const plain = simulateFrozenPose(input({ props: props({ preprocess: '0', speed_scale: '1' }) }));
    expect(fast).toEqual(plain);
    expect(plain.length).toBeGreaterThan(0);
  });

  it('runs whole frames, so a window that is not a multiple of the step overshoots', () => {
    // At `fixed_fps = 30`, 0.95 s and 0.96 s are both spent as 29 whole frames
    // and land on one pose, 0.9667 s in. A shortened last step would separate
    // them. 0.9 s is 27 frames and must not land there, or any two inputs pass.
    const substituted = simulateFrozenPose(input({ props: props({ preprocess: '0', lifetime: '0.95' }) }));
    const sameBucket = simulateFrozenPose(input({ props: props({ preprocess: '0.96', lifetime: '0.95' }) }));
    const earlier = simulateFrozenPose(input({ props: props({ preprocess: '0.9', lifetime: '0.95' }) }));
    expect(substituted).toEqual(sameBucket);
    expect(substituted).not.toEqual(earlier);
  });
});

describe('simulateFrozenPose', () => {
  it('renders nothing at all when `emitting = false` (Godot cpu_particles_2d.cpp:717-728)', () => {
    expect(simulateFrozenPose(input({ props: props({ emitting: 'false' }) }))).toEqual([]);
  });

  it('renders nothing when `emitting = false` even with a long preprocess and many particles', () => {
    const pose = simulateFrozenPose(
      input({ props: props({ emitting: 'false', amount: '64', preprocess: '5.0' }) })
    );
    expect(pose).toEqual([]);
  });

  it('fills a continuous emitter with live particles (happy path)', () => {
    const pose = simulateFrozenPose(input({ props: props({ amount: '16' }) }));
    expect(pose.length).toBeGreaterThan(0);
    expect(pose.length).toBeLessThanOrEqual(16);
  });

  it('is byte-stable across runs for the same input', () => {
    const first = simulateFrozenPose(input({ props: props({ amount: '12' }) }));
    const second = simulateFrozenPose(input({ props: props({ amount: '12' }) }));
    expect(second).toEqual(first);
  });

  it('produces the same pose without `use_fixed_seed` as with the fixed preview seed', () => {
    // Godot randomises the seed on construction, and the substitute is a
    // constant, so the two spellings must agree.
    const authored = simulateFrozenPose(
      input({ props: props({ use_fixed_seed: 'false', seed: '999', amount: '10' }) })
    );
    const different = simulateFrozenPose(
      input({ props: props({ use_fixed_seed: 'false', seed: '1', amount: '10' }) })
    );
    expect(different).toEqual(authored);
  });

  it('changes the pose when the fixed seed changes', () => {
    // Something random must actually be in play: at Godot's defaults every
    // parameter range is degenerate (min === max) and the draws cancel out.
    const random = { amount: '10', spread: '180', initial_velocity_min: '10', initial_velocity_max: '100' };
    const a = simulateFrozenPose(input({ props: props({ ...random, seed: '1' }) }));
    const b = simulateFrozenPose(input({ props: props({ ...random, seed: '2' }) }));
    expect(a).not.toEqual(b);
  });

  it('leaves the pose alone when the seed changes but no parameter is random', () => {
    // Every default range is min === max, so the RNG stream has nothing to vary.
    const a = simulateFrozenPose(input({ props: props({ seed: '1', amount: '10' }) }));
    const b = simulateFrozenPose(input({ props: props({ seed: '2', amount: '10' }) }));
    expect(a).toEqual(b);
  });

  it('spreads a Sphere emission inside its radius (emission shapes)', () => {
    const pose = simulateFrozenPose(
      input({
        props: props({
          amount: '48',
          emission_shape: '1',
          emission_sphere_radius: '10',
          gravity: 'Vector2(0, 0)',
          preprocess: '0.033',
        }),
      })
    );
    expect(pose.length).toBeGreaterThan(0);
    for (const particle of pose) {
      expect(Math.hypot(particle.transform.tx, particle.transform.ty)).toBeLessThanOrEqual(10.001);
    }
    // A filled disc puts some particles well inside, and a surface ring would not.
    expect(pose.some((p) => Math.hypot(p.transform.tx, p.transform.ty) < 7)).toBe(true);
  });

  it('places a SphereSurface emission on a shell, never at the centre', () => {
    const pose = simulateFrozenPose(
      input({
        props: props({
          amount: '48',
          emission_shape: '2',
          emission_sphere_radius: '10',
          gravity: 'Vector2(0, 0)',
          preprocess: '0.033',
        }),
      })
    );
    for (const particle of pose) {
      expect(Math.hypot(particle.transform.tx, particle.transform.ty)).toBeLessThanOrEqual(10.001);
    }
  });

  it('confines a Rectangle emission to its extents', () => {
    const pose = simulateFrozenPose(
      input({
        props: props({
          amount: '48',
          emission_shape: '3',
          emission_rect_extents: 'Vector2(20, 5)',
          gravity: 'Vector2(0, 0)',
          preprocess: '0.033',
        }),
      })
    );
    expect(pose.length).toBeGreaterThan(0);
    for (const particle of pose) {
      expect(Math.abs(particle.transform.tx)).toBeLessThanOrEqual(20.001);
      expect(Math.abs(particle.transform.ty)).toBeLessThanOrEqual(5.001);
    }
  });

  it('places Rectangle particles where Godot 4.6.3 actually puts them', () => {
    // Measured with `pnpm ref:godot` on unit-cpuparticles2d-emission-shapes.tscn:
    // the Rectangle emitter (seed 11, extents 80x30) puts particle 0 at
    // (+44.5, +9.3). Only a right-to-left draw of the two `rng->randf()`
    // arguments of Godot's one `Vector2(…)` call reproduces it.
    const pose = simulateFrozenPose(
      input({
        props: props({
          amount: '64',
          seed: '11',
          lifetime: '1.0',
          preprocess: '0.0334',
          emission_shape: '3',
          emission_rect_extents: 'Vector2(80, 30)',
          gravity: 'Vector2(0, 0)',
        }),
      })
    );
    expect(pose.length).toBeGreaterThan(0);
    const first = pose.find((p) => p.index === 0)!;
    expect(first.transform.tx).toBeCloseTo(45.2, 1);
    expect(first.transform.ty).toBeCloseTo(9.5, 1);
  });

  it('keeps a Point emission at the origin on its birth frame', () => {
    const pose = simulateFrozenPose(
      input({
        props: props({
          amount: '8',
          explosiveness: '1',
          gravity: 'Vector2(0, 0)',
          preprocess: '0.0334',
        }),
      })
    );
    for (const particle of pose) {
      expect(particle.transform.tx).toBeCloseTo(0, 6);
      expect(particle.transform.ty).toBeCloseTo(0, 6);
    }
  });

  it('pulls particles along gravity', () => {
    const falling = simulateFrozenPose(
      input({ props: props({ amount: '8', gravity: 'Vector2(0, 400)', explosiveness: '1' }) })
    );
    const rising = simulateFrozenPose(
      input({ props: props({ amount: '8', gravity: 'Vector2(0, -400)', explosiveness: '1' }) })
    );
    const meanY = (pose: typeof falling) => pose.reduce((sum, p) => sum + p.transform.ty, 0) / pose.length;
    expect(meanY(falling)).toBeGreaterThan(0);
    expect(meanY(rising)).toBeLessThan(0);
  });

  it('sends particles along `direction` when `spread` is zero', () => {
    const pose = simulateFrozenPose(
      input({
        props: props({
          amount: '8',
          spread: '0',
          direction: 'Vector2(1, 0)',
          initial_velocity_min: '100',
          initial_velocity_max: '100',
          gravity: 'Vector2(0, 0)',
          explosiveness: '1',
        }),
      })
    );
    for (const particle of pose) {
      expect(particle.transform.tx).toBeGreaterThan(0);
      expect(particle.transform.ty).toBeCloseTo(0, 6);
    }
  });

  it('scales the quad by `scale_amount`', () => {
    const pose = simulateFrozenPose(
      input({ props: props({ amount: '4', scale_amount_min: '3', scale_amount_max: '3' }) })
    );
    for (const particle of pose) {
      expect(Math.hypot(particle.transform.a, particle.transform.b)).toBeCloseTo(3, 5);
      expect(Math.hypot(particle.transform.c, particle.transform.d)).toBeCloseTo(3, 5);
    }
  });

  it('shapes `scale_amount` over the particle’s age through its Curve', () => {
    const shrinking: Curve = {
      points: [
        {
          position: { x: 0, y: 1 },
          leftTangent: 0,
          rightTangent: 0,
          leftMode: CurveTangentMode.FREE,
          rightMode: CurveTangentMode.FREE,
        },
        {
          position: { x: 1, y: 0 },
          leftTangent: 0,
          rightTangent: 0,
          leftMode: CurveTangentMode.FREE,
          rightMode: CurveTangentMode.FREE,
        },
      ],
      minValue: 0,
      maxValue: 1,
      minDomain: 0,
      maxDomain: 1,
      bakeResolution: DEFAULT_BAKE_RESOLUTION,
    };
    const curves = NO_CURVES.slice();
    curves[CPUParticlesParameter.SCALE] = shrinking;

    const pose = simulateFrozenPose(input({ props: props({ amount: '24', lifetime: '1' }), curves }));
    // A steady-state emitter holds particles at every age, so the curve must
    // give a range of quad sizes.
    const sizes = pose.map((p) => Math.hypot(p.transform.a, p.transform.b));
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeGreaterThan(0.2);
  });

  it('samples `color_ramp` over the particle’s age', () => {
    const ramp: Gradient = {
      stops: [
        { offset: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
        { offset: 1, color: { r: 0, g: 0, b: 1, a: 1 } },
      ],
      interpolationMode: GradientInterpolationMode.LINEAR,
    };
    const pose = simulateFrozenPose(input({ props: props({ amount: '24' }), colorRamp: ramp }));
    const reds = pose.map((p) => p.color.r);
    expect(Math.max(...reds)).toBeGreaterThan(0.6);
    expect(Math.min(...reds)).toBeLessThan(0.4);
    for (const particle of pose) {
      expect(particle.color.r + particle.color.b).toBeCloseTo(1, 2);
    }
  });

  it('multiplies the flat `color` into every particle, hue quirk and all', () => {
    const pose = simulateFrozenPose(
      input({ props: props({ amount: '6', color: 'Color(0.5, 0.25, 1, 0.5)' }) })
    );
    expect(pose.length).toBeGreaterThan(0);
    for (const particle of pose) {
      // Godot always runs the hue-rotation matrix, and at zero variation its third
      // row is (-0.300, -0.588, 0.886) + (0.299, 0.587, 0.114), that is
      // (-0.001, -0.001, 1). A blue channel of 1 costs red and green 0.001 each,
      // the engine's own bleed.
      expect(particle.color.r).toBeCloseTo(0.5 - 0.001, 6);
      expect(particle.color.g).toBeCloseTo(0.25 - 0.001, 6);
      expect(particle.color.b).toBeCloseTo(1, 6);
      expect(particle.color.a).toBeCloseTo(0.5, 6);
    }
  });

  it('draws oldest-first under draw_order = Lifetime', () => {
    const base = { amount: '24', draw_order: '1' };
    const pose = simulateFrozenPose(input({ props: props(base) }));
    for (let i = 1; i < pose.length; i++) {
      expect(pose[i - 1]!.age).toBeGreaterThanOrEqual(pose[i]!.age);
    }
  });

  it('keeps index order under draw_order = Index', () => {
    const pose = simulateFrozenPose(input({ props: props({ amount: '24', draw_order: '0' }) }));
    for (let i = 1; i < pose.length; i++) {
      expect(pose[i - 1]!.index).toBeLessThan(pose[i]!.index);
    }
  });

  it('orients the quad along velocity under `particle_flag_align_y`', () => {
    const pose = simulateFrozenPose(
      input({
        props: props({
          amount: '8',
          particle_flag_align_y: 'true',
          spread: '0',
          direction: 'Vector2(1, 0)',
          initial_velocity_min: '100',
          initial_velocity_max: '100',
          gravity: 'Vector2(0, 0)',
          explosiveness: '1',
        }),
      })
    );
    for (const particle of pose) {
      // Y column points along +X (the velocity). X column is its orthogonal.
      expect(particle.transform.c).toBeCloseTo(1, 4);
      expect(particle.transform.d).toBeCloseTo(0, 4);
    }
  });

  it('undoes the emitter transform when `local_coords` is false', () => {
    // A doubled emitter scale must not double the particle quads: Godot draws a
    // global-coords emitter with an identity canvas transform.
    const emissionTransform = { a: 2, b: 0, c: 0, d: 2, tx: 0, ty: 0 };
    const global = simulateFrozenPose(
      input({ props: props({ amount: '4', local_coords: 'false' }), emissionTransform })
    );
    for (const particle of global) {
      expect(Math.hypot(particle.transform.a, particle.transform.b)).toBeCloseTo(0.5, 5);
    }
  });

  it('settles a global-coords emitter to the same bits, through the shared product', () => {
    // The pose this emitter gives with `multiplyTransform2D` and the inverse in their current
    // order of operations. A reordered sum moves the last bits of every particle.
    const emissionTransform = transform2DFromParts(0.7, { x: 2, y: 0.5 }, 0.3, { x: 13.5, y: -7.25 });
    const pose = simulateFrozenPose(
      input({ props: props({ amount: '12', local_coords: 'false' }), emissionTransform })
    );
    expect(pose.find((particle) => particle.index === 0)!.transform).toEqual({
      a: 0.28278115199109793,
      b: -1.3486717917104292,
      c: 0.4404055504977479,
      d: 1.6011995689278613,
      tx: 194.69840048004875,
      ty: 707.8725383166859,
    });
  });

  it('leaves the quad in node space when `local_coords` is true', () => {
    const emissionTransform = { a: 2, b: 0, c: 0, d: 2, tx: 0, ty: 0 };
    const local = simulateFrozenPose(
      input({ props: props({ amount: '4', local_coords: 'true' }), emissionTransform })
    );
    for (const particle of local) {
      expect(Math.hypot(particle.transform.a, particle.transform.b)).toBeCloseTo(1, 5);
    }
  });

  it('survives a degenerate emitter transform without producing NaN (error path)', () => {
    const singular = { a: 0, b: 0, c: 0, d: 0, tx: 5, ty: 5 };
    const pose = simulateFrozenPose(input({ props: props({ amount: '4' }), emissionTransform: singular }));
    for (const particle of pose) {
      expect(Number.isFinite(particle.transform.tx)).toBe(true);
      expect(Number.isFinite(particle.transform.a)).toBe(true);
    }
  });
});
