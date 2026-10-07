/**
 * A scene-local StandardMaterial3D resolves its texture slots on every surface:
 * `_update_shader` emits the same samplers for each (`scene/resources/material.cpp`).
 * It runs on a multi-surface mesh, since a PrimitiveMesh has one surface
 * (`testing/twoSurfaceMesh.ts`).
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { inlineTwoSurfaceMesh } from './testing/twoSurfaceMesh';
import { meshInstanceNode, renderMeshInstance, surfaceMaterials } from './testing/renderMeshInstance';
import { wallQuadSurfaces } from '../../../resources/testing/arrayMeshSurfaces';
import type { TscnExternalResource, TscnInternalResource } from '../../../parser/types';

const ALBEDO_PATH = 'res://textures/albedo.png';
const NORMAL_PATH = 'res://textures/normal.png';

const EXTERNALS: TscnExternalResource[] = [
  { id: '1_tex', type: 'Texture2D', path: ALBEDO_PATH },
  { id: '2_nrm', type: 'Texture2D', path: NORMAL_PATH },
];

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
  return renderMeshInstance({
    loader: fake.loader,
    node: meshInstanceNode({ mesh: 'SubResource("Mesh_1")', surfaceOverrides: opts.overrides }),
    internalResources,
    externalResources: EXTERNALS,
  });
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
    const materials = surfaceMaterials(renderer);
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
    const materials = surfaceMaterials(renderer);
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
    const materials = surfaceMaterials(renderer);
    expect(materials[0]!.map).toBeInstanceOf(THREE.Texture);
    expect(materials[1]!.map).toBeInstanceOf(THREE.Texture);
  });
});

describe("inline ArrayMesh surfaces resolve their scene material's textures", () => {
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
          _surfaces: wallQuadSurfaces({ material: 'SubResource("Mat_tex")', name: 's0' }),
        },
      },
      {
        id: 'Mat_tex',
        type: 'StandardMaterial3D',
        data: { albedo_texture: 'ExtResource("1_tex")' },
      },
    ];
    const renderer = await renderMeshInstance({
      loader: fake.loader,
      node: meshInstanceNode({ mesh: 'SubResource("Mesh_1")' }),
      internalResources,
      externalResources: EXTERNALS,
    });
    const [material] = surfaceMaterials(renderer);
    expect(material!.map).toBeInstanceOf(THREE.Texture);
  });
});
