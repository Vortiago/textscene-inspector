/**
 * The mesh at every particle of a settled particle node, through the surfaced mesh drawer: each
 * part one instanced draw over the particle buffer, one component for each draw pass. A trail
 * (`sections` set) draws a part whose material sets `use_particle_trails` as one skinned geometry
 * (`skinTrails.ts`). Any other part draws whole at every section.
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

interface ParticleMeshProps {
  /** The raw `mesh` reference each particle draws, or undefined for none. */
  mesh: string | undefined;
  /** One row for each particle, or `sections` rows for each particle of a trail. */
  buffer: Float32Array;
  /** The rows of each particle, set for a trail. */
  sections?: number;
}

/** The mesh at every particle. A node with no mesh, or one that is not loaded yet, draws none. */
export function ParticleMesh({ mesh, buffer, sections }: ParticleMeshProps) {
  const content = useMeshContent(useResourceResolution(mesh, useSceneResources()));
  if (content.kind !== 'surfaced') return null;
  return (
    <>
      {content.mesh.parts.map((part, index) =>
        sections === undefined ? (
          <SectionInstances key={index} part={part} buffer={buffer} />
        ) : (
          <TrailPart key={index} part={part} buffer={buffer} sections={sections} />
        )
      )}
    </>
  );
}

/**
 * The flag is read on the material the part draws: `material_override` first, else the surface's.
 * A surface with no bone attributes cannot skin, so it draws whole at each section.
 */
function TrailPart({ part, buffer, sections }: { part: MeshPart; buffer: Float32Array; sections: number }) {
  const { override } = useInstanceDraw();
  const material = readyMaterial(useMaterial(override ?? part.materials[0]));
  const isSkinned = material?.data.usesParticleTrails === true && part.geometry.hasAttribute('skinIndex');
  return isSkinned ? (
    <SkinnedTrails part={part} buffer={buffer} sections={sections} />
  ) : (
    <SectionInstances part={part} buffer={buffer} />
  );
}

function SkinnedTrails({
  part,
  buffer,
  sections,
}: {
  part: MeshPart;
  buffer: Float32Array;
  sections: number;
}) {
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
