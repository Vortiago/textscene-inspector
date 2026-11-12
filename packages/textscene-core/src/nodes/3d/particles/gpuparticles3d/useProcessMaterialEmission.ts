/** The emission of the ParticleProcessMaterial a GPUParticles3D holds. */

import { PARTICLE_PROCESS_MATERIAL } from '../../../../resources/materials/particleprocessmaterial';
import type { ParticleEmission } from '../../../../resources/materials/particleprocessmaterial/types';
import { useNodeResource } from '../../../../resources/reading';

/**
 * The emission of the material `reference` names, or null for none, for a reference still loading or
 * unreadable, and for any other material type: a ShaderMaterial draws no emission shape
 * (`particles_3d_emission_shape_gizmo_plugin.cpp:88-89`).
 */
export function useProcessMaterialEmission(reference: string | undefined): ParticleEmission | null {
  return useNodeResource(reference, PARTICLE_PROCESS_MATERIAL).value;
}
