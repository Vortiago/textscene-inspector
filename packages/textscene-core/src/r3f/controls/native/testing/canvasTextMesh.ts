/** Finds the mesh the canvas painter draws a run on, for a test that reads where a run of a scene font sits. */
import * as THREE from 'three';
import type ReactThreeTestRenderer from '@react-three/test-renderer';

type Scene = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>['scene'];

/** The first mesh of the canvas painter under `scene`: a `MeshBasicMaterial` over the raster's `DataTexture`. */
export function findCanvasTextMesh(scene: Scene): THREE.Mesh | undefined {
  return scene
    .findAllByType('Mesh')
    .map((found) => found.instance as THREE.Mesh)
    .find((mesh) => (mesh.material as THREE.MeshBasicMaterial).map instanceof THREE.DataTexture);
}
