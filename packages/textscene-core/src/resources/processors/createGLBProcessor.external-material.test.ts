/**
 * The GLB processor reads an **Import sidecar**'s `_subresources` material remaps.
 * `scenes/demos/3d/ragdoll_physics/characters/mannequiny.glb.import` repoints each
 * base-colourless glTF material at a `res://materials/*.tres`, so without the remap
 * the mannequins render white where Godot draws them blue. The processor tags each
 * remapped surface with its `.tres` address, and the scene root draws that material
 * through the one material path (`Component.import-material.test.tsx`).
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { FileEventBus } from '../FileEventBus';
import { ResourceEventBus } from '../ResourceEventBus';
import { createGLBProcessor } from './createGLBProcessor';
import { importMaterialPath, initGlbModules } from '../formats/glb/glbProcessing';

const GLTF_PATH = 'res://characters/mannequiny.gltf';
const BLUE_PATH = 'res://materials/blue.tres';
const GLTF_MATERIAL = 'Azul_COLOR_0';

const SIDECAR = `[remap]

importer="scene"

[params]

materials/extract=0
_subresources={
"materials": {
"${GLTF_MATERIAL}": {
"use_external/enabled": true,
"use_external/fallback_path": "${BLUE_PATH}",
"use_external/path": "uid://ctlvxueekphcu"
}
}
}
`;

/** A one-triangle glTF whose single surface uses a named, colourless material. */
function gltfWithNamedMaterial(name: string): ArrayBuffer {
  const gltf = {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name: 'body', mesh: 0 }],
    meshes: [{ name: 'body', primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }],
    materials: [{ name, pbrMetallicRoughness: { metallicFactor: 0.1, roughnessFactor: 0.4 } }],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: 'VEC3',
        min: [0, 0, 0],
        max: [1, 1, 0],
      },
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

/** Drive the processor the way the loader does. */
async function loadWith(
  files: Record<string, string>,
  options: { materialName?: string } = {}
): Promise<THREE.Object3D> {
  const asset = gltfWithNamedMaterial(options.materialName ?? GLTF_MATERIAL);
  const fileEventBus = new FileEventBus({
    loadResource: vi.fn(async (path: string) => (path === GLTF_PATH ? asset : (files[path] ?? null))),
  });
  const eventBus = new ResourceEventBus();
  const processor = createGLBProcessor(fileEventBus, eventBus);

  const loaded = eventBus.once<THREE.Object3D>('glb', 'loaded', GLTF_PATH, 5000);
  processor.request(GLTF_PATH);
  return loaded;
}

/** The material on the asset's one surface. */
function surfaceMaterial(root: THREE.Object3D): THREE.MeshStandardMaterial {
  let found: THREE.Material | undefined;
  root.traverse((node) => {
    if ((node as THREE.Mesh).isMesh) found = (node as THREE.Mesh).material as THREE.Material;
  });
  return found as THREE.MeshStandardMaterial;
}

describe('createGLBProcessor — import sidecar external materials', () => {
  beforeAll(async () => {
    await initGlbModules();
  });

  it('tags the remapped surface with the sidecar\'s external .tres, and keeps the glTF material', async () => {
    const root = await loadWith({ [`${GLTF_PATH}.import`]: SIDECAR });
    const material = surfaceMaterial(root);

    expect(importMaterialPath(material)).toBe(BLUE_PATH);
    // glTF's default `baseColorFactor` is [1,1,1,1]: the surface keeps it until the .tres draws.
    expect(material.color.getHex()).toBe(0xffffff);
  });

  it('tags nothing when no sidecar exists', async () => {
    const root = await loadWith({});
    expect(importMaterialPath(surfaceMaterial(root))).toBeUndefined();
  });

  it('leaves a surface whose material name the sidecar does not remap', async () => {
    const root = await loadWith({ [`${GLTF_PATH}.import`]: SIDECAR }, { materialName: 'Negro_COLOR_0' });
    expect(importMaterialPath(surfaceMaterial(root))).toBeUndefined();
  });
});
