/**
 * <GridMap> honours the MeshLibrary's per-tile `mesh_cast_shadow`. GridMap has
 * no `cast_shadow` of its own: it applies the library's setting to each item's
 * instance (`modules/gridmap/grid_map.cpp:799-800`).
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { standardMaterial } from '../../../resources/materials/standardmaterial3d/testing/standardMaterial';
import { castsFrom, depthSideOf, drawsColour } from '../../../r3f/testing/threePasses';
import { renderInstancedTile } from './testing/gridMapCorpus';

const renderTile = (itemLines: string) => renderInstancedTile({ itemLines });

describe('<GridMap> per-tile mesh_cast_shadow', () => {
  it('casts by default, as Godot does with the key absent', async () => {
    const tile = await renderTile('');
    expect(tile.castShadow).toBe(true);
    expect(tile.receiveShadow).toBe(true);
  });

  it('OFF stops that tile casting', async () => {
    expect((await renderTile('item/0/mesh_cast_shadow = 0')).castShadow).toBe(false);
  });

  it('DOUBLE_SIDED draws both faces into the depth pass', async () => {
    const tile = await renderTile('item/0/mesh_cast_shadow = 2');
    expect(tile.castShadow).toBe(true);
    expect(depthSideOf(tile)).toBe(THREE.DoubleSide);
  });

  it('keeps the tile material’s own cull for every other value', async () => {
    // `render_forward_clustered.cpp:395-411`: only DOUBLE_SIDED drops the cull, and
    // every other value undoes three's acne flip (`WebGLShadowMap.js:51`).
    const tile = await renderTile('item/0/mesh_cast_shadow = 1');
    expect(depthSideOf(tile)).toBe(THREE.FrontSide);
  });

  it('SHADOWS_ONLY casts but draws no colour', async () => {
    const tile = await renderTile('item/0/mesh_cast_shadow = 3');
    expect(tile.castShadow).toBe(true);
    expect(drawsColour(tile)).toBe(false);
  });

  it('SHADOWS_ONLY keeps the tile material, so the shadow pass reads its own state', async () => {
    const tile = await renderTile('item/0/mesh_cast_shadow = 3');
    expect((tile.material as THREE.Material).colorWrite).toBe(true);
  });

  it('casts nothing from a tile whose material leaves the shadow pass', async () => {
    // Godot's per-surface FLAG_PASS_SHADOW (`render_forward_clustered.cpp:4078-4088`)
    // applies to a GridMap's tiles as to any GeometryInstance3D surface.
    const tile = await renderTile('');
    tile.material = standardMaterial({ transparency: '1' });
    expect(castsFrom(tile)).toBe(false);
  });

  it('never writes the tile’s setting onto the shared tile material', async () => {
    const tile = await renderTile('item/0/mesh_cast_shadow = 2');
    expect((tile.material as THREE.Material).shadowSide).toBeNull();
  });
});
