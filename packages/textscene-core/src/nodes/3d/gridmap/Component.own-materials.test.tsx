/**
 * <GridMap> tiles whose ArrayMesh `.tres` carries its own surface material as a
 * `[sub_resource]`. GridMap feeds `ArrayMeshResource.materialPaths[0]` into
 * `useResource(path, 'material')`, so the **Sub-resource path** seam needs no
 * per-consumer case. A red here with `Component.arraymesh.test.tsx` green means one grew.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { renderInstancedTile } from './testing/gridMapCorpus';

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
