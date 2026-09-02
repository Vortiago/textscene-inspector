/**
 * A StandardMaterial3D on an ArrayMesh surface carries its texture maps and its
 * missing-texture placeholder, the same as on a primitive mesh.
 *
 * Godot fills a surface's slot in this order (`get_active_material`,
 * mesh_instance_3d.cpp:384-401): `material_override`, then
 * `surface_material_override/N`, then the mesh surface's own material.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import { MeshInstance3D } from './Component';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import type { TscnExternalResource, TscnInternalResource, TscnNode } from '../../../parser/types';
import type { MeshInstance3DProperties } from './types';
import { INLINE_SURFACES, inlineSurfacesWithMaterial } from './arrayMeshSurfaces.testkit';

const TEXTURE_PATH = 'res://textures/albedo.png';
const EXT: TscnExternalResource[] = [{ id: '1_tex', type: 'Texture2D', path: TEXTURE_PATH }];

const texturedMaterial: TscnInternalResource = {
  id: 'Mat_tex',
  type: 'StandardMaterial3D',
  data: { albedo_texture: 'ExtResource("1_tex")' },
};

/** Two copies of the inline surface, each carrying the material named for it. */
function twoSurfaces(material0: string | null, material1: string | null): string {
  const one = (id: string | null) =>
    (id ? inlineSurfacesWithMaterial(id) : INLINE_SURFACES).slice(1, -1);
  return `[${one(material0)}, ${one(material1)}]`;
}

function meshNode(
  surfaces: string,
  overrides: Partial<Pick<MeshInstance3DProperties, 'materialOverride' | 'surfaceMaterialOverrides'>> = {}
): { node: TscnNode; mesh: TscnInternalResource } {
  const node: TscnNode = {
    name: 'M',
    type: 'MeshInstance3D',
    children: [],
    properties: {
      name: 'M',
      mesh: 'SubResource("ArrayMesh_inline")',
      surfaceMaterialOverrides: new Map(),
      ...overrides,
    } as MeshInstance3DProperties,
  };
  return { node, mesh: { id: 'ArrayMesh_inline', type: 'ArrayMesh', data: { _surfaces: surfaces } } };
}

async function renderMesh(opts: {
  node: TscnNode;
  internal: TscnInternalResource[];
  texture: THREE.Texture | 'missing';
}) {
  const fake = createFakeResourceLoader();
  fake.textures.seed(TEXTURE_PATH, opts.texture === 'missing' ? null : opts.texture);
  const renderer = await ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={fake.loader}>
      <SceneResourcesProvider internalResources={opts.internal} externalResources={EXT}>
        <MeshInstance3D node={opts.node} />
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
  await new Promise<void>((r) => setTimeout(r, 10));
  const mesh = renderer.scene.findAllByType('Mesh')[0]!.instance as unknown as THREE.Mesh;
  const materials = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as THREE.MeshStandardMaterial[];
  return { materials };
}

const isMagenta = (m: THREE.MeshStandardMaterial) =>
  m.color.r > 0.9 && m.color.g < 0.1 && m.color.b > 0.9;

describe('material_override on an ArrayMesh', () => {
  it('binds the override material’s albedo_texture to the surface', async () => {
    const tex = new THREE.Texture();
    const { node, mesh } = meshNode(INLINE_SURFACES, {
      materialOverride: 'SubResource("Mat_tex")',
    });
    const { materials } = await renderMesh({ node, internal: [mesh, texturedMaterial], texture: tex });
    expect(materials).toHaveLength(1);
    expect(materials[0]!.map?.source).toBe(tex.source);
  });

  it('draws the missing-texture placeholder when the override’s texture is unavailable', async () => {
    const { node, mesh } = meshNode(INLINE_SURFACES, {
      materialOverride: 'SubResource("Mat_tex")',
    });
    const { materials } = await renderMesh({
      node,
      internal: [mesh, texturedMaterial],
      texture: 'missing',
    });
    expect(materials.map(isMagenta)).toEqual([true]);
  });
});

describe('a scene sub-resource material on an ArrayMesh surface', () => {
  it('binds the surface material’s albedo_texture', async () => {
    const tex = new THREE.Texture();
    const { node, mesh } = meshNode(inlineSurfacesWithMaterial('Mat_tex'));
    const { materials } = await renderMesh({ node, internal: [mesh, texturedMaterial], texture: tex });
    expect(materials[0]!.map?.source).toBe(tex.source);
  });

  it('draws the placeholder on the one surface whose texture is missing', async () => {
    const plain: TscnInternalResource = {
      id: 'Mat_plain',
      type: 'StandardMaterial3D',
      data: { albedo_color: 'Color(0, 0, 1, 1)' },
    };
    const { node, mesh } = meshNode(twoSurfaces('Mat_plain', 'Mat_tex'));
    const { materials } = await renderMesh({
      node,
      internal: [mesh, plain, texturedMaterial],
      texture: 'missing',
    });
    expect(materials.map(isMagenta)).toEqual([false, true]);
  });
});

describe('surface_material_override/N on an ArrayMesh', () => {
  it('replaces that surface’s own material and leaves the others', async () => {
    // mesh_instance_3d.cpp:395-400: the per-surface override is consulted
    // before the mesh surface's material, per index.
    const red: TscnInternalResource = {
      id: 'Mat_red',
      type: 'StandardMaterial3D',
      data: { albedo_color: 'Color(1, 0, 0, 1)' },
    };
    const blue: TscnInternalResource = {
      id: 'Mat_blue',
      type: 'StandardMaterial3D',
      data: { albedo_color: 'Color(0, 0, 1, 1)' },
    };
    const { node, mesh } = meshNode(twoSurfaces('Mat_blue', 'Mat_blue'), {
      surfaceMaterialOverrides: new Map([[1, 'SubResource("Mat_red")']]),
    });
    const { materials } = await renderMesh({
      node,
      internal: [mesh, red, blue],
      texture: new THREE.Texture(),
    });
    expect(materials.map((m) => m.color.getHex())).toEqual([0x0000ff, 0xff0000]);
  });

  it('yields to material_override, which covers every surface', async () => {
    const red: TscnInternalResource = {
      id: 'Mat_red',
      type: 'StandardMaterial3D',
      data: { albedo_color: 'Color(1, 0, 0, 1)' },
    };
    const green: TscnInternalResource = {
      id: 'Mat_green',
      type: 'StandardMaterial3D',
      data: { albedo_color: 'Color(0, 1, 0, 1)' },
    };
    const { node, mesh } = meshNode(twoSurfaces(null, null), {
      materialOverride: 'SubResource("Mat_green")',
      surfaceMaterialOverrides: new Map([[0, 'SubResource("Mat_red")']]),
    });
    const { materials } = await renderMesh({
      node,
      internal: [mesh, red, green],
      texture: new THREE.Texture(),
    });
    expect(materials.map((m) => m.color.getHex())).toEqual([0x00ff00, 0x00ff00]);
  });
});
