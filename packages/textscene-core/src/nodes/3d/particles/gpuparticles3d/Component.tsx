/**
 * <GPUParticles3D> draws no particles, so the intent is `pending` and the badge reads "not
 * implemented". The GeometryInstance3D base still mounts (`undrawnGeometryInstance`), and while the
 * node is selected (ADR-0018) it carries Godot's editor gizmos: the `visibility_aabb` box and the
 * emission shape of the process material.
 */

import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { useGizmoVisible } from '../../../../r3f/hooks/useGizmoVisible';
import { invisibleBase } from '../../../../r3f/invisibleBase';
import { undrawnGeometryInstance } from '../../geometryinstance3d/Component';
import { EmissionShapeGizmo, ParticlesBoxGizmo } from '../gizmo/ParticleGizmos';
import { useGPUParticles3DAabb } from './ownAabb';
import type { GPUParticles3DProperties } from './types';
import { useProcessMaterial } from './useProcessMaterial';

const UndrawnGPUParticles3D = undrawnGeometryInstance(useGPUParticles3DAabb);

function Gizmos({ properties }: { properties: GPUParticles3DProperties }) {
  const material = useProcessMaterial(properties.processMaterial);
  return (
    <>
      <ParticlesBoxGizmo box={properties.visibilityAabb} />
      {material && (
        <EmissionShapeGizmo
          emission={material.emission}
          offset={material.emissionShapeOffset}
          scale={material.emissionShapeScale}
        />
      )}
    </>
  );
}

export const GPUParticles3D = invisibleBase(function GPUParticles3D({ node, children }: NodeComponentProps) {
  const gizmoVisible = useGizmoVisible();
  return (
    <UndrawnGPUParticles3D node={node}>
      {gizmoVisible && <Gizmos properties={node.properties as GPUParticles3DProperties} />}
      {children}
    </UndrawnGPUParticles3D>
  );
});
