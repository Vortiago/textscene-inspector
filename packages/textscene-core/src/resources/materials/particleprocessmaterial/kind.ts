/**
 * The ParticleProcessMaterial a GPUParticles3D holds, read through the resource module (ADR-0071):
 * its emission for the gizmo and its simulation inputs for the particles. No THREE and no React.
 */

import type { ResourceKind } from '../../reading';
import { decodeParticleProcessMaterial } from './decode';
import { decodeProcessSimulation, type ProcessSimulation } from './simulation';
import type { ParticleEmission } from './types';

export interface ProcessMaterial {
  emission: ParticleEmission;
  simulation: ProcessSimulation;
}

/** A ShaderMaterial is another class, so it reads as `wrong-type`: it draws no particle and no emission shape. */
export const PARTICLE_PROCESS_MATERIAL: ResourceKind<ProcessMaterial> = {
  name: 'ParticleProcessMaterial',
  accepts: (type) => type === 'ParticleProcessMaterial',
  decode: ({ properties }) => ({
    emission: decodeParticleProcessMaterial(properties),
    simulation: decodeProcessSimulation(properties),
  }),
};
