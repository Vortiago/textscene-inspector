/**
 * The particles of a CPUParticles3D: the settle of its enter-tree (`simulate.ts`), each particle an
 * instance of the mesh under the node's transform, as Godot writes the buffer in node space
 * (`cpu_particles_3d.cpp:1281-1283`). The cull measures the live particles.
 */

import { useMemo, type RefObject } from 'react';
import type * as THREE from 'three';
import type { Transform3D } from '../../../../godot/math/transform3d';
import { CPUParticles3DDrawOrder } from '../../../../godot/scene/particles3d';
import { useSceneResources } from '../../../../r3f/SceneResourcesContext';
import { boxPlacement } from '../../../../r3f/visibilityRange/placements';
import { useGeometryInstance } from '../../../../r3f/visibilityRange/geometryInstance';
import { useMeshAabb } from '../../meshinstance3d/meshAabb';
import { useParticleResources } from '../../../shared/cpuparticles/useParticleResources';
import { particlesAabb } from './ownAabb';
import { ParticleMesh } from '../../../shared/particles3d/ParticleMesh';
import { useCameraAxes } from '../../../shared/particles3d/useCameraAxes';
import { particleRows, particlesInDrawOrder, settleParticles } from './simulate';
import type { CPUParticles3DProperties } from './types';

interface ParticleEmitterProps {
  properties: CPUParticles3DProperties;
  nodeRef: RefObject<THREE.Object3D | null>;
  emissionTransform: Transform3D;
}

export function ParticleEmitter({ properties, nodeRef, emissionTransform }: ParticleEmitterProps) {
  const pools = useSceneResources();

  const resources = useParticleResources(properties.simulation);
  const settled = useMemo(
    () =>
      settleParticles({
        sim: properties.simulation,
        emission: properties.emission,
        ...resources,
        emissionTransform,
      }),
    [properties, resources, emissionTransform]
  );
  const viewAxis =
    useCameraAxes(properties.simulation.drawOrder === CPUParticles3DDrawOrder.VIEW_DEPTH)?.axis ?? null;
  const rows = useMemo(() => particleRows(settled), [settled]);
  const buffer = useMemo(() => particlesInDrawOrder(settled, rows, viewAxis), [settled, rows, viewAxis]);

  const meshAabb = useMeshAabb(properties.mesh, pools);
  const ownAabb = useMemo(() => particlesAabb(properties, rows, meshAabb), [properties, rows, meshAabb]);
  const placement = useMemo(() => boxPlacement(nodeRef, ownAabb), [nodeRef, ownAabb]);
  useGeometryInstance(placement);

  // Godot draws no instance while the emitter is off (`cpu_particles_3d.cpp:1338`).
  if (!settled.state) return null;
  return <ParticleMesh mesh={properties.mesh} buffer={buffer} />;
}
