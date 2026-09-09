/**
 * The death branch of `CPUParticles2D::_particles_process`, at the boundary
 * where its comparison decides the frame.
 *
 * Part of the CPUParticles2D port; the derivation notice is in `simulate.ts`.
 */

import { describe, expect, it } from 'vitest';
import { heading } from '../../../parser/testing/parserKit';
import { IDENTITY_AFFINE } from './affine2d';
import { GodotRandomPCG } from './godotRng';
import { newParticle } from './particleBuffer';
import { parseCPUParticles2D } from './parser';
import { particlesProcess } from './particlesProcess';
import type { ParticleSimInput, SimState } from './simTypes';
import type { Curve } from '../../../resources/curves/curve/types';

const NO_CURVES: Array<Curve | null> = Array.from({ length: 12 }, () => null);

function input(overrides: Record<string, string> = {}): ParticleSimInput {
  return {
    props: parseCPUParticles2D(heading('CPUParticles2D', { name: 'P' }), {
      amount: '1',
      lifetime: '1.0',
      ...overrides,
    }),
    curves: NO_CURVES,
    colorRamp: null,
    colorInitialRamp: null,
    emissionTransform: IDENTITY_AFFINE,
  };
}

/**
 * One live particle at `age`, with the emitter mid-cycle so the restart window
 * (particle 0's birth phase, i.e. `time` 0) is behind `state.time` and the step
 * reaches the death branch rather than a respawn.
 */
function stateAt(age: number, particleLifetime: number): SimState {
  const particle = newParticle();
  particle.active = true;
  particle.time = age;
  particle.lifetime = particleLifetime;
  return {
    time: 0.5,
    cycle: 0,
    emitting: true,
    particles: [particle],
    lifetime: 1.0,
    seed: 0,
    rng: new GodotRandomPCG(0),
    emissionXform: IDENTITY_AFFINE,
  };
}

describe('particlesProcess — the frame a particle dies on', () => {
  /**
   * `cpu_particles_2d.cpp:971` is `p.time > p.lifetime`, so a particle whose age
   * has reached its lifetime EXACTLY is still alive and still drawn. `>=` kills
   * it a frame early and pins `tv` to 1.0, moving both the quad and the end of
   * every curve and ramp sampled from it.
   *
   * Reachable whenever `fixed_fps` divides the lifetime exactly — `p.time`
   * accumulates the step as a binary fraction and lands on the boundary.
   */
  it('keeps a particle whose age has only reached its lifetime', () => {
    const state = stateAt(1.0, 1.0);

    particlesProcess(state, input(), 1 / 4);

    expect(state.particles[0]?.active).toBe(true);
  });

  // The branch still fires past the boundary. Explosiveness is what opens that
  // window: the restart test above it scales `p.time` by `1 - explosiveness`,
  // so an over-age particle reaches the death branch instead of respawning.
  it('kills a particle whose age has passed its lifetime', () => {
    const state = stateAt(1.5, 1.0);

    particlesProcess(state, input({ explosiveness: '0.5' }), 1 / 4);

    expect(state.particles[0]?.active).toBe(false);
  });
});
