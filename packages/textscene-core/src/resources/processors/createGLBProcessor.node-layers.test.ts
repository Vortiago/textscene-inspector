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
/**
 * The witness path, verbatim from the vendored sidecar: a SPACE that three sanitizes to
 * `_`, and the full chain the Sketchfab export really carries.
 */
const NODE_PATH = 'Sketchfab_model/root/GLTF_SceneRootNode/Lowpoly lamp_105/Object_4';

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

/**
 * The vendored lamp's node chain, leaf-mesh included, under a named scene: the scene
 * name is what a first-segment lookup that admitted the root could latch onto.
 */
function nestedGltf(): ArrayBuffer {
  const gltf = {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ name: 'Sketchfab_Scene', nodes: [0] }],
    nodes: [
      { name: 'Sketchfab_model', children: [1] },
      { name: 'root', children: [2] },
      { name: 'GLTF_SceneRootNode', children: [3] },
      { name: 'Lowpoly lamp_105', children: [4] },
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

  it('crosses a level Godot\'s importer synthesised and three\'s did not', async () => {
    // Godot inserts a Skeleton3D between an armature and the mesh it skins, so a sidecar
    // path into any skinned asset names a node three's graph has no counterpart for.
    const root = await loadWith({
      [`${GLTF_PATH}.import`]: SIDECAR.replace(
        'Lowpoly lamp_105/Object_4',
        'Lowpoly lamp_105/Skeleton3D/Object_4'
      ),
    });
    expect(visualLayersOf(theMesh(root))).toBe(2);
  });
});
