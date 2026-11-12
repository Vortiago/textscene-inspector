/**
 * A MeshLibrary tile whose surface material carries a `next_pass` chain: the link
 * draws as another instanced batch of the same cells, sharing the geometry and the
 * instance matrices, in chain order after the surface's own draw.
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

  it('draws each surface of a two-surface tile its own link, beside only its own draw group', async () => {
    // A tile whose surfaces both chain: each link attaches at its surface's own draw
    // group, over the part's real surface count, and the two links draw at their
    // surface's ordinal, not one over the other's group.
    const batches = await renderInstancedTiles({
      subResources:
        '[sub_resource type="StandardMaterial3D" id="LinkRed"]\nalbedo_color = Color(0, 0, 1, 1)\n\n' +
        '[sub_resource type="StandardMaterial3D" id="LinkYellow"]\nalbedo_color = Color(1, 1, 0, 1)\n\n',
      materialLines: 'albedo_color = Color(1, 0, 0, 1)\nnext_pass = SubResource("LinkRed")',
      secondMaterialLines: 'albedo_color = Color(0, 1, 0, 1)\nnext_pass = SubResource("LinkYellow")',
    });

    expect(batches).toHaveLength(4);
    const [ownFirst, ownSecond, linkFirst, linkSecond] = batches;
    expect(drawnMaterials(ownFirst!).map((m) => m.color.getHex())).toEqual([0xff0000]);
    expect(drawnMaterials(ownSecond!).map((m) => m.color.getHex())).toEqual([0x00ff00]);
    // The link's mount knows the item's two draw groups: its material is the group's
    // array, with the link in its own group and the other stay-invisible slots.
    expect(drawnMaterials(linkFirst!).map((m) => m.color.getHex())).toEqual([0x0000ff]);
    expect(drawnMaterials(linkSecond!).map((m) => m.color.getHex())).toEqual([0xffff00]);
    expect(Array.isArray(linkFirst!.material)).toBe(true);
    expect(Array.isArray(linkSecond!.material)).toBe(true);
    // The same tile geometry and cell count as the surface's own batch.
    expect(linkFirst!.geometry).toBe(ownFirst!.geometry);
    expect(linkFirst!.count).toBe(ownFirst!.count);
    expect(linkSecond!.count).toBe(ownSecond!.count);
    // Each surface's link draws at its surface's ordinal.
    expect(linkFirst!.renderOrder).toBe(nextPassRenderOrder(1));
    expect(linkSecond!.renderOrder).toBe(nextPassRenderOrder(1));
  });
});
