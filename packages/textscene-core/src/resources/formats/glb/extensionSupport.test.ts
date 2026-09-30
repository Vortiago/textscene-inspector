/**
 * A GLB loads as Godot 4.6.3's glTF importer reads it. Godot imports only the extensions
 * in `get_supported_gltf_extensions_hashset` (`gltf_document.cpp:6787-6806`): it skips any
 * other optional one, and refuses a file that requires one (`gltf_document.cpp:7197-7202`).
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createGLBMesh } from './glbProcessing';
import { triangleGlb } from './testing/triangleGlb';

function meshesOf(root: THREE.Object3D): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  root.traverse((node) => {
    if ((node as THREE.Mesh).isMesh) meshes.push(node as THREE.Mesh);
  });
  return meshes;
}

describe('createGLBMesh and EXT_mesh_gpu_instancing', () => {
  it('draws an instanced node once, as a plain mesh', async () => {
    const root = await createGLBMesh(
      triangleGlb({ extensionsUsed: ['EXT_mesh_gpu_instancing'], instanced: true })
    );
    const meshes = meshesOf(root);
    expect(meshes).toHaveLength(1);
    expect((meshes[0] as THREE.InstancedMesh).isInstancedMesh).toBeUndefined();
  });

  it('draws it at the node’s own transform', async () => {
    const root = await createGLBMesh(
      triangleGlb({
        extensionsUsed: ['EXT_mesh_gpu_instancing'],
        instanced: true,
        translation: [2, 3, 4],
      })
    );
    root.updateMatrixWorld(true);
    const position = new THREE.Vector3().setFromMatrixPosition(meshesOf(root)[0]!.matrixWorld);
    expect(position.toArray()).toEqual([2, 3, 4]);
  });

  it('refuses a file that requires it, naming the extension', async () => {
    await expect(
      createGLBMesh(
        triangleGlb({
          extensionsUsed: ['EXT_mesh_gpu_instancing'],
          extensionsRequired: ['EXT_mesh_gpu_instancing'],
          instanced: true,
        })
      )
    ).rejects.toThrow(/required extension 'EXT_mesh_gpu_instancing' is not supported/);
  });
});

describe('createGLBMesh and a required extension', () => {
  it('loads a file that requires an extension Godot imports', async () => {
    const root = await createGLBMesh(
      triangleGlb({
        extensionsUsed: ['KHR_texture_transform'],
        extensionsRequired: ['KHR_texture_transform'],
      })
    );
    expect(meshesOf(root)).toHaveLength(1);
  });

  it('refuses a file that requires one three reads and Godot does not', async () => {
    // three decodes KHR_mesh_quantization natively (GLTFLoader.js `GLTFMeshQuantizationExtension`).
    await expect(
      createGLBMesh(
        triangleGlb({
          extensionsUsed: ['KHR_mesh_quantization'],
          extensionsRequired: ['KHR_mesh_quantization'],
        })
      )
    ).rejects.toThrow(/required extension 'KHR_mesh_quantization' is not supported/);
  });

  it('loads a file whose unsupported extension is optional', async () => {
    const root = await createGLBMesh(triangleGlb({ extensionsUsed: ['KHR_mesh_quantization'] }));
    expect(meshesOf(root)).toHaveLength(1);
  });
});
