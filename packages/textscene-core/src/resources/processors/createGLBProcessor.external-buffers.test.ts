/**
 * A text glTF's external buffer arrives through the provider, not a fetch: the VS Code
 * webview's CSP refuses every fetch. The read is recorded, so editing the `.bin`
 * reloads the glTF.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { FileEventBus } from '../FileEventBus';
import { ResourceEventBus } from '../ResourceEventBus';
import { createGLBProcessor } from './createGLBProcessor';
import { DependencyGraph } from '../dependencyGraph';

const GLTF_PATH = 'res://props/tri/tri.gltf';
const BIN_PATH = 'res://props/tri/tri%20data.bin';
const BIN_RES_PATH = 'res://props/tri/tri data.bin';

/** One triangle, its positions in the external buffer `uri` names: a percent-encoded space by default. */
function triangleGltf(uri = BIN_PATH.slice('res://props/tri/'.length)): ArrayBuffer {
  const gltf = {
    asset: { version: '2.0' },
    scenes: [{ nodes: [0] }],
    scene: 0,
    nodes: [{ name: 'tri', mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] },
    ],
    bufferViews: [{ buffer: 0, byteLength: 36 }],
    buffers: [{ uri, byteLength: 36 }],
  };
  return new TextEncoder().encode(JSON.stringify(gltf)).buffer as ArrayBuffer;
}

const positions = () => new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]).buffer;

function harness(files: Record<string, ArrayBuffer>) {
  const requested: string[] = [];
  const fileEventBus = new FileEventBus({
    loadResource: async (path: string) => {
      requested.push(path);
      return files[path] ?? null;
    },
  });
  const eventBus = new ResourceEventBus();
  const dependencies = new DependencyGraph();
  const processor = createGLBProcessor(fileEventBus, eventBus, dependencies);
  const settled = new Promise<{ object?: THREE.Object3D; error?: Error }>((resolve) => {
    eventBus.on<THREE.Object3D>('glb', 'loaded', (_path, object) => resolve({ object }));
    eventBus.on<Error>('glb', 'failed', (_path, error) => resolve({ error }));
  });
  processor.request(GLTF_PATH);
  return { settled, dependencies, requested };
}

describe('createGLBProcessor with a text glTF’s external buffer', () => {
  it('reads the buffer through the provider and builds the mesh', async () => {
    const { settled } = harness({ [GLTF_PATH]: triangleGltf(), [BIN_RES_PATH]: positions() });

    const { object } = await settled;

    let vertices = 0;
    object!.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (mesh.isMesh) vertices += mesh.geometry.getAttribute('position').count;
    });
    expect(vertices).toBe(3);
  });

  it('records the read, so a change to the buffer reloads the glTF', async () => {
    const { settled, dependencies } = harness({ [GLTF_PATH]: triangleGltf(), [BIN_RES_PATH]: positions() });
    await settled;

    expect(dependencies.release(BIN_RES_PATH)).toEqual([{ busType: 'glb', key: GLTF_PATH }]);
  });

  it('fails naming the buffer it could not read', async () => {
    const { settled } = harness({ [GLTF_PATH]: triangleGltf() });

    const { error } = await settled;

    expect(error?.message).toContain(BIN_RES_PATH);
  });

  it('fails without a read for a buffer that climbs above res://', async () => {
    const { settled, requested } = harness({ [GLTF_PATH]: triangleGltf('../../../outside.bin') });

    const { error } = await settled;

    expect(error?.message).toContain('climbs above res://');
    expect(requested).toEqual([GLTF_PATH]);
  });
});
