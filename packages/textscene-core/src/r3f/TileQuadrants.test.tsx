/**
 * Each rendering quadrant of a tile layer is one or more canvas items, each split off at a change
 * of tile material or `z_index`. Each declares its own lit item to the per-item light cap and draws
 * after the item before it, in its own z bucket and with its own material.
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
import { drawableCells } from '../resources/tileset/drawableCell';
import { decodeCanvasItemMaterial } from '../resources/materials/canvasitemmaterial/decode';
import {
  defaultTileData,
  type AlternativeTileModel,
  type AtlasSourceModel,
  type AtlasTileModel,
  type TileSetModel,
} from '../resources/tileset/types';
import { CanvasItemKeyProvider } from './components/CanvasItemGroup';
import { canvasRenderOrder } from './canvasPaintOrder';
import { CanvasModulateContext } from './canvasModulate';
import { WHITE_MODULATE, type RGBA } from './canvasItemModulate';
import {
  CanvasItemBlendMode,
  CanvasItemLightMode,
  type CanvasItemMaterialProperties,
} from '../resources/materials/canvasitemmaterial/types';

function canvasItemMaterial(overrides: Partial<CanvasItemMaterialProperties>): CanvasItemMaterialProperties {
  return { ...decodeCanvasItemMaterial({}), ...overrides };
}

const ADD = canvasItemMaterial({ blendMode: CanvasItemBlendMode.ADD });
const UNSHADED = canvasItemMaterial({ lightMode: CanvasItemLightMode.UNSHADED });

/**
 * The tile at atlas (0, 0): alternative 0 at TileData defaults, 1 at z_index 2, 2 with an additive
 * material, 3 with a ShaderMaterial, 4 with an unshaded material and 5 tinted red.
 */
const ALTERNATIVES: Partial<AlternativeTileModel>[] = [
  {},
  { zIndex: 2 },
  { material: { properties: ADD } },
  { material: { properties: null } },
  { material: { properties: UNSHADED } },
  { modulate: { r: 1, g: 0, b: 0, a: 1 } },
];

const BASE_TILE: AtlasTileModel = {
  sizeInAtlas: { x: 1, y: 1 },
  alternatives: new Map(ALTERNATIVES.map((data, altId) => [altId, { ...defaultTileData(), ...data }])),
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

/** A square 16 px tileset with atlas sources 0 and 1, and source 2, which names no texture. */
const MODEL: TileSetModel = {
  shape: 0,
  layout: 0,
  offsetAxis: 0,
  tileSize: { x: 16, y: 16 },
  sources: new Map([
    [0, atlasSource(0)],
    [1, atlasSource(1)],
    [2, { ...atlasSource(2), texturePath: '' }],
  ]),
};

function cell(sourceId: number, x: number, y: number, alternativeId = 0): PlacedCell {
  return { coords: { x, y }, sourceId, atlasCoords: { x: 0, y: 0 }, alternativeId };
}

/** The layer's canvas key: the world canvas at its `z_final`, fifth in the draw walk. */
const layerKey = (zFinal: number) => canvasRenderOrder({ layerRank: 0, zFinal, sequence: 5 });

interface Layer {
  zFinal?: number;
  material?: CanvasItemMaterialProperties | null;
  canvasModulate?: RGBA;
}

function render(
  quadrants: readonly (readonly PlacedCell[])[],
  { zFinal = 0, material = null, canvasModulate = WHITE_MODULATE }: Layer = {}
) {
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
      <CanvasLighting2DContext.Provider value={lighting}>
        <CanvasModulateContext.Provider value={canvasModulate}>
          <CanvasItemKeyProvider value={layerKey(zFinal)}>{children}</CanvasItemKeyProvider>
        </CanvasModulateContext.Provider>
      </CanvasLighting2DContext.Provider>
    </ResourceLoaderProvider>
  );
  const tree = ReactThreeTestRenderer.create(
    wrap(
      <TileQuadrants
        quadrants={quadrants.map((cells) => drawableCells(MODEL, cells))}
        model={MODEL}
        selfTint={WHITE_MODULATE}
        material={material}
        lightMask={1}
        zFinal={zFinal}
        name="Layer"
      />
    )
  );
  return { tree, registerCappedItem };
}

type Rendered = Awaited<ReturnType<typeof render>['tree']>;

const meshesOf = (renderer: Rendered) =>
  renderer.scene.findAllByType('Mesh').map((mesh) => mesh.instance as THREE.Mesh);

const meshOrders = (renderer: Rendered) => meshesOf(renderer).map((mesh) => mesh.renderOrder);

const materialsOf = (renderer: Rendered) =>
  meshesOf(renderer).map((mesh) => mesh.material as THREE.MeshBasicMaterial);

/** The canvas key three sorts a mesh by: the `renderOrder` of its nearest enclosing group. */
function canvasKeyOf(mesh: THREE.Object3D): number | undefined {
  for (let node = mesh.parent; node; node = node.parent) {
    if ((node as THREE.Group).isGroup) return node.renderOrder;
  }
  return undefined;
}

describe('<TileQuadrants>', () => {
  it('declares one lit item per quadrant', async () => {
    const { tree, registerCappedItem } = render([[cell(0, 0, 0)], [cell(0, 16, 0)], [cell(1, 0, 16)]]);
    await tree;
    expect(registerCappedItem).toHaveBeenCalledTimes(3);
  });

  it("declares each quadrant at the layer's z_final", async () => {
    const { tree, registerCappedItem } = render([[cell(0, 0, 0)]], { zFinal: 3 });
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

  it("declares a tile with its own z_index at the layer's z_final plus it", async () => {
    const { tree, registerCappedItem } = render([[cell(0, 0, 0), cell(0, 1, 0, 1)]], { zFinal: 3 });
    await tree;
    expect(registerCappedItem.mock.calls.map((call) => call[0].placement.z)).toEqual([3, 5]);
  });

  it("draws a tile with its own z_index in that z's bucket, at the layer's place in the walk", async () => {
    const meshes = meshesOf(await render([[cell(0, 0, 0), cell(0, 1, 0, 1)]], { zFinal: 3 }).tree);
    expect(meshes.map(canvasKeyOf)).toEqual([layerKey(3), layerKey(5)]);
  });

  it("draws a missing-texture placeholder in its tile's z bucket, not the layer's", async () => {
    const meshes = meshesOf(await render([[cell(0, 0, 0), cell(2, 1, 0, 1)]], { zFinal: 3 }).tree);
    expect(meshes.map(canvasKeyOf)).toEqual([layerKey(3), layerKey(5)]);
  });

  it('draws a tile with its own CanvasItemMaterial with its blend mode', async () => {
    const [base, additive] = materialsOf(await render([[cell(0, 0, 0), cell(0, 1, 0, 2)]]).tree);
    expect(base!.blending).toBe(THREE.NormalBlending);
    expect(additive!.blending).toBe(THREE.CustomBlending);
  });

  it("draws a tile with a material it cannot read with plain blending, not the layer's", async () => {
    const [shader] = materialsOf(await render([[cell(0, 0, 0, 3)]], { material: ADD }).tree);
    expect(shader!.blending).toBe(THREE.NormalBlending);
  });

  it("draws a tile with no material of its own with the layer's", async () => {
    const [base] = materialsOf(await render([[cell(0, 0, 0)]], { material: ADD }).tree);
    expect(base!.blending).toBe(THREE.CustomBlending);
  });

  it("tints a tile by the canvas modulate only when its own material's light mode admits it", async () => {
    const canvasModulate = { r: 0.5, g: 0.5, b: 0.5, a: 1 };
    const [shaded, unshaded] = materialsOf(
      await render([[cell(0, 0, 0), cell(0, 1, 0, 4)]], { canvasModulate }).tree
    );
    expect(shaded!.color.r).toBeCloseTo(0.214041, 5);
    expect(unshaded!.color.r).toBe(1);
  });

  it("multiplies each tile's modulate onto its pixels through the vertex colours", async () => {
    const [mesh] = meshesOf(await render([[cell(0, 0, 0, 5)]]).tree);
    expect((mesh!.material as THREE.MeshBasicMaterial).vertexColors).toBe(true);
    expect(Array.from(mesh!.geometry.getAttribute('color').array.slice(0, 4))).toEqual([1, 0, 0, 1]);
  });
});
