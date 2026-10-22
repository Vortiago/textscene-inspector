/** The emission of the ParticleProcessMaterial a GPUParticles3D holds. */

import { useMemo } from 'react';
import { useSceneResources } from '../../../../r3f/SceneResourcesContext';
import { decodeParticleProcessMaterial } from '../emission/processMaterial';
import type { ParticleEmission } from '../emission/types';
import { useResourceResolution } from '../../../../resources/useSubOrExtResource';

/**
 * The emission of the material `reference` names, or null for none, for a reference still loading or
 * unreadable, and for any other material type: a ShaderMaterial draws no emission shape
 * (`particles_3d_emission_shape_gizmo_plugin.cpp:88-89`).
 */
export function useProcessMaterial(reference: string | undefined): ParticleEmission | null {
  const { scoped } = useResourceResolution(reference, useSceneResources());
  const resource = scoped?.resource;
  return useMemo(
    () =>
      resource?.type === 'ParticleProcessMaterial' ? decodeParticleProcessMaterial(resource.data) : null,
    [resource]
  );
}
