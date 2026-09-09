/**
 * The particle buffer: how a slot starts out, and how the live ones are read
 * back out as a pose.
 *
 * Part of the CPUParticles2D port; the derivation notice is in `simulate.ts`.
 */

import { affineInverse, IDENTITY_AFFINE, multiplyAffine } from './affine2d';
import type { Particle, RenderedParticle, SimState } from './simTypes';
import { CPUParticles2DDrawOrder, type CPUParticles2DProperties } from './types';

export function newParticle(): Particle {
  return {
    transform: { ...IDENTITY_AFFINE },
    color: { r: 1, g: 1, b: 1, a: 1 },
    custom: [0, 0, 0, 0],
    rotation: 0,
    velocity: { x: 0, y: 0 },
    active: false,
    angleRand: 0,
    scaleRand: 0,
    hueRotRand: 0,
    animOffsetRand: 0,
    startColorRand: { r: 1, g: 1, b: 1, a: 1 },
    time: 0,
    lifetime: 0,
    baseColor: { r: 1, g: 1, b: 1, a: 1 },
    seed: 0,
  };
}

/**
 * `_update_particle_data_buffer` — collect the live particles in draw order,
 * mapped back into the emitter node's local space.
 */
export function collectPose(
  state: SimState,
  props: CPUParticles2DProperties
): RenderedParticle[] {
  const inverse = affineInverse(state.emissionXform);

  const order = state.particles.map((_, index) => index);
  if (props.draw_order === CPUParticles2DDrawOrder.Lifetime) {
    // SortLifetime compares `time > time`, i.e. oldest first.
    order.sort((a, b) => state.particles[b]!.time - state.particles[a]!.time);
  }

  const pose: RenderedParticle[] = [];
  for (const index of order) {
    const p = state.particles[index]!;
    // Godot zeroes an inactive particle's transform, collapsing its quad to a
    // point; omitting it draws the same nothing for a fraction of the vertices.
    if (!p.active) continue;
    pose.push({
      transform: multiplyAffine(inverse, p.transform),
      color: p.color,
      anim: p.custom[2],
      age: p.time,
      index,
    });
  }
  return pose;
}
