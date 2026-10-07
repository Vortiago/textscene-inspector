/**
 * Reads the 2D light pass of a test-renderer scene without a GPU: the uniforms an item bound, and
 * which light meshes each accumulation draw would draw. Happy-dom executes no draw, so the pass's
 * renderer calls are recorded instead.
 */

import { vi } from 'vitest';
import * as THREE from 'three';
import type ReactThreeTestRenderer from '@react-three/test-renderer';

type Rendered = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

/** One accumulation draw: the buffer it wrote and the meshes the camera would draw into it. */
export interface RecordedDraw {
  readonly texture: THREE.Texture;
  readonly drawn: readonly THREE.Mesh[];
}

function rendererOf(renderer: Rendered): THREE.WebGLRenderer {
  const root = (
    renderer.scene.instance as unknown as { __r3f: { root: { getState(): { gl: THREE.WebGLRenderer } } } }
  ).__r3f.root;
  return root.getState().gl;
}

function drawnMeshes(scene: THREE.Object3D, camera: THREE.Camera): THREE.Mesh[] {
  const drawn: THREE.Mesh[] = [];
  scene.traverseVisible((object) => {
    if ((object as THREE.Mesh).isMesh && object.layers.test(camera.layers)) drawn.push(object as THREE.Mesh);
  });
  return drawn;
}

/** Runs one frame and records each draw into an accumulation buffer. */
export async function recordLightPass(renderer: Rendered): Promise<RecordedDraw[]> {
  const gl = rendererOf(renderer);
  const draws: RecordedDraw[] = [];
  let target: THREE.WebGLRenderTarget | null = null;
  const spies = [
    vi.spyOn(gl, 'setRenderTarget').mockImplementation((next) => {
      target = next as THREE.WebGLRenderTarget | null;
    }),
    vi.spyOn(gl, 'getRenderTarget').mockImplementation(() => target),
    vi.spyOn(gl, 'clear').mockImplementation(() => {}),
    vi.spyOn(gl, 'render').mockImplementation((scene, camera) => {
      if (target) draws.push({ texture: target.texture, drawn: drawnMeshes(scene, camera) });
    }),
  ];
  try {
    await renderer.advanceFrames(1, 0);
  } finally {
    spies.forEach((spy) => spy.mockRestore());
  }
  return draws;
}

/** The uniforms the item named `name` bound, read back through its `onBeforeCompile`. */
export function itemUniforms(renderer: Rendered, name: string): Record<string, THREE.IUniform> {
  const group = renderer.scene.findAll((o) => o.props.name === name)[0];
  if (!group) throw new Error(`expected an item named ${name}, found none`);
  const mesh = group
    .findAllByType('Mesh')
    .map((o) => o.instance as THREE.Mesh)
    .find((m) => !!(m.material as THREE.Material).onBeforeCompile);
  if (!mesh) throw new Error(`expected ${name} to render a lit mesh, found none`);
  const shader = {
    vertexShader: '',
    fragmentShader: 'void main() {\n#include <colorspace_fragment>\n}',
    uniforms: {} as Record<string, THREE.IUniform>,
  };
  (mesh.material as THREE.Material).onBeforeCompile(
    shader as unknown as THREE.WebGLProgramParametersWithUniforms,
    null as unknown as THREE.WebGLRenderer
  );
  return shader.uniforms;
}

/** The name of the nearest named ancestor: the light node a pass mesh belongs to. */
export function ownerName(mesh: THREE.Object3D): string {
  let object: THREE.Object3D | null = mesh;
  while (object && !object.name) object = object.parent;
  return object?.name ?? '';
}

/** Whether the mesh is the seed quad, which every draw holds. */
function isSeed(mesh: THREE.Mesh): boolean {
  return !!(mesh.material as THREE.ShaderMaterial).uniforms?.uSeed;
}

/**
 * The light meshes the draw into `texture` holds, as their owners' names, in scene order. Empty
 * when no draw writes `texture`.
 */
export function lightsIn(draws: readonly RecordedDraw[], texture: THREE.Texture): string[] {
  const draw = draws.find((recorded) => recorded.texture === texture);
  return (draw?.drawn ?? []).filter((mesh) => !isSeed(mesh)).map(ownerName);
}
