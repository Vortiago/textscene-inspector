/**
 * The GLB processor honours an Import sidecar's per-node `mesh_instance/layers`.
 *
 * `resource_importer_scene.cpp:1836` calls `set_layer_mask` on the imported mesh
 * instance, so the mask belongs to the asset and no scene mentions it. Decals read
 * it: Godot projects one only where `cull_mask & layers` is non-zero.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { FileEventBus } from '../FileEventBus';
import { ResourceEventBus } from '../ResourceEventBus';
import { createGLBProcessor } from './createGLBProcessor';
import { initGlbModules } from '../formats/glb/glbProcessing';
import { visualLayersOf } from '../../r3f/visualLayers';

const GLTF_PATH = 'res://town/lamp/scene.gltf';
/** The witness path: the middle segment's SPACE is what three sanitizes to `_`. */
const NODE_PATH = 'Sketchfab_model/Lowpoly lamp_105/Object_4';

const SIDECAR = `[remap]

importer="scene"

[params]

nodes/root_scale=1.0
_subresources={
"nodes": {
"PATH:${NODE_PATH}": {
"mesh_instance/layers": 2
}
}
}
`;

/** Three nested nodes, the leaf carrying the only mesh. */
function nestedGltf(): ArrayBuffer {
  const gltf = {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [
      { name: 'Sketchfab_model', children: [1] },
      { name: 'Lowpoly lamp_105', children: [2] },
      { name: 'Object_4', mesh: 0 },
    ],
    meshes: [{ name: 'lamp', primitives: [{ attributes: { POSITION: 0 } }] }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] },
    ],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }],
    buffers: [
      {
        byteLength: 36,
        uri: 'data:application/octet-stream;base64,AAAAAAAAAAAAAAAAAACAPwAAAAAAAAAAAAAAAAAAgD8AAAAA',
      },
    ],
  };
  return new TextEncoder().encode(JSON.stringify(gltf)).buffer as ArrayBuffer;
}

async function loadWith(files: Record<string, string>): Promise<THREE.Object3D> {
  const asset = nestedGltf();
  const fileEventBus = new FileEventBus({
    loadResource: vi.fn(async (path: string) => (path === GLTF_PATH ? asset : (files[path] ?? null))),
  });
  const eventBus = new ResourceEventBus();
  const processor = createGLBProcessor(fileEventBus, eventBus, vi.fn(async () => null));
  const loaded = eventBus.once<THREE.Object3D>('glb', 'loaded', GLTF_PATH, 5000);
  processor.request(GLTF_PATH);
  return loaded;
}

function theMesh(root: THREE.Object3D): THREE.Object3D {
  let found: THREE.Object3D | undefined;
  root.traverse((node) => {
    if ((node as THREE.Mesh).isMesh) found = node;
  });
  return found!;
}

describe('createGLBProcessor — import sidecar node layers', () => {
  beforeAll(async () => {
    await initGlbModules();
  });

  it('stamps the sidecar mask, matching a path three has sanitized', async () => {
    const root = await loadWith({ [`${GLTF_PATH}.import`]: SIDECAR });
    expect(visualLayersOf(theMesh(root))).toBe(2);
  });

  it('leaves Godot\'s default when no sidecar exists', async () => {
    expect(visualLayersOf(theMesh(await loadWith({})))).toBe(1);
  });

  it('leaves Godot\'s default when the path matches no node', async () => {
    const root = await loadWith({
      [`${GLTF_PATH}.import`]: SIDECAR.replace('Object_4"', 'Object_9"'),
    });
    expect(visualLayersOf(theMesh(root))).toBe(1);
  });
});
