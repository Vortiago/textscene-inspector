/**
 * `CPUParticles2D::_particles_process` — one simulation step over the whole
 * buffer: who restarts, who dies, who integrates.
 *
 * Part of the CPUParticles2D port; the derivation notice is in `simulate.ts`.
 */

import { basisXform, multiplyAffine, type Affine2D } from './affine2d';
import { idhash } from './godotRng';
import { advanceParticle } from './particleAdvance';
import { applyAppearance } from './particleAppearance';
import { restartParticle } from './particleRestart';
import type { ParticleSimInput, SimState } from './simTypes';

/** `CPUParticles2D::_particles_process`. `delta` already carries `speed_scale`. */
export function particlesProcess(
  state: SimState,
  input: ParticleSimInput,
  delta: number
): void {
  const { props } = input;
  const { lifetime } = state;
  const pcount = state.particles.length;

  const prevTime = state.time;
  state.time += delta;
  if (state.time > lifetime) {
    state.time = state.time % lifetime;
    state.cycle++;
    if (props.one_shot && state.cycle > 0) state.emitting = false;
  }

  // A global-coords emitter spawns in world space; `velocity_xform` is the same
  // transform with its translation dropped, since a velocity is a direction.
  const emissionXform = state.emissionXform;
  const velocityXform: Affine2D = { ...emissionXform, ox: 0, oy: 0 };

  const systemPhase = state.time / lifetime;

  for (let i = 0; i < pcount; i++) {
    const p = state.particles[i]!;
    if (!state.emitting && !p.active) continue;

    const localDelta = delta;

    // The birth phase is the particle's slot in the stream: particle i is born
    // i/pcount of the way through each cycle, which is what makes a continuous
    // emitter show every age at once.
    let restartPhase = i / pcount;

    if (props.randomness > 0) {
      let hashSeed = state.cycle >>> 0;
      if (restartPhase >= systemPhase) hashSeed = (hashSeed - 1) >>> 0;
      hashSeed = Math.imul(hashSeed, pcount) >>> 0;
      hashSeed = (hashSeed + i) >>> 0;
      const random = (idhash(hashSeed) % 65536) / 65536.0;
      restartPhase += (props.randomness * random * 1.0) / pcount;
    }

    // Explosiveness squeezes every birth phase toward 0, so at 1 the whole
    // emitter fires at once.
    restartPhase *= 1.0 - props.explosiveness;
    const restartTime = restartPhase * lifetime;
    let restart = false;

    if (state.time > prevTime) {
      if (restartTime >= prevTime && restartTime < state.time) restart = true;
    } else if (localDelta > 0.0) {
      if (restartTime >= prevTime) restart = true;
      else if (restartTime < state.time) restart = true;
    }

    if (p.time * (1.0 - props.explosiveness) > p.lifetime) restart = true;

    let tv = 0.0;

    if (restart) {
      if (!state.emitting) {
        p.active = false;
        continue;
      }
      restartParticle(state, input, p, i, tv);
      if (!props.local_coords) {
        p.velocity = basisXform(velocityXform, p.velocity);
        p.transform = multiplyAffine(emissionXform, p.transform);
      }
    } else if (!p.active) {
      continue;
    } else if (p.time >= p.lifetime) {
      p.active = false;
      tv = 1.0;
    } else {
      tv = advanceParticle(state, input, p, localDelta);
    }

    applyAppearance(input, p, tv);

    // Godot integrates position AFTER the appearance pass, and does it on the
    // restart frame too, so a newborn particle is already one step along.
    p.transform.ox += p.velocity.x * localDelta;
    p.transform.oy += p.velocity.y * localDelta;
  }
}
