/**
 * <GPUParticles3D> draws no particles, so the intent is `pending` and the badge reads "not
 * implemented". The GeometryInstance3D base still mounts, with Godot's editor gizmos on it
 * (`undrawnGeometryInstanceWithGizmos`): the `visibility_aabb` box and the emission shape of the
 * process material, for the selected node only (`gpu_particles_3d_gizmo_plugin.cpp:64`).
 */

import {
  undrawnGeometryInstanceWithGizmos,
  type GeometryInstanceGizmosProps,
} from '../../geometryinstance3d/Component';
import { EmissionShapeGizmo, ParticlesBoxGizmo } from '../gizmo/ParticleGizmos';
import { useGPUParticles3DAabb } from './ownAabb';
import type { GPUParticles3DProperties } from './types';
import { useProcessMaterialEmission } from './useProcessMaterialEmission';

function Gizmos({ properties }: GeometryInstanceGizmosProps<GPUParticles3DProperties>) {
  const emission = useProcessMaterialEmission(properties.processMaterial);
  return (
    <>
      <ParticlesBoxGizmo box={properties.visibilityAabb} />
      {emission && <EmissionShapeGizmo emission={emission} />}
    </>
  );
}

export const GPUParticles3D = undrawnGeometryInstanceWithGizmos(
  useGPUParticles3DAabb,
  Gizmos,
  'selected-only'
);
