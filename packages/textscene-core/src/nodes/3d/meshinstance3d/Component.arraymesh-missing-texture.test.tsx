/**
 * An ArrayMesh surface whose own material names a texture that cannot load takes
 * the magenta missing-texture placeholder, as the one surface of a PrimitiveMesh
 * does. The other surfaces keep their own materials.
 */

import { describe, expect, it } from 'vitest';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { inlineTwoSurfaceMesh } from './testing/twoSurfaceMesh';
import { meshInstanceNode, renderMeshInstance, surfaceMaterials } from './testing/renderMeshInstance';
import type { TscnExternalResource, TscnInternalResource } from '../../../parser/types';

const MISSING_PATH = 'res://textures/missing.png';

const EXTERNALS: TscnExternalResource[] = [{ id: '1_tex', type: 'Texture2D', path: MISSING_PATH }];

const MATERIALS: TscnInternalResource[] = [
  { id: 'Mat_red', type: 'StandardMaterial3D', data: { albedo_color: 'Color(1, 0, 0, 1)' } },
  { id: 'Mat_missing', type: 'StandardMaterial3D', data: { albedo_texture: 'ExtResource("1_tex")' } },
];

const MAGENTA = 0xff00ff;

describe('<MeshInstance3D> ArrayMesh surface with a missing texture', () => {
  it("draws the magenta placeholder on the surface whose own material's texture is missing", async () => {
    const fake = createFakeResourceLoader();
    fake.textures.seed(MISSING_PATH, null);

    const renderer = await renderMeshInstance({
      loader: fake.loader,
      node: meshInstanceNode({ mesh: 'SubResource("Mesh_1")' }),
      internalResources: [inlineTwoSurfaceMesh('Mesh_1', ['Mat_red', 'Mat_missing']), ...MATERIALS],
      externalResources: EXTERNALS,
    });

    expect(surfaceMaterials(renderer).map((m) => m.color.getHex())).toEqual([0xff0000, MAGENTA]);
  });
});
