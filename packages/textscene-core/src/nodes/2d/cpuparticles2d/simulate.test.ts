import { describe, expect, it } from 'vitest';
import { heading } from '../../../parser/testing/parserKit';
import { parseCPUParticles2D } from './parser';
import {
  IDENTITY_AFFINE,
  MAX_SIM_STEPS,
  evaluationWindow,
  simulateFrozenPose,
  type ParticleSimInput,
} from './simulate';
import { CPUParticles2DParam, type CPUParticles2DProperties } from './types';
import type { Gradient } from '../../../resources/textures/gradienttexture2d/types';
import { GradientInterpolationMode } from '../../../resources/textures/gradienttexture2d/types';
import { CurveTangentMode, type Curve } from '../../../resources/curves/curve/types';

const NO_CURVES: Array<Curve | null> = Array.from({ length: 12 }, () => null);

function props(overrides: Record<string, string> = {}): CPUParticles2DProperties {
  return parseCPUParticles2D(heading('CPUParticles2D', { name: 'P' }), {
    use_fixed_seed: 'true',
    seed: '4242',
    fixed_fps: '30',
    preprocess: '1.0',
    ...overrides,
  });
}

function input(overrides: Partial<ParticleSimInput> = {}): ParticleSimInput {
  return {
    props: props(),
    curves: NO_CURVES,
    colorRamp: null,
    colorInitialRamp: null,
    emissionTransform: IDENTITY_AFFINE,
    ...overrides,
  };
}

describe('evaluationWindow', () => {
  it('uses the authored preprocess at Godot’s own 1x rate (happy path)', () => {
    expect(evaluationWindow(props({ preprocess: '2.5', speed_scale: '3.0' }))).toEqual({
      seconds: 2.5,
      speedScale: 1,
    });
  });

  it('substitutes one lifetime, at the node’s speed_scale, when no preprocess is set', () => {
    expect(evaluationWindow(props({ preprocess: '0', lifetime: '0.8', speed_scale: '2' }))).toEqual({
      seconds: 0.8,
      speedScale: 2,
    });
  });

  it('substitutes half a lifetime for a one_shot burst so it is caught mid-flight', () => {
    expect(evaluationWindow(props({ preprocess: '0', lifetime: '0.4', one_shot: 'true' }))).toEqual({
      seconds: 0.2,
      speedScale: 1,
    });
  });

  it('never returns a non-positive window for a degenerate lifetime (edge case)', () => {
    const window = evaluationWindow(props({ preprocess: '0', lifetime: '0' }));
    expect(window.seconds).toBeGreaterThan(0);
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
    // Godot randomises the seed on construction; our substitute is a constant,
    // so the two spellings must agree or a scene's look would depend on whether
    // it happened to write `use_fixed_seed`.
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
      expect(Math.hypot(particle.transform.ox, particle.transform.oy)).toBeLessThanOrEqual(10.001);
    }
    // A filled disc puts SOME particles well inside; a surface ring would not.
    expect(pose.some((p) => Math.hypot(p.transform.ox, p.transform.oy) < 7)).toBe(true);
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
      expect(Math.hypot(particle.transform.ox, particle.transform.oy)).toBeLessThanOrEqual(10.001);
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
      expect(Math.abs(particle.transform.ox)).toBeLessThanOrEqual(20.001);
      expect(Math.abs(particle.transform.oy)).toBeLessThanOrEqual(5.001);
    }
  });

  it('places Rectangle particles where Godot 4.6.3 actually puts them', () => {
    // Measured, not derived. `pnpm ref:godot` on
    // scenes/fixtures/unit-cpuparticles2d-emission-shapes.tscn renders its
    // Rectangle emitter (seed 11, extents 80x30) with particle 0 at
    // (+44.5, +9.3) from the node origin. That is only reproducible if the two
    // `rng->randf()` arguments of Godot's single `Vector2(…)` constructor are
    // drawn RIGHT to LEFT, which C++ permits and the shipped builds do.
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
    expect(first.transform.ox).toBeCloseTo(45.2, 1);
    expect(first.transform.oy).toBeCloseTo(9.5, 1);
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
      expect(particle.transform.ox).toBeCloseTo(0, 6);
      expect(particle.transform.oy).toBeCloseTo(0, 6);
    }
  });

  it('pulls particles along gravity', () => {
    const falling = simulateFrozenPose(
      input({ props: props({ amount: '8', gravity: 'Vector2(0, 400)', explosiveness: '1' }) })
    );
    const rising = simulateFrozenPose(
      input({ props: props({ amount: '8', gravity: 'Vector2(0, -400)', explosiveness: '1' }) })
    );
    const meanY = (pose: typeof falling) =>
      pose.reduce((sum, p) => sum + p.transform.oy, 0) / pose.length;
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
      expect(particle.transform.ox).toBeGreaterThan(0);
      expect(particle.transform.oy).toBeCloseTo(0, 6);
    }
  });

  it('scales the quad by `scale_amount`', () => {
    const pose = simulateFrozenPose(
      input({ props: props({ amount: '4', scale_amount_min: '3', scale_amount_max: '3' }) })
    );
    for (const particle of pose) {
      expect(Math.hypot(particle.transform.ax, particle.transform.ay)).toBeCloseTo(3, 5);
      expect(Math.hypot(particle.transform.bx, particle.transform.by)).toBeCloseTo(3, 5);
    }
  });

  it('shapes `scale_amount` over the particle’s age through its Curve', () => {
    const shrinking: Curve = {
      points: [
        {
          position: { x: 0, y: 1 },
          leftTangent: 0,
          rightTangent: 0,
          leftMode: CurveTangentMode.Free,
          rightMode: CurveTangentMode.Free,
        },
        {
          position: { x: 1, y: 0 },
          leftTangent: 0,
          rightTangent: 0,
          leftMode: CurveTangentMode.Free,
          rightMode: CurveTangentMode.Free,
        },
      ],
      minValue: 0,
      maxValue: 1,
      minDomain: 0,
      maxDomain: 1,
    };
    const curves = NO_CURVES.slice();
    curves[CPUParticles2DParam.Scale] = shrinking;

    const pose = simulateFrozenPose(
      input({ props: props({ amount: '24', lifetime: '1' }), curves })
    );
    // A steady-state emitter holds particles at every age, so the curve must
    // produce a RANGE of quad sizes rather than one.
    const sizes = pose.map((p) => Math.hypot(p.transform.ax, p.transform.ay));
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeGreaterThan(0.2);
  });

  it('samples `color_ramp` over the particle’s age', () => {
    const ramp: Gradient = {
      stops: [
        { offset: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
        { offset: 1, color: { r: 0, g: 0, b: 1, a: 1 } },
      ],
      interpolationMode: GradientInterpolationMode.Linear,
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
      // Godot runs the hue-rotation matrix unconditionally, and at zero hue
      // variation that matrix is only NEARLY the identity: its third row is
      // (-0.300, -0.588, 0.886) + (0.299, 0.587, 0.114), i.e. (-0.001, -0.001, 1).
      // So a blue channel of 1 costs the red and green channels 0.001 each. This
      // 0.1% bleed is the engine's, and reproducing it is the point.
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
      // Y column points along +X (the velocity); X column is its orthogonal.
      expect(particle.transform.bx).toBeCloseTo(1, 4);
      expect(particle.transform.by).toBeCloseTo(0, 4);
    }
  });

  it('undoes the emitter transform when `local_coords` is false', () => {
    // A doubled emitter scale must NOT double the particle quads: Godot draws a
    // global-coords emitter with an identity canvas transform.
    const emissionTransform = { ax: 2, ay: 0, bx: 0, by: 2, ox: 0, oy: 0 };
    const global = simulateFrozenPose(
      input({ props: props({ amount: '4', local_coords: 'false' }), emissionTransform })
    );
    for (const particle of global) {
      expect(Math.hypot(particle.transform.ax, particle.transform.ay)).toBeCloseTo(0.5, 5);
    }
  });

  it('leaves the quad in node space when `local_coords` is true', () => {
    const emissionTransform = { ax: 2, ay: 0, bx: 0, by: 2, ox: 0, oy: 0 };
    const local = simulateFrozenPose(
      input({ props: props({ amount: '4', local_coords: 'true' }), emissionTransform })
    );
    for (const particle of local) {
      expect(Math.hypot(particle.transform.ax, particle.transform.ay)).toBeCloseTo(1, 5);
    }
  });

  it('caps the step loop so an absurd preprocess cannot hang the previewer (edge case)', () => {
    const pose = simulateFrozenPose(
      input({ props: props({ amount: '2', preprocess: '100000', fixed_fps: '30' }) })
    );
    expect(pose.length).toBeGreaterThanOrEqual(0);
    expect(MAX_SIM_STEPS).toBeGreaterThan(100);
  });

  it('survives a degenerate emitter transform without producing NaN (error path)', () => {
    const singular = { ax: 0, ay: 0, bx: 0, by: 0, ox: 5, oy: 5 };
    const pose = simulateFrozenPose(
      input({ props: props({ amount: '4' }), emissionTransform: singular })
    );
    for (const particle of pose) {
      expect(Number.isFinite(particle.transform.ox)).toBe(true);
      expect(Number.isFinite(particle.transform.ax)).toBe(true);
    }
  });
});
