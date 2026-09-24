/**
 * A scene-local StandardMaterial3D resolves its texture slots on every surface:
 * `_update_shader` emits the same samplers for each (`scene/resources/material.cpp`).
 * It runs on a multi-surface mesh, since a PrimitiveMesh has one surface
 * (`testing/twoSurfaceMesh.ts`).
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { MeshInstance3D } from './Component';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { findMesh } from '../testing/reactThreeTestInstance';
import { inlineTwoSurfaceMesh } from './testing/twoSurfaceMesh';
import type {
  TscnExternalResource,
  TscnInternalResource,
  TscnNode,
} from '../../../parser/types';
import type { MeshInstance3DProperties } from './types';

const ALBEDO_PATH = 'res://textures/albedo.png';
const NORMAL_PATH = 'res://textures/normal.png';

const EXTERNALS: TscnExternalResource[] = [
  { id: '1_tex', type: 'Texture2D', path: ALBEDO_PATH },
  { id: '2_nrm', type: 'Texture2D', path: NORMAL_PATH },
];

function node(overrides: Map<number, string>): TscnNode {
  const properties: MeshInstance3DProperties = {
    name: 'Panel',
    mesh: 'SubResource("Mesh_1")',
    surfaceMaterialOverrides: overrides,
  };
  return { name: 'Panel', type: 'MeshInstance3D', children: [], properties };
}

async function render(opts: {
  overrides: Map<number, string>;
  materials: Record<string, Record<string, string>>;
  seeded?: string[];
}) {
  const fake = createFakeResourceLoader();
  for (const path of opts.seeded ?? [ALBEDO_PATH, NORMAL_PATH]) {
    const texture = new THREE.Texture();
    texture.needsUpdate = false;
    fake.textures.seed(path, texture);
  }
  const internalResources: TscnInternalResource[] = [
    inlineTwoSurfaceMesh('Mesh_1'),
    ...Object.entries(opts.materials).map(([id, data]) => ({
      id,
      type: 'StandardMaterial3D',
      data,
    })),
  ];
  return ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={fake.loader}>
      <SceneResourcesProvider
        internalResources={internalResources}
        externalResources={EXTERNALS}
      >
        <MeshInstance3D node={node(opts.overrides)} />
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
}

describe('scene material texture slots past surface 0', () => {
  it('drops a gated slot whose feature flag is off, on every surface', async () => {
    const renderer = await render({
      overrides: new Map([
        [0, 'SubResource("Gated")'],
        [1, 'SubResource("Gated")'],
      ]),
      materials: {
        // No `normal_enabled`: Godot's `_update_shader` emits the normal
        // sampler only inside `if (features[FEATURE_NORMAL_MAPPING])`.
        Gated: { albedo_texture: 'ExtResource("1_tex")', normal_texture: 'ExtResource("2_nrm")' },
      },
    });
    const materials = findMesh(renderer.scene).material as THREE.MeshStandardMaterial[];
    expect(materials[0]!.map).toBeInstanceOf(THREE.Texture);
    expect(materials[0]!.normalMap).toBeNull();
    expect(materials[1]!.normalMap).toBeNull();
  });

  it('keeps a gated slot whose feature flag is on', async () => {
    const renderer = await render({
      overrides: new Map([[1, 'SubResource("Enabled")']]),
      materials: {
        Enabled: { normal_enabled: 'true', normal_texture: 'ExtResource("2_nrm")' },
      },
    });
    const materials = findMesh(renderer.scene).material as THREE.MeshStandardMaterial[];
    expect(materials[1]!.normalMap).toBeInstanceOf(THREE.Texture);
  });

  it('binds albedo_texture on surface 1 as it does on surface 0', async () => {
    const renderer = await render({
      overrides: new Map([
        [0, 'SubResource("Mat")'],
        [1, 'SubResource("Mat")'],
      ]),
      materials: { Mat: { albedo_texture: 'ExtResource("1_tex")' } },
    });
    const materials = findMesh(renderer.scene).material as THREE.MeshStandardMaterial[];
    expect(materials[0]!.map).toBeInstanceOf(THREE.Texture);
    expect(materials[1]!.map).toBeInstanceOf(THREE.Texture);
  });
});

/** A quad's worth of surface bytes, copied from the ArrayMesh override fixtures. */
const QUAD_BODY = `"aabb": AABB(-1, -1, 1, 2, 2, 1.001358e-05),
"attribute_data": PackedByteArray("AAAAAAAAgD4AAIA+AACAPgAAgD4AAAAAAAAAAAAAAAA="),
"format": 34359742487,
"index_count": 6,
"index_data": PackedByteArray("AgAAAAMAAgABAAAA"),
"primitive": 3,
"uv_scale": Vector4(0, 0, 0, 0),
"vertex_count": 4,
"vertex_data": PackedByteArray("AACAvwAAgL8AAIA/AACAPwAAgL8AAIA/AACAPwAAgD8AAIA/AACAvwAAgD8AAIA//3//f////7//f/9/////v/9//3////+//3//f////78=")`;


describe('inline ArrayMesh surfaces resolve their scene material\'s textures', () => {
  it('binds albedo_texture on a surface whose material is a scene sub-resource', async () => {
    const fake = createFakeResourceLoader();
    const texture = new THREE.Texture();
    texture.needsUpdate = false;
    fake.textures.seed(ALBEDO_PATH, texture);

    const internalResources: TscnInternalResource[] = [
      {
        id: 'Mesh_1',
        type: 'ArrayMesh',
        data: {
          _surfaces: `[{\n${QUAD_BODY},\n"material": SubResource("Mat_tex"),\n"name": "s0"\n}]`,
        },
      },
      {
        id: 'Mat_tex',
        type: 'StandardMaterial3D',
        data: { albedo_texture: 'ExtResource("1_tex")' },
      },
    ];
    const properties: MeshInstance3DProperties = {
      name: 'Baked',
      mesh: 'SubResource("Mesh_1")',
      surfaceMaterialOverrides: new Map(),
    };
    const renderer = await ReactThreeTestRenderer.create(
      <ResourceLoaderProvider loader={fake.loader}>
        <SceneResourcesProvider
          internalResources={internalResources}
          externalResources={EXTERNALS}
        >
          <MeshInstance3D
            node={{ name: 'Baked', type: 'MeshInstance3D', children: [], properties }}
          />
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    );
    const material = findMesh(renderer.scene).material as THREE.MeshStandardMaterial;
    expect(material.map).toBeInstanceOf(THREE.Texture);
  });
});
