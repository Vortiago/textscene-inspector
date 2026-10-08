/**
 * Each rendering quadrant of a tile layer is a canvas item of its own, so it declares its own
 * lit item to the per-item light cap and draws after the quadrant before it.
 */
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { TileQuadrants } from './TileQuadrants';
import { ResourceLoaderProvider } from '../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../resources/testing/createFakeResourceLoader';
import { CanvasLighting2DContext, INERT_CANVAS_LIGHTING } from './lighting2d/lightPassContext';
import type { CappedItem } from './lighting2d/itemLightCap';
import type { PlacedCell } from '../nodes/2d/tiles/shared/tileData';
import type { AtlasSourceModel, AtlasTileModel, TileSetModel } from '../resources/tileset/types';

const BASE_TILE: AtlasTileModel = {
  sizeInAtlas: { x: 1, y: 1 },
  alternatives: new Map([
    [0, { flipH: false, flipV: false, transpose: false, textureOrigin: { x: 0, y: 0 } }],
  ]),
};

function atlasSource(id: number): AtlasSourceModel {
  return {
    texturePath: `res://source${id}.png`,
    margins: { x: 0, y: 0 },
    separation: { x: 0, y: 0 },
    textureRegionSize: { x: 16, y: 16 },
    tiles: new Map([['0:0', BASE_TILE]]),
  };
}

/** A square 16 px tileset with atlas sources 0 and 1. */
const MODEL: TileSetModel = {
  shape: 0,
  layout: 0,
  offsetAxis: 0,
  tileSize: { x: 16, y: 16 },
  sources: new Map([
    [0, atlasSource(0)],
    [1, atlasSource(1)],
  ]),
};

function cell(sourceId: number, x: number, y: number): PlacedCell {
  return { coords: { x, y }, sourceId, atlasCoords: { x: 0, y: 0 }, alternativeId: 0 };
}

const TINT = { color: new THREE.Color(1, 1, 1), opacity: 1 };

function render(quadrants: readonly (readonly PlacedCell[])[], zFinal = 0) {
  const fake = createFakeResourceLoader();
  for (const id of MODEL.sources.keys()) {
    const texture = new THREE.Texture();
    (texture as unknown as { image: { width: number; height: number } }).image = { width: 16, height: 16 };
    fake.textures.seed(`res://source${id}.png`, texture);
  }
  const registerCappedItem = vi.fn((_item: CappedItem) => () => {});
  const lighting = { ...INERT_CANVAS_LIGHTING, registerCappedItem };
  const wrap = (children: ReactNode) => (
    <ResourceLoaderProvider loader={fake.loader}>
      <CanvasLighting2DContext.Provider value={lighting}>{children}</CanvasLighting2DContext.Provider>
    </ResourceLoaderProvider>
  );
  const tree = ReactThreeTestRenderer.create(
    wrap(
      <TileQuadrants
        quadrants={quadrants}
        model={MODEL}
        tint={TINT}
        material={null}
        lightMask={1}
        zFinal={zFinal}
        name="Layer"
      />
    )
  );
  return { tree, registerCappedItem };
}

const meshOrders = (renderer: Awaited<ReturnType<typeof render>['tree']>) =>
  renderer.scene.findAllByType('Mesh').map((mesh) => (mesh.instance as THREE.Mesh).renderOrder);

describe('<TileQuadrants>', () => {
  it('declares one lit item per quadrant', async () => {
    const { tree, registerCappedItem } = render([[cell(0, 0, 0)], [cell(0, 16, 0)], [cell(1, 0, 16)]]);
    await tree;
    expect(registerCappedItem).toHaveBeenCalledTimes(3);
  });

  it("declares each quadrant at the layer's z_final", async () => {
    const { tree, registerCappedItem } = render([[cell(0, 0, 0)]], 3);
    await tree;
    expect(registerCappedItem.mock.calls[0]![0].placement.z).toBe(3);
  });

  it('draws every batch of a quadrant after the batches of the quadrant before it', async () => {
    const { tree } = render([[cell(0, 0, 0), cell(1, 1, 0)], [cell(0, 16, 0)]]);
    expect(meshOrders(await tree)).toEqual([0, 1, 2]);
  });

  it("draws a quadrant's cells in order across sources, one batch per run of a source", async () => {
    const { tree } = render([[cell(0, 0, 0), cell(1, 1, 0), cell(0, 2, 0)]]);
    const meshes = (await tree).scene.findAllByType('Mesh').map((mesh) => mesh.instance as THREE.Mesh);
    const quadCounts = meshes.map((mesh) => mesh.geometry.getAttribute('position').count / 4);
    expect(meshes.map((mesh) => mesh.renderOrder)).toEqual([0, 1, 2]);
    expect(quadCounts).toEqual([1, 1, 1]);
  });

  it('declares no lit item for a layer with no quadrant', async () => {
    const { tree, registerCappedItem } = render([]);
    await tree;
    expect(registerCappedItem).not.toHaveBeenCalled();
  });
});
