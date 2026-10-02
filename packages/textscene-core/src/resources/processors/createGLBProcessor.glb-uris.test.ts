/**
 * A GLB's external buffers and images arrive through the provider, as a text glTF's do.
 * A URI in a crafted GLB never reaches a fetch, so it cannot reveal the viewer to a
 * remote host or load a same-origin file that is not the project's.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { FileEventBus } from '../FileEventBus';
import { ResourceEventBus } from '../ResourceEventBus';
import { createGLBProcessor } from './createGLBProcessor';
import { DependencyGraph } from '../dependencyGraph';
import { glbOfChunks, jsonChunk } from '../formats/glb/testing/triangleGlb';

const GLB_PATH = 'res://props/tri.glb';

/** One triangle whose positions live in the buffer `uri` names. */
function triangleGlbNaming(uri: string): ArrayBuffer {
  return glbOfChunks([
    jsonChunk({
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
    }),
  ]);
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
  processor.request(GLB_PATH);
  return { settled, dependencies, requested };
}

function vertexCount(object: THREE.Object3D): number {
  let vertices = 0;
  object.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (mesh.isMesh) vertices += mesh.geometry.getAttribute('position').count;
  });
  return vertices;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createGLBProcessor with a GLB that names an external URI', () => {
  it('reads the buffer through the provider, records the read and builds the mesh', async () => {
    const { settled, dependencies } = harness({
      [GLB_PATH]: triangleGlbNaming('tri.bin'),
      'res://props/tri.bin': positions(),
    });

    const { object } = await settled;

    expect(vertexCount(object!)).toBe(3);
    expect(dependencies.release('res://props/tri.bin')).toEqual([{ busType: 'glb', key: GLB_PATH }]);
  });

  it('asks the provider, never the network, for a remote URI, and fails naming it', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { settled, requested } = harness({
      [GLB_PATH]: triangleGlbNaming('https://attacker.example/beacon.bin'),
    });

    const { error } = await settled;

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(requested).toContain('res://props/https:/attacker.example/beacon.bin');
    expect(error?.message).toContain('res://props/https:/attacker.example/beacon.bin');
  });

  it('fails without a read for a URI that climbs above res://', async () => {
    const { settled, requested } = harness({ [GLB_PATH]: triangleGlbNaming('../../outside.bin') });

    const { error } = await settled;

    expect(error?.message).toContain('climbs above res://');
    expect(requested).toEqual([GLB_PATH]);
  });
});
