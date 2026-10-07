/**
 * An ArrayMesh surface whose material names a texture that cannot load takes the
 * magenta missing-texture placeholder, as the one surface of a PrimitiveMesh does.
 * The other surfaces keep their own materials.
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
import type { TscnExternalResource, TscnInternalResource, TscnNode } from '../../../parser/types';
import type { MeshInstance3DProperties } from './types';

const MISSING_PATH = 'res://textures/missing.png';

const EXTERNALS: TscnExternalResource[] = [{ id: '1_tex', type: 'Texture2D', path: MISSING_PATH }];

const MATERIALS: TscnInternalResource[] = [
  { id: 'Mat_red', type: 'StandardMaterial3D', data: { albedo_color: 'Color(1, 0, 0, 1)' } },
  { id: 'Mat_missing', type: 'StandardMaterial3D', data: { albedo_texture: 'ExtResource("1_tex")' } },
];

const MAGENTA = 0xff00ff;

function node(materialOverride?: string): TscnNode {
  const properties: MeshInstance3DProperties = {
    name: 'Baked',
    mesh: 'SubResource("Mesh_1")',
    surfaceMaterialOverrides: new Map(),
  };
  if (materialOverride) properties.materialOverride = materialOverride;
  return { name: 'Baked', type: 'MeshInstance3D', children: [], properties };
}

async function renderSurfaceColours(
  surfaceMaterialIds: readonly string[],
  materialOverride?: string
): Promise<number[]> {
  const fake = createFakeResourceLoader();
  fake.textures.seed(MISSING_PATH, null);
  const internalResources = [inlineTwoSurfaceMesh('Mesh_1', surfaceMaterialIds), ...MATERIALS];
  const renderer = await ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={fake.loader}>
      <SceneResourcesProvider internalResources={internalResources} externalResources={EXTERNALS}>
        <MeshInstance3D node={node(materialOverride)} />
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
  const materials = findMesh(renderer.scene).material as THREE.MeshStandardMaterial[];
  return materials.map((material) => material.color.getHex());
}

describe('<MeshInstance3D> ArrayMesh surface with a missing texture', () => {
  it("draws the magenta placeholder on the surface whose own material's texture is missing", async () => {
    const colours = await renderSurfaceColours(['Mat_red', 'Mat_missing']);

    expect(colours).toEqual([0xff0000, MAGENTA]);
  });

  it('draws the magenta placeholder on every surface when material_override has a missing texture', async () => {
    const colours = await renderSurfaceColours(['Mat_red', 'Mat_red'], 'SubResource("Mat_missing")');

    expect(colours).toEqual([MAGENTA, MAGENTA]);
  });
});
