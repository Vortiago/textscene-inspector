/**
 * <GPUParticles3D> draws no particles, so the intent is `pending` and the badge reads "not
 * implemented". The GeometryInstance3D base still mounts (`undrawnGeometryInstance`), and while the
 * node is selected (ADR-0018) it carries Godot's editor gizmos: the `visibility_aabb` box and the
 * emission shape of the process material.
 */

import { undrawnGeometryInstanceWithGizmos } from '../../geometryinstance3d/Component';
import { EmissionShapeGizmo, ParticlesBoxGizmo } from '../gizmo/ParticleGizmos';
import { useGPUParticles3DAabb } from './ownAabb';
import type { GPUParticles3DProperties } from './types';
import { useProcessMaterialEmission } from './useProcessMaterialEmission';

function Gizmos({ properties }: { properties: GPUParticles3DProperties }) {
  const emission = useProcessMaterialEmission(properties.processMaterial);
  return (
    <>
      <ParticlesBoxGizmo box={properties.visibilityAabb} />
      {emission && <EmissionShapeGizmo emission={emission} />}
    </>
  );
}

export const GPUParticles3D = undrawnGeometryInstanceWithGizmos(useGPUParticles3DAabb, Gizmos);
