/**
 * <CPUParticles3D> draws Godot's CPU particle emitter as a frozen pose: the settle of its enter-tree
 * (`simulate.ts`), each particle an instance of the mesh under the node's transform, as Godot writes
 * the buffer in node space (`cpu_particles_3d.cpp:1281-1283`). The cull measures the live particles.
 * Godot's editor gizmos draw on it: the `visibility_aabb` box with its axes for every node, and the
 * emission shape for the selected node.
 */

import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { EMPTY_AABB } from '../../../../godot/math/aabb';
import { sameTransform3D, type Transform3D } from '../../../../godot/math/transform3d';
import type { Vector3 } from '../../../../godot/math/vector';
import { CPUParticles3DDrawOrder } from '../../../../godot/scene/particles3d';
import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import type { TscnNode } from '../../../../parser/types';
import { useSceneResources } from '../../../../r3f/SceneResourcesContext';
import { PluginGizmo, SelectedOnly } from '../../../../r3f/gizmo/PluginGizmo';
import { realGlobalTransform3D } from '../../../../r3f/nodeTreeTransforms';
import { boxPlacement } from '../../../../r3f/visibilityRange/placements';
import { useGeometryInstance } from '../../../../r3f/visibilityRange/geometryInstance';
import { useLazyModule } from '../../../../resources/useLazyModule';
import { Node3D } from '../../../base/node3d/Component';
import { useMeshAabb } from '../../meshinstance3d/meshAabb';
import { useParticleResources } from '../../../shared/cpuparticles/useParticleResources';
import { CPUParticlesBoxGizmo, EmissionShapeGizmo } from '../gizmo/ParticleGizmos';
import { particlesAabb } from './ownAabb';
import { loadSimulate } from './simulateModule';
import { ParticleMesh } from './ParticleMesh';
import type { CPUParticles3DProperties } from './types';

export function CPUParticles3D({ node, children }: NodeComponentProps) {
  const properties = node.properties as CPUParticles3DProperties;
  const pools = useSceneResources();
  const nodeRef = useRef<THREE.Group | null>(null);

  const simulate = useLazyModule(loadSimulate);
  const emissionTransform = useEmissionTransform(nodeRef, node);
  const resources = useParticleResources(properties.simulation);
  const settled = useMemo(
    () =>
      simulate &&
      emissionTransform &&
      simulate.settleParticles({
        sim: properties.simulation,
        emission: properties.emission,
        ...resources,
        emissionTransform,
      }),
    [simulate, properties, resources, emissionTransform]
  );
  const viewAxis = useViewAxis(properties.simulation.drawOrder === CPUParticles3DDrawOrder.VIEW_DEPTH);
  const rows = useMemo(() => simulate && settled && simulate.particleRows(settled), [simulate, settled]);
  const buffer = useMemo(
    () => simulate && settled && rows && simulate.particlesInDrawOrder(settled, rows, viewAxis),
    [simulate, settled, rows, viewAxis]
  );

  const meshAabb = useMeshAabb(properties.mesh, pools);
  const ownAabb = useMemo(
    () => rows && particlesAabb(properties, rows, meshAabb),
    [properties, rows, meshAabb]
  );
  const placement = useMemo(() => boxPlacement(nodeRef, ownAabb), [ownAabb]);
  const shadow = useGeometryInstance(placement);

  return (
    <Node3D node={node} ref={nodeRef}>
      {settled && buffer && (
        <ParticleMesh properties={properties} settled={settled} buffer={buffer} shadow={shadow} />
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

/**
 * The axis a VIEW_DEPTH emitter sorts along: the global `basis.get_column(2)` of the camera that
 * renders (`cpu_particles_3d.cpp:1256-1258`), read each frame, and null for any other order. Godot
 * sorts each frame, so a moved camera sorts again.
 */
function useViewAxis(sortsByView: boolean): Vector3 | null {
  const [axis, setAxis] = useState<Vector3 | null>(null);
  useFrame(({ camera }) => {
    if (!sortsByView) return;
    const e = camera.matrixWorld.elements;
    if (axis && axis.x === e[8] && axis.y === e[9] && axis.z === e[10]) return;
    setAxis({ x: e[8]!, y: e[9]!, z: e[10]! });
  });
  return sortsByView ? axis : null;
}
