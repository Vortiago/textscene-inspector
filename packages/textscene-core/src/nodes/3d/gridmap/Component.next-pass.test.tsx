/**
 * A MeshLibrary tile whose surface material carries a `next_pass` chain: GridMap hands the
 * tile's materials to the surfaced mesh drawer, which draws the link at the same cells.
 */
import { describe, expect, it } from 'vitest';
import { drawnMaterials, renderInstancedTiles } from './testing/gridMapCorpus';
import { nextPassRenderOrder } from '../../../r3f/materials/passOrder';

const LINKED_TILE = {
  subResources: '[sub_resource type="StandardMaterial3D" id="Link"]\nalbedo_color = Color(0, 0, 1, 1)\n\n',
  materialLines: 'albedo_color = Color(1, 0, 0, 1)\nnext_pass = SubResource("Link")',
};

describe('<GridMap> tile material with a next_pass chain', () => {
  it('draws the chain link of a cell material as another instanced batch of the cells', async () => {
    const batches = await renderInstancedTiles(LINKED_TILE);

    expect(batches).toHaveLength(2);
    const [own, link] = batches;
    expect(drawnMaterials(own!).map((m) => m.color.getHex())).toEqual([0xff0000]);
    expect(drawnMaterials(link!).map((m) => m.color.getHex())).toEqual([0x0000ff]);
    // The same tile geometry, the same cells, drawn after the surface's own batch.
    expect(link!.geometry).toBe(own!.geometry);
    expect(link!.count).toBe(own!.count);
    expect(link!.renderOrder).toBe(nextPassRenderOrder(1));
  });
});
