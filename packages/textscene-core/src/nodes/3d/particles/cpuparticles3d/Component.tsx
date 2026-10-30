/**
 * <CPUParticles3D> draws Godot's CPU particle emitter as a frozen pose (`ParticleEmitter.tsx`), with
 * its box and emission-shape gizmos.
 */

import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type * as THREE from 'three';
import { EMPTY_AABB } from '../../../../godot/math/aabb';
import { sameTransform3D, type Transform3D } from '../../../../godot/math/transform3d';
import type { TscnNode } from '../../../../parser/types';
import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { PluginGizmo, SelectedOnly } from '../../../../r3f/gizmo/PluginGizmo';
import { realGlobalTransform3D } from '../../../../r3f/nodeTreeTransforms';
import { useLazyModule } from '../../../../resources/useLazyModule';
import { Node3D } from '../../../base/node3d/Component';
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

/**
 * The emitter's global transform: a `local_coords = false` emitter emits from it, and a VIEW_DEPTH
 * emitter sorts through its inverse. three holds the ancestors, so it is sampled again for each
 * parse of the node, and changes identity only when it changes. Null until the first sample, so the emitter
 * settles once on mount, from the transform it draws under.
 */
function useEmissionTransform(
  nodeRef: RefObject<THREE.Object3D | null>,
  parsed: TscnNode
): Transform3D | null {
  const [transform, setTransform] = useState<Transform3D | null>(null);
  useLayoutEffect(() => {
    const node = nodeRef.current;
    if (!node) return;
    // A layout pass runs before the renderer's own `updateMatrixWorld`, so the ancestors refresh.
    node.updateWorldMatrix(true, false);
    const next = realGlobalTransform3D(node);
    setTransform((previous) => (previous && sameTransform3D(previous, next) ? previous : next));
  }, [nodeRef, parsed]);
  return transform;
}
