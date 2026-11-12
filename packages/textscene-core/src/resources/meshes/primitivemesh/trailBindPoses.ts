/**
 * The built-in bind poses of a RibbonTrailMesh or a TubeTrailMesh, which a GPUParticles3D trail
 * multiplies each section by (`gpu_particles_3d.cpp:610-617`), read through the resource module (ADR-0071).
 * No THREE and no React.
 */

import { identityTransform3D, type Transform3D } from '../../../godot/math/transform3d';
import { storedReal } from '../../../godot/math/real.js';
import type { ResourceKind } from '../../reading';
import { decodeTrailMeshBase } from './trailDecode';

/**
 * `sections + 1` poses. Pose `i` is a translation by `-(section_length * sections / 2 - section_length * i)`
 * along Y: the bind is an inverse transform, so Y is negated (`primitive_meshes.cpp:2493-2501`, `:2869-2877`).
 */
export function trailBindPoses(sections: number, sectionLength: number): Transform3D[] {
  const depth = storedReal(sectionLength * sections);
  return Array.from({ length: sections + 1 }, (_, index) => ({
    ...identityTransform3D(),
    origin: { x: 0, y: -storedReal(depth / 2 - storedReal(sectionLength * index)), z: 0 },
  }));
}

/** Any other mesh has no built-in bind poses, so it reads as `wrong-type` and the trail looks further. */
export const TRAIL_MESH_BIND_POSES: ResourceKind<Transform3D[]> = {
  name: 'RibbonTrailMesh or TubeTrailMesh',
  accepts: (type) => type === 'RibbonTrailMesh' || type === 'TubeTrailMesh',
  decode: ({ type, properties }) => {
    const { sections, sectionLength } = decodeTrailMeshBase(properties, null, type);
    return trailBindPoses(sections, sectionLength);
  },
};
