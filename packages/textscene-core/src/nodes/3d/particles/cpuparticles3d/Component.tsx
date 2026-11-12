/**
 * <CPUParticles3D> draws Godot's CPU particle emitter as a frozen pose (`ParticleEmitter.tsx`), with
 * its box and emission-shape gizmos.
 */

import { useRef } from 'react';
import type * as THREE from 'three';
import { EMPTY_AABB } from '../../../../godot/math/aabb';
import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { PluginGizmo, SelectedOnly } from '../../../../r3f/gizmo/PluginGizmo';
import { FramePoint } from '../../../../r3f/components/NodeAabb';
import { useLazyModule } from '../../../../resources/useLazyModule';
import { Node3D } from '../../../base/node3d/Component';
import { useEmissionTransform } from '../../../shared/particles3d/useEmissionTransform';
import { CPUParticlesBoxGizmo, EmissionShapeGizmo } from '../gizmo/ParticleGizmos';
import { loadParticleEmitter } from './emitterModule';
import type { CPUParticles3DProperties } from './types';

export function CPUParticles3D({ node, children }: NodeComponentProps) {
  const properties = node.properties as CPUParticles3DProperties;
  const nodeRef = useRef<THREE.Group | null>(null);
  const emitter = useLazyModule(loadParticleEmitter);
  const emissionTransform = useEmissionTransform(nodeRef, node);

  return (
    <Node3D node={node} ref={nodeRef}>
      {/* `get_aabb()` is `AABB()` (`cpu_particles_3d.cpp:43-45`), whatever the instance's box is. */}
      <FramePoint />
      {emitter && emissionTransform && (
        <emitter.ParticleEmitter
          properties={properties}
          nodeRef={nodeRef}
          emissionTransform={emissionTransform}
        />
      )}
      <PluginGizmo drawnFor="every-node">
        {/* The box the node authors, `AABB()` for none, and not the parser's null (the multimesh box). */}
        <CPUParticlesBoxGizmo box={properties.visibilityAabb ?? EMPTY_AABB} />
        <SelectedOnly>
          <EmissionShapeGizmo emission={properties.emission} />
        </SelectedOnly>
      </PluginGizmo>
      {children}
    </Node3D>
  );
}
