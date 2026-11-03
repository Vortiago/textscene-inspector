/**
 * The surfaces a pass of Godot's that runs before its opaque pass draws, and the draw of one of them
 * between its mesh's own hooks. The depth prepass and the normal-roughness prepass each pick their
 * surfaces and the material they draw with.
 */

import * as THREE from 'three';
import { cameraFrustum } from './cameraFrustum';

/** One draw of a mesh: its material, and its draw group, null for a mesh of one material. */
export interface Surface {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.Material;
  readonly group: THREE.GeometryGroup | null;
}

/** Scratch for one walk: three renders one scene at a time. */
const frustum = new THREE.Frustum();

/**
 * Every surface of `scene` that `camera` sees and `isDrawn` keeps, in scene order: visible, in the
 * camera's layers, and inside its frustum unless the mesh opts out of culling.
 *
 * @canonical The surfaces of a scene that a camera sees
 */
export function visibleSurfaces(
  scene: THREE.Scene,
  camera: THREE.Camera,
  isDrawn: (material: THREE.Material) => boolean
): Surface[] {
  cameraFrustum(camera, frustum);
  const surfaces: Surface[] = [];
  scene.traverseVisible((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || !mesh.layers.test(camera.layers)) return;
    if (mesh.frustumCulled && !frustum.intersectsObject(mesh)) return;
    surfaces.push(...meshSurfaces(mesh, isDrawn));
  });
  return surfaces;
}

function meshSurfaces(mesh: THREE.Mesh, isDrawn: (material: THREE.Material) => boolean): Surface[] {
  const { geometry, material } = mesh;
  if (!Array.isArray(material)) return isDrawn(material) ? [{ mesh, material, group: null }] : [];
  return geometry.groups.flatMap((group) => {
    const surface = material[group.materialIndex ?? 0];
    return surface && isDrawn(surface) ? [{ mesh, material: surface, group }] : [];
  });
}

/**
 * Draws `surface` with `drawn`, between its mesh's own draw hooks, which pose it and skip a draw its
 * range culls, as three's colour draw runs them (`WebGLRenderer.js:2158-2183`).
 *
 * @canonical A draw of one surface outside three's render list
 */
export function drawSurface(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  surface: Surface,
  drawn: THREE.Material
): void {
  const { mesh, material, group } = surface;
  // three's hooks and draw take a null group for a mesh of one material, typed as a group.
  const hookGroup = group as unknown as THREE.Group;
  mesh.onBeforeRender(renderer, scene, camera, mesh.geometry, material, hookGroup);
  mesh.modelViewMatrix.multiplyMatrices(camera.matrixWorldInverse, mesh.matrixWorld);
  mesh.normalMatrix.getNormalMatrix(mesh.modelViewMatrix);
  renderer.renderBufferDirect(camera, scene, mesh.geometry, drawn, mesh, group as THREE.GeometryGroup);
  mesh.onAfterRender(renderer, scene, camera, mesh.geometry, material, hookGroup);
}
