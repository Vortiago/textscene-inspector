/**
 * What every draw of a particle emitter's instances shares: the colour attribute and the draw a
 * material reads (`material.cpp:1260-1351`). The vertex stage itself is `godotParticlesProgram.ts`,
 * and the billboard every instanced draw shares is `surfaceBillboard.ts`.
 */

import {
  surfaceBillboard,
  type StandardMaterialBag,
  type SurfaceBillboard,
} from '../../resources/materials/standardmaterial3d/materialBag';
import {
  PARTICLES_ANIM_DEFAULTS,
  type ParticlesAnim,
  type StandardMaterial3DScalars,
} from '../../resources/materials/standardmaterial3d/types';

/** The instanced attribute that holds each particle's colour, the buffer's floats 12 to 15. */
export const PARTICLE_COLOR_ATTRIBUTE = 'particleColor';

/** How a material draws the instances of a particle emitter. */
export interface ParticleDraw {
  billboard: SurfaceBillboard;
  /** The flipbook, which only BILLBOARD_PARTICLES cuts. */
  anim: ParticlesAnim;
}

/**
 * The program patch that colours and billboards a particle emitter's instances
 * (`godotParticlesProgram.ts`). The particle draw hands it to its slots, so the shader text loads
 * with the draw's own chunk, off the initial-paint path.
 */
export type ParticleProgram = (bag: StandardMaterialBag, draw: ParticleDraw) => StandardMaterialBag;

/** The particle draw of `scalars`, or Godot's default surface for none. */
export function particleDrawOf(scalars: StandardMaterial3DScalars | null): ParticleDraw {
  return { billboard: surfaceBillboard(scalars), anim: scalars?.particlesAnim ?? PARTICLES_ANIM_DEFAULTS };
}
