/**
 * The GLB processor honours an **Import sidecar**'s `_subresources` material remaps.
 *
 * The witness is `scenes/demos/3d/ragdoll_physics/characters/mannequiny.glb.import`:
 * the glTF's own materials carry no base colour at all, and the sidecar repoints each
 * one at a `res://materials/*.tres`. Without the remap the mannequins render white
 * where Godot draws them blue.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { FileEventBus } from '../FileEventBus';
import { ResourceEventBus } from '../ResourceEventBus';
import { createGLBProcessor } from './createGLBProcessor';
import { initGlbModules } from '../formats/glb/glbProcessing';
import { applyTextureState, isMaterialOwnedTexture } from '../textures/applyTextureState';

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

interface Harness {
  root: THREE.Object3D;
  external: THREE.MeshStandardMaterial;
  loadMaterial: ReturnType<typeof vi.fn>;
  clearTemplate: () => void;
}

/** Drive the processor the way the loader does, with a stub material peer-loader. */
async function loadWith(
  files: Record<string, string>,
  options: { materialName?: string; failMaterial?: boolean; externalMap?: THREE.Texture } = {}
): Promise<Harness> {
  const asset = gltfWithNamedMaterial(options.materialName ?? GLTF_MATERIAL);
  const fileEventBus = new FileEventBus({
    loadResource: vi.fn(async (path: string) => (path === GLTF_PATH ? asset : (files[path] ?? null))),
  });
  const eventBus = new ResourceEventBus();
  const external = new THREE.MeshStandardMaterial({ color: 0x2585fa, map: options.externalMap ?? null });
  const loadMaterial = vi.fn(async () => (options.failMaterial ? null : external));
  const processor = createGLBProcessor(fileEventBus, eventBus, loadMaterial);

  const loaded = eventBus.once<THREE.Object3D>('glb', 'loaded', GLTF_PATH, 5000);
  processor.request(GLTF_PATH);
  return {
    root: await loaded,
    external,
    loadMaterial,
    clearTemplate: () => processor.clearCache(),
  };
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

  it('replaces the glTF material with the sidecar’s external .tres', async () => {
    const { root, loadMaterial } = await loadWith({ [`${GLTF_PATH}.import`]: SIDECAR });
    expect(loadMaterial).toHaveBeenCalledWith(BLUE_PATH);
    expect(surfaceMaterial(root).color.getHex()).toBe(0x2585fa);
  });

  it('keeps the glTF material when no sidecar exists', async () => {
    const { root, loadMaterial } = await loadWith({});
    expect(loadMaterial).not.toHaveBeenCalled();
    // glTF's default `baseColorFactor` is [1,1,1,1].
    expect(surfaceMaterial(root).color.getHex()).toBe(0xffffff);
  });

  it('leaves a surface whose material name the sidecar does not remap', async () => {
    const { root, loadMaterial } = await loadWith(
      { [`${GLTF_PATH}.import`]: SIDECAR },
      { materialName: 'Negro_COLOR_0' }
    );
    expect(loadMaterial).not.toHaveBeenCalled();
    expect(surfaceMaterial(root).color.getHex()).toBe(0xffffff);
  });

  it('keeps the glTF material when the external .tres cannot be loaded', async () => {
    const { root } = await loadWith({ [`${GLTF_PATH}.import`]: SIDECAR }, { failMaterial: true });
    expect(surfaceMaterial(root).color.getHex()).toBe(0xffffff);
  });

  it('leaves the shared external material alive when the template is disposed', async () => {
    // The material processor owns and caches it; the template must not free a peer's resource.
    const { root, external, clearTemplate } = await loadWith({ [`${GLTF_PATH}.import`]: SIDECAR });
    const disposed = vi.fn();
    external.addEventListener('dispose', disposed);
    expect(surfaceMaterial(root)).not.toBe(external);

    clearTemplate();
    expect(disposed).not.toHaveBeenCalled();
  });

  it('gives the template its own copy of a texture the external material owns', async () => {
    // A binding clone belongs to the `.tres` material, and the material processor
    // frees it on eviction, so the template must neither sample it nor free it.
    const shared = new THREE.Texture();
    const owned = applyTextureState(shared, { colorSpace: THREE.SRGBColorSpace });
    expect(isMaterialOwnedTexture(owned)).toBe(true);
    const { root, clearTemplate } = await loadWith(
      { [`${GLTF_PATH}.import`]: SIDECAR },
      { externalMap: owned }
    );

    const map = surfaceMaterial(root).map!;
    expect(map).not.toBe(owned);
    expect(map.source).toBe(shared.source);
    const ownedDisposed = vi.fn();
    const copyDisposed = vi.fn();
    owned.addEventListener('dispose', ownedDisposed);
    map.addEventListener('dispose', copyDisposed);

    clearTemplate();
    expect(copyDisposed).toHaveBeenCalledTimes(1);
    expect(ownedDisposed).not.toHaveBeenCalled();
  });

  it('keeps sharing a loader cache entry the external material binds as is', async () => {
    const shared = new THREE.Texture();
    shared.wrapS = shared.wrapT = THREE.RepeatWrapping;
    const { root, clearTemplate } = await loadWith(
      { [`${GLTF_PATH}.import`]: SIDECAR },
      { externalMap: shared }
    );
    expect(surfaceMaterial(root).map).toBe(shared);
    const disposed = vi.fn();
    shared.addEventListener('dispose', disposed);
    clearTemplate();
    expect(disposed).not.toHaveBeenCalled();
  });
});
