/**
 * The GLSL three generates for a fragment node, built with no GL context: the seam a unit test of a
 * ported Godot function reads. `WebGPURenderer` makes its WebGL 2 backend and that backend's node
 * builder before any context exists, so the kit fills only the two tables the builder asks for.
 * The package entry does not export it.
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
  vertexShader: string | null;
}

/** What three's types leave out of a backend that has not started. */
interface UnstartedBackend {
  extensions: { has: (name: string) => boolean };
  capabilities: { getUniformBufferLimit: () => number };
  createNodeBuilder: (object: THREE.Object3D, renderer: WebGPURenderer) => ProgramBuilder;
}

/** WebGL 2's lowest count of uniform buffers in a stage, which no generated program may pass. */
const MIN_UNIFORM_BUFFERS = 12;

/** The program three builds for `material`, with no GL context. */
function builtProgram(material: NodeMaterial): ProgramBuilder {
  const renderer = new WebGPURenderer({ forceWebGL: true, canvas: document.createElement('canvas') });
  const backend = renderer.backend as unknown as UnstartedBackend;
  backend.extensions = { has: () => false };
  backend.capabilities = { getUniformBufferLimit: () => MIN_UNIFORM_BUFFERS };
  // A renderer that has not started holds null here, and the builder shares groups unless it is undefined.
  (renderer as unknown as { _bindings: undefined })._bindings = undefined;
  const builder = backend.createNodeBuilder(new THREE.Mesh(new THREE.PlaneGeometry(), material), renderer);
  builder.scene = new THREE.Scene();
  builder.material = material;
  builder.camera = new THREE.PerspectiveCamera();
  builder.build();
  return builder;
}

/** The fragment shader of a material whose output is `fragmentNode`. */
export function generatedFragmentShader(fragmentNode: Node): string {
  const material = new NodeMaterial();
  material.fragmentNode = fragmentNode;
  return builtProgram(material).fragmentShader ?? '';
}

/** The vertex shader of a material whose vertex position is `positionNode`. */
export function generatedVertexShader(positionNode: Node): string {
  return generatedProgram({ positionNode }).vertex;
}

/** Both stages of a material whose vertex position and output are the nodes given. */
export function generatedProgram(nodes: { positionNode?: Node; fragmentNode?: Node }): {
  vertex: string;
  fragment: string;
} {
  const material = new NodeMaterial();
  Object.assign(material, nodes);
  const builder = builtProgram(material);
  return { vertex: builder.vertexShader ?? '', fragment: builder.fragmentShader ?? '' };
}
