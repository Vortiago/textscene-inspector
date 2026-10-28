/**
 * <GridMap> tiles whose ArrayMesh `.tres` carries its own surface materials as
 * `[sub_resource]`s. GridMap feeds each of `ArrayMeshResource.materialPaths` into its
 * surface's `SurfaceMaterialSlot`, which loads it as any material, so the **Sub-resource path**
 * seam needs no per-consumer case.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { act } from 'react';
import { fakeTiledUploads } from '../../../r3f/tiledUpload/fakeTiledUploads.testkit';
import { DEFAULT_MATERIAL_ROUGHNESS } from '../../../godot/rendering/materials/defaultMaterial';
import { pendingMapStandIn } from '../../../r3f/materials/pendingMapStandIn';
import { isInstancedMesh } from '../../../r3f/testing/threeNarrow';
import { unconfiguredViewportTexture } from '../../../resources/textures/viewporttexture/unconfiguredViewportTexture';
import {
  drawnMaterials,
  mountGridMap,
  renderInstancedTile,
  renderInstancedTiles,
} from './testing/gridMapCorpus';

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
  it('draws each surface in its own batch, with its own material', async () => {
    const batches = await renderInstancedTiles({
      materialLines: 'albedo_color = Color(1, 0, 0, 1)',
      secondMaterialLines: 'albedo_color = Color(0, 0, 1, 1)',
    });
    const colours = batches.map((batch) => drawnMaterials(batch).map((m) => m.color.getHex()));
    expect(colours).toEqual([[0xff0000], [0x0000ff]]);
  });

  it("draws Godot's default material on a surface that names none, beside one that does", async () => {
    const [unset, blue] = (
      await renderInstancedTiles({ secondMaterialLines: 'albedo_color = Color(0, 0, 1, 1)' })
    ).map((batch) => drawnMaterials(batch)[0]!);
    expect(unset!.roughness).toBeCloseTo(DEFAULT_MATERIAL_ROUGHNESS, 5);
    expect(blue!.color.getHex()).toBe(0x0000ff);
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
      gridMap.tiles().find(isInstancedMesh)?.material as THREE.MeshStandardMaterial | undefined;

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

/** A ViewportTexture in the tile material, which Godot sets up only through local holders. */
const LOCAL_VIEWPORT_TILE = {
  subResources: `[sub_resource type="ViewportTexture" id="Viewport"]
viewport_path = NodePath("SubViewport")

`,
  materialLines: 'resource_local_to_scene = true\nalbedo_texture = SubResource("Viewport")',
  meshLines: 'resource_local_to_scene = true',
};

describe('<GridMap> tile material with a ViewportTexture', () => {
  /**
   * The MeshLibrary is the node's property, so Godot sets up the tile material only through a
   * library that is local to scene (`core/io/resource.cpp:497-503`).
   */
  it("draws Godot's placeholder when the library is not local to scene", async () => {
    const tile = await renderInstancedTile(LOCAL_VIEWPORT_TILE);
    expect((tile.material as THREE.MeshStandardMaterial).map?.image).toBe(
      unconfiguredViewportTexture().image
    );
  });

  it('looks the viewport up when the library is local to scene, so a missing one leaves the slot empty', async () => {
    const tile = await renderInstancedTile({
      ...LOCAL_VIEWPORT_TILE,
      itemLines: 'resource_local_to_scene = true',
    });
    expect((tile.material as THREE.MeshStandardMaterial).map).toBeNull();
  });
});
