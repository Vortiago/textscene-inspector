/**
 * <GPUParticles3D> draws Godot's GPU particle emitter as a frozen pose (`ParticleEmitter.tsx`),
 * with its editor gizmos for the selected node only (`gpu_particles_3d_gizmo_plugin.cpp:64`): the
 * `visibility_aabb` box and the emission shape of its ParticleProcessMaterial.
 */

import { useMemo, useRef } from 'react';
import type * as THREE from 'three';
import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { FramePoint } from '../../../../r3f/components/NodeAabb';
import { PluginGizmo } from '../../../../r3f/gizmo/PluginGizmo';
import { boxPlacement } from '../../../../r3f/visibilityRange/placements';
import { useGeometryInstance } from '../../../../r3f/visibilityRange/geometryInstance';
import { PARTICLE_PROCESS_MATERIAL } from '../../../../resources/materials/particleprocessmaterial';
import { useNodeResource } from '../../../../resources/reading';
import { useLazyModule } from '../../../../resources/useLazyModule';
import { Node3D } from '../../../base/node3d/Component';
import { useEmissionTransform } from '../../../shared/particles3d/useEmissionTransform';
import { EmissionShapeGizmo, ParticlesBoxGizmo } from '../gizmo/ParticleGizmos';
import { loadParticleEmitter } from './emitterModule';
import type { GPUParticles3DProperties } from './types';

export function GPUParticles3D({ node, children }: NodeComponentProps) {
  const properties = node.properties as GPUParticles3DProperties;
  const nodeRef = useRef<THREE.Group | null>(null);
  const emitter = useLazyModule(loadParticleEmitter);
  const emissionTransform = useEmissionTransform(nodeRef, node);
  const { value: material } = useNodeResource(properties.processMaterial, PARTICLE_PROCESS_MATERIAL);
  // The instance culls by `visibility_aabb` (`particles_storage.cpp:691-696`).
  const placement = useMemo(
    () => boxPlacement(nodeRef, properties.visibilityAabb),
    [properties.visibilityAabb]
  );
  useGeometryInstance(placement);

  return (
    <Node3D node={node} ref={nodeRef}>
      {/* `get_aabb()` is `AABB()` (`gpu_particles_3d.cpp:40-42`), not the `visibility_aabb` it culls by. */}
      <FramePoint />
      {emitter && emissionTransform && material && (
        <emitter.ParticleEmitter
          properties={properties}
          material={material}
          emissionTransform={emissionTransform}
        />
      )}
      <PluginGizmo drawnFor="selected-only">
        <ParticlesBoxGizmo box={properties.visibilityAabb} />
        {material && <EmissionShapeGizmo emission={material.emission} />}
      </PluginGizmo>
      {children}
    </Node3D>
  );
}
