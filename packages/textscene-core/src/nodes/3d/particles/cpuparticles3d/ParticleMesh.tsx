/**
 * The mesh at every particle of a settled CPUParticles3D, through the surfaced mesh drawer: each
 * part one instanced draw over the particle buffer, with the passes of the emitter's instance.
 */

import { useMemo } from 'react';
import { useSceneResources } from '../../../../r3f/SceneResourcesContext';
import { useMeshContent } from '../../../../r3f/meshes/meshContent';
import { SurfacedMeshDrawer } from '../../../../r3f/surfacedMeshDrawer/SurfacedMeshDrawer';
import { useResourceResolution } from '../../../../resources/useSubOrExtResource';
import { particleInstances } from './particleInstances';

interface ParticleMeshProps {
  /** The raw `mesh` reference each particle draws, or undefined for none. */
  mesh: string | undefined;
  buffer: Float32Array;
}

/** The mesh at every particle. A node with no mesh, or one that is not loaded yet, draws none. */
export function ParticleMesh({ mesh, buffer }: ParticleMeshProps) {
  const content = useMeshContent(useResourceResolution(mesh, useSceneResources()));
  const instances = useMemo(() => particleInstances(buffer), [buffer]);
  if (content.kind !== 'surfaced') return null;
  return <SurfacedMeshDrawer parts={content.mesh.parts} instances={instances} />;
}
