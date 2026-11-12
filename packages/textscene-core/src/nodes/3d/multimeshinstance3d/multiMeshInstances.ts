import { multiMeshInstanceArrays, type DrawnInstances } from '../../../resources/meshes/multimesh';
import { colouredInstances } from '../../../r3f/surfacedMeshDrawer/colouredInstances';
import type { MeshInstances } from '../../../r3f/surfacedMeshDrawer/meshInstances';

/** The instances of a MultiMesh as the surfaced mesh drawer draws a mesh at them. */
export function multiMeshInstances(drawn: DrawnInstances): MeshInstances {
  return colouredInstances(multiMeshInstanceArrays(drawn));
}
