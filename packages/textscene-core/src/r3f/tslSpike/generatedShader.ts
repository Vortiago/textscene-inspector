/**
 * The GLSL three generates for a fragment node, built with no GL context: the seam a unit test of a
 * ported function reads. `WebGPURenderer` makes its WebGL 2 backend and that backend's node builder
 * before any context exists, so the test needs only the two tables the builder asks the backend for.
 */

import * as THREE from 'three';
import { NodeMaterial, WebGPURenderer, type Node } from 'three/webgpu';

/** The members of a node builder that three's types leave out. */
interface ProgramBuilder {
  scene: THREE.Scene;
  material: THREE.Material;
  camera: THREE.Camera;
  build(): void;
  fragmentShader: string | null;
}

/** What three's types leave out of a backend that has not started. */
interface UnstartedBackend {
  extensions: { has: (name: string) => boolean };
  capabilities: { getUniformBufferLimit: () => number };
  createNodeBuilder: (object: THREE.Object3D, renderer: WebGPURenderer) => ProgramBuilder;
}

/** WebGL 2's lowest count of uniform buffers in a stage, which no generated program may pass. */
const MIN_UNIFORM_BUFFERS = 12;

/** The fragment shader of a material whose output is `fragmentNode`. */
export function generatedFragmentShader(fragmentNode: Node): string {
  const renderer = new WebGPURenderer({ forceWebGL: true, canvas: document.createElement('canvas') });
  const backend = renderer.backend as unknown as UnstartedBackend;
  backend.extensions = { has: () => false };
  backend.capabilities = { getUniformBufferLimit: () => MIN_UNIFORM_BUFFERS };
  // A renderer that has not started holds null here, and the builder shares groups unless it is undefined.
  (renderer as unknown as { _bindings: undefined })._bindings = undefined;
  const material = new NodeMaterial();
  material.fragmentNode = fragmentNode;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(), material);
  const builder = backend.createNodeBuilder(mesh, renderer);
  builder.scene = new THREE.Scene();
  builder.material = material;
  builder.camera = new THREE.PerspectiveCamera();
  builder.build();
  return builder.fragmentShader ?? '';
}
