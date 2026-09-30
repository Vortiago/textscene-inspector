/**
 * Which glTF extensions a GLB loads with. The default follows Godot 4.6.3's importer, which
 * imports only the set in `get_supported_gltf_extensions_hashset` (`gltf_document.cpp:6787-6806`):
 * it skips any other optional extension and refuses a file that requires one
 * (`gltf_document.cpp:7197-7202`). `three-loader` reads everything three's GLTFLoader reads.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createGLBMesh } from './glbProcessing';
import { triangleGlb } from './testing/triangleGlb';
import { isMesh } from '../../../r3f/testing/threeNarrow';

function meshesOf(root: THREE.Object3D): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  root.traverse((node) => {
    if (isMesh(node)) meshes.push(node);
  });
  return meshes;
}

const instancedGlb = () => triangleGlb({ instanced: true });

const requiringGlb = (name: string) =>
  triangleGlb({ extensionsUsed: [name], extensionsRequired: [name] });

/** A material with a clearcoat, which three reads and Godot's importer does not. */
const clearcoatGlb = () =>
  triangleGlb({
    extensionsUsed: ['KHR_materials_clearcoat'],
    material: {
      pbrMetallicRoughness: { baseColorFactor: [1, 0, 0, 1] },
      extensions: { KHR_materials_clearcoat: { clearcoatFactor: 1 } },
    },
  });

/** A material with an emissive strength, which both read. */
const emissiveStrengthGlb = () =>
  triangleGlb({
    extensionsUsed: ['KHR_materials_emissive_strength'],
    material: {
      emissiveFactor: [1, 1, 1],
      extensions: { KHR_materials_emissive_strength: { emissiveStrength: 4 } },
    },
  });

const materialOf = (root: THREE.Object3D) =>
  meshesOf(root)[0]!.material as THREE.MeshPhysicalMaterial;

describe('createGLBMesh under Godot’s importer rules (the default)', () => {
  it('draws an EXT_mesh_gpu_instancing node once, as a plain mesh', async () => {
    const meshes = meshesOf(await createGLBMesh(instancedGlb()));
    expect(meshes).toHaveLength(1);
    expect((meshes[0] as THREE.InstancedMesh).isInstancedMesh).toBeUndefined();
  });

  it('draws that node at its own transform', async () => {
    const root = await createGLBMesh(
      triangleGlb({ instanced: true, translation: [2, 3, 4] })
    );
    root.updateMatrixWorld(true);
    const position = new THREE.Vector3().setFromMatrixPosition(meshesOf(root)[0]!.matrixWorld);
    expect(position.toArray()).toEqual([2, 3, 4]);
  });

  it('skips an optional material extension Godot does not import', async () => {
    const material = materialOf(await createGLBMesh(clearcoatGlb()));
    expect(material.clearcoat ?? 0).toBe(0);
  });

  it('keeps an extension Godot imports', async () => {
    const material = materialOf(await createGLBMesh(emissiveStrengthGlb()));
    expect(material.emissiveIntensity).toBe(4);
  });

  it('leaves a node’s extras as authored, even a key named extensions', async () => {
    const extras = { extensions: { KHR_materials_clearcoat: { note: 'user data' } } };
    const root = await createGLBMesh(triangleGlb({ extras }));
    expect(meshesOf(root)[0]!.userData.extensions).toEqual(extras.extensions);
  });

  it('loads a file that requires an extension Godot imports', async () => {
    expect(meshesOf(await createGLBMesh(requiringGlb('KHR_texture_transform')))).toHaveLength(1);
  });

  it('refuses a file that requires EXT_mesh_gpu_instancing, naming it', async () => {
    await expect(
      createGLBMesh(
        triangleGlb({ extensionsRequired: ['EXT_mesh_gpu_instancing'], instanced: true })
      )
    ).rejects.toThrow(/required extension 'EXT_mesh_gpu_instancing' is not supported/);
  });

  it('refuses a file that requires one three reads and Godot does not', async () => {
    // three decodes KHR_mesh_quantization natively (GLTFLoader.js `GLTFMeshQuantizationExtension`).
    await expect(createGLBMesh(requiringGlb('KHR_mesh_quantization'))).rejects.toThrow(
      /required extension 'KHR_mesh_quantization' is not supported/
    );
  });

  it('loads a file whose unsupported extension is optional', async () => {
    const root = await createGLBMesh(triangleGlb({ extensionsUsed: ['KHR_mesh_quantization'] }));
    expect(meshesOf(root)).toHaveLength(1);
  });
});

describe('createGLBMesh under three’s loader rules', () => {
  const threeLoader = { extensionRules: 'three-loader' } as const;

  it('instances an EXT_mesh_gpu_instancing node', async () => {
    const meshes = meshesOf(await createGLBMesh(instancedGlb(), threeLoader));
    expect((meshes[0] as THREE.InstancedMesh).isInstancedMesh).toBe(true);
  });

  it('applies a material extension Godot does not import', async () => {
    expect(materialOf(await createGLBMesh(clearcoatGlb(), threeLoader)).clearcoat).toBe(1);
  });

  it('loads a file that requires an extension Godot does not import', async () => {
    const root = await createGLBMesh(requiringGlb('KHR_mesh_quantization'), threeLoader);
    expect(meshesOf(root)).toHaveLength(1);
  });
});
