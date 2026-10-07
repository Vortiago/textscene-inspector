/**
 * <GridMap> tiles whose ArrayMesh `.tres` carries its own surface materials as
 * `[sub_resource]`s. GridMap feeds each of `ArrayMeshResource.materialPaths` into a
 * `SurfaceMaterialSlot`, which loads it as any material, so the **Sub-resource path**
 * seam needs no per-consumer case.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { act } from 'react';
import { fakeTiledUploads } from '../../../r3f/tiledUpload/fakeTiledUploads.testkit';
import { pendingMapStandIn } from '../../../r3f/materials/pendingMapStandIn';
import { mountGridMap, renderInstancedTile } from './testing/gridMapCorpus';

describe('<GridMap> tile with the ArrayMesh’s own surface material', () => {
  it('tints the instanced tile with the material inside the tile mesh’s .tres', async () => {
    const tile = await renderInstancedTile({
      materialLines: 'albedo_color = Color(0, 1, 0, 1)\nroughness = 0.25',
    });
    const material = tile.material as THREE.MeshStandardMaterial;
    // Straight off the sub-resource body: Color(0, 1, 0, 1) and roughness 0.25.
    expect(material.color.getHex()).toBe(0x00ff00);
    expect(material.roughness).toBe(0.25);
  });
});

describe('<GridMap> tile of two surfaces', () => {
  it('binds each surface its own material in the batch', async () => {
    const tile = await renderInstancedTile({
      materialLines: 'albedo_color = Color(1, 0, 0, 1)',
      secondMaterialLines: 'albedo_color = Color(0, 0, 1, 1)',
    });
    const materials = tile.material as THREE.MeshStandardMaterial[];
    expect(materials.map((m) => m.color.getHex())).toEqual([0xff0000, 0x0000ff]);
  });
});

/** A map written in the tile mesh's own file, which the tile material names. */
const RAMP = `[sub_resource type="Gradient" id="Gradient_g"]
colors = PackedColorArray(1, 1, 1, 1, 0, 0, 0, 1)

[sub_resource type="GradientTexture2D" id="Ramp"]
gradient = SubResource("Gradient_g")
width = 8
height = 4

`;

describe('<GridMap> tile material textures', () => {
  it("uploads the tile material's map in bands, as every other material slot does", async () => {
    const uploads = fakeTiledUploads();
    const gridMap = await mountGridMap({
      subResources: RAMP,
      materialLines: 'albedo_texture = SubResource("Ramp")',
      wrapper: uploads.wrapper,
    });
    const tileMaterial = () =>
      gridMap.tiles().find((o): o is THREE.InstancedMesh => o instanceof THREE.InstancedMesh)?.material as
        THREE.MeshStandardMaterial | undefined;

    expect(tileMaterial()?.map).toBe(pendingMapStandIn('albedo_texture'));
    expect(uploads.pending).toHaveLength(1);

    await act(async () => {
      uploads.pending.forEach((upload) => upload.finish(true));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(tileMaterial()?.map).toBeInstanceOf(THREE.Texture);
    expect(tileMaterial()?.map).not.toBe(pendingMapStandIn('albedo_texture'));
  });
});
