import * as THREE from 'three';
import { installNodesHandler } from '@textscene/three-godot-shaders';

/** The renderer of a Godot viewport's display: sRGB output and no tone mapping. */
export const displayRenderer = new THREE.WebGLRenderer({ canvas: document.createElement('canvas') });
installNodesHandler(displayRenderer, 'display');
displayRenderer.outputColorSpace = THREE.SRGBColorSpace;
displayRenderer.toneMapping = THREE.NoToneMapping;

/** Godot's rotation in degrees, in Godot's order of axes: Y, then X, then Z. */
export const euler = ([x, y, z]) => new THREE.Euler(...[x, y, z].map(THREE.MathUtils.degToRad), 'YXZ');

/** A colour Godot holds in sRGB, linear, as Godot's C++ converts it. */
export const linear = ([r, g, b]) => new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);

/** The Camera3D of `spec`, with Camera3D's default near and far planes. */
export function godotCamera(spec) {
  const camera = new THREE.PerspectiveCamera(spec.camera.fov, spec.width / spec.height, 0.05, 4000);
  camera.rotation.copy(euler(spec.camera.rotation));
  if (spec.camera.position) camera.position.fromArray(spec.camera.position);
  camera.updateMatrixWorld();
  return camera;
}
