/**
 * The mesh of one draw pass at every section of every trail. A part whose material sets
 * `use_particle_trails` is one skinned geometry (`skinTrails.ts`). A part without the flag draws
 * whole at the matrix of each section, as `amount * sections` instances.
 */

import { useEffect, useMemo } from 'react';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import { readyMaterial, useMaterial } from '../../../r3f/materials/useMaterial';
import { useMeshContent } from '../../../r3f/meshes/meshContent';
import { SurfacedMeshDrawer, type MeshPart } from '../../../r3f/surfacedMeshDrawer/SurfacedMeshDrawer';
import { useInstanceDraw } from '../../../r3f/visibilityRange/geometryInstance';
import { useResourceResolution } from '../../../resources/useSubOrExtResource';
import { particleInstances } from './particleInstances';
import { skinTrailGeometry } from './skinTrails';

interface TrailMeshProps {
  /** The raw `mesh` reference of the draw pass, or undefined for none. */
  mesh: string | undefined;
  /** `sections` rows for each particle, in the layout of the particle buffer. */
  buffer: Float32Array;
  sections: number;
}

export function TrailMesh({ mesh, buffer, sections }: TrailMeshProps) {
  const content = useMeshContent(useResourceResolution(mesh, useSceneResources()));
  if (content.kind !== 'surfaced') return null;
  return (
    <>
      {content.mesh.parts.map((part, index) => (
        <TrailPart key={index} part={part} buffer={buffer} sections={sections} />
      ))}
    </>
  );
}

/** The flag is read on the material the part draws: `material_override` first, else the surface's. */
function TrailPart({ part, buffer, sections }: { part: MeshPart } & Omit<TrailMeshProps, 'mesh'>) {
  const { override } = useInstanceDraw();
  const material = readyMaterial(useMaterial(override ?? part.materials[0]));
  const isSkinned = material?.resource.data.use_particle_trails === 'true';
  return isSkinned ? (
    <SkinnedTrails part={part} buffer={buffer} sections={sections} />
  ) : (
    <SectionInstances part={part} buffer={buffer} />
  );
}

function SkinnedTrails({ part, buffer, sections }: { part: MeshPart } & Omit<TrailMeshProps, 'mesh'>) {
  const geometry = useMemo(
    () => skinTrailGeometry(part.geometry, buffer, sections),
    [part.geometry, buffer, sections]
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  const skinned = useMemo(() => [{ geometry, materials: part.materials }], [geometry, part.materials]);
  return <SurfacedMeshDrawer parts={skinned} />;
}

function SectionInstances({ part, buffer }: { part: MeshPart; buffer: Float32Array }) {
  const instances = useMemo(() => particleInstances(buffer), [buffer]);
  return <SurfacedMeshDrawer parts={[part]} instances={instances} />;
}
