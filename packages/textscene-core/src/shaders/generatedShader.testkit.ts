/**
 * The GLSL three generates for a fragment node, built with no GL context: the seam a unit test of a
 * ported Godot function reads. `WebGPURenderer` makes its WebGL 2 backend and that backend's node
 * builder before any context exists, so the kit fills only the two tables the builder asks for.
 * The package entry does not export it.
 */

import * as THREE from 'three';
import { LightsNode, NodeMaterial, WebGPURenderer, type Node } from 'three/webgpu';

/** The members of a node builder that three's types leave out. */
interface ProgramBuilder {
  scene: THREE.Scene;
  material: THREE.Material;
  camera: THREE.Camera;
  lightsNode: LightsNode;
  build(): void;
  fragmentShader: string | null;
}

/** What three's types leave out of a backend that has not started. */
interface UnstartedBackend {
  extensions: { has: (name: string) => boolean };
  capabilities: { getUniformBufferLimit: () => number };
  hasCompatibility: (name: string) => boolean;
  createNodeBuilder: (object: THREE.Object3D, renderer: WebGPURenderer) => ProgramBuilder;
}

/** WebGL 2's lowest count of uniform buffers in a stage, which no generated program may pass. */
const MIN_UNIFORM_BUFFERS = 12;

/** The fragment shader of a material whose output is `fragmentNode`. */
export function generatedFragmentShader(fragmentNode: Node): string {
  const material = new NodeMaterial();
  material.fragmentNode = fragmentNode;
  return generatedMaterialShader(material);
}

/** The fragment shader of `material` on a mesh that `lights` light. */
export function generatedMaterialShader(material: NodeMaterial, lights: readonly THREE.Light[] = []): string {
  const renderer = new WebGPURenderer({ forceWebGL: true, canvas: document.createElement('canvas') });
  const backend = renderer.backend as unknown as UnstartedBackend;
  backend.extensions = { has: () => false };
  backend.capabilities = { getUniformBufferLimit: () => MIN_UNIFORM_BUFFERS };
  // WebGL 2 compares depth in its sampler, which a shadow lookup asks the renderer about.
  backend.hasCompatibility = () => true;
  (renderer as unknown as { _initialized: boolean })._initialized = true;
  // A renderer that has not started holds null here, and the builder shares groups unless it is undefined.
  (renderer as unknown as { _bindings: undefined })._bindings = undefined;
  renderer.shadowMap.enabled = true;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(), material);
  mesh.receiveShadow = true;
  const builder = backend.createNodeBuilder(mesh, renderer);
  builder.scene = new THREE.Scene();
  builder.material = material;
  builder.camera = new THREE.PerspectiveCamera();
  builder.lightsNode = new LightsNode().setLights([...lights]);
  buildReportingErrors(builder);
  return builder.fragmentShader ?? '';
}

/**
 * Builds the program, and throws what three reports while it builds. three logs a node that generates
 * no code and puts a zero in its place, so a test would otherwise read a shader that draws nothing.
 */
function buildReportingErrors(builder: ProgramBuilder): void {
  const reports: string[] = [];
  const log = console.error;
  console.error = (...parts: unknown[]) => reports.push(parts.join(' '));
  try {
    builder.build();
  } finally {
    console.error = log;
  }
  if (reports.length > 0) throw new Error(`expected a build without errors, got: ${reports.join('; ')}`);
}
