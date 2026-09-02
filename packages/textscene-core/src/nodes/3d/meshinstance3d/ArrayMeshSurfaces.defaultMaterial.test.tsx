/**
 * An ArrayMesh surface that Godot draws with its default shader — no material,
 * or one this previewer cannot build — renders the same grey the primitive path
 * gives: `ALBEDO = vec3(0.6); ROUGHNESS = 0.8; METALLIC = 0.2`
 * (scene_shader_forward_clustered.cpp, cited in StandardMaterialSlot).
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type * as THREE from 'three';
import { MeshInstance3D } from './Component';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import type { TscnInternalResource, TscnNode } from '../../../parser/types';
import type { MeshInstance3DProperties } from './types';
import { INLINE_SURFACES } from './arrayMeshSurfaces.testkit';

const inlineMesh: TscnInternalResource = {
  id: 'ArrayMesh_inline',
  type: 'ArrayMesh',
  data: { _surfaces: INLINE_SURFACES },
};

async function renderMesh(internal: TscnInternalResource[], materialOverride?: string) {
  const node: TscnNode = {
    name: 'M',
    type: 'MeshInstance3D',
    children: [],
    properties: {
      name: 'M',
      mesh: 'SubResource("ArrayMesh_inline")',
      materialOverride,
      surfaceMaterialOverrides: new Map(),
    } as MeshInstance3DProperties,
  };
  const renderer = await ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={createFakeResourceLoader().loader}>
      <SceneResourcesProvider internalResources={internal} externalResources={[]}>
        <MeshInstance3D node={node} />
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
  const mesh = renderer.scene.findAllByType('Mesh')[0]!.instance as unknown as THREE.Mesh;
  return mesh.material as THREE.MeshStandardMaterial;
}

function expectDefaultShader(material: THREE.MeshStandardMaterial): void {
  expect(material.color.r).toBeCloseTo(0.6, 5);
  expect(material.color.g).toBeCloseTo(0.6, 5);
  expect(material.color.b).toBeCloseTo(0.6, 5);
  expect(material.roughness).toBe(0.8);
  expect(material.metalness).toBe(0.2);
}

describe('an ArrayMesh surface with no drawable material', () => {
  it('draws the default shader grey for a surface that names no material', async () => {
    expectDefaultShader(await renderMesh([inlineMesh]));
  });

  it('draws the same grey under a material_override this previewer cannot build', async () => {
    // A ShaderMaterial loads and fills the slot, so nothing below it is
    // reachable; the primitive path already answers it with the grey slot.
    const shader: TscnInternalResource = { id: 'Shader_1', type: 'ShaderMaterial', data: {} };
    expectDefaultShader(await renderMesh([inlineMesh, shader], 'SubResource("Shader_1")'));
  });
});
