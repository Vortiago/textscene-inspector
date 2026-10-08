/**
 * End-to-end against the vendored isometric dungeon (scenes/isometric/):
 * dungeon.tscn parses, tileset.tres resolves (5 atlas sources, ISOMETRIC
 * DIAMOND_DOWN 128×64), known cells decode to hand-computed `map_to_local`
 * centres, and a layer renders batched meshes, one lit item per rendering quadrant.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { TscnParser } from '../../../../parser/TscnParser';
import { parseTresFile } from '../../../../parser/parsedResource';
import { tileSetFromTres } from '../../../../resources/tileset/decode';
import { mapToLocalPx } from '../../../../resources/tileset/tilePlacement';
import { TileMapLayer } from './Component';
import { SceneResourcesProvider } from '../../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../../resources/testing/createFakeResourceLoader';
import { findByType } from './findByType';
import { layerQuadrants } from '../../../../resources/tileset/renderingQuadrants';
import { CanvasLighting2DContext, INERT_CANVAS_LIGHTING } from '../../../../r3f/lighting2d/lightPassContext';
import type { CappedItem } from '../../../../r3f/lighting2d/itemLightCap';
import type { TileMapLayerProperties } from './types';

const here = dirname(fileURLToPath(import.meta.url));
const isoRoot = resolve(here, '../../../../../../../scenes/isometric');
const dungeonContent = readFileSync(resolve(isoRoot, 'dungeon.tscn'), 'utf8');
const tilesetContent = readFileSync(resolve(isoRoot, 'tileset/tileset.tres'), 'utf8');

describe('isometric dungeon integration', () => {
  const scene = new TscnParser().parse(dungeonContent);
  const layers = findByType(scene.nodes, 'TileMapLayer');

  it('parses the dungeon: four TileMapLayer nodes with decoded cells', () => {
    expect(layers).toHaveLength(4);
    for (const layer of layers) {
      const props = layer.properties as TileMapLayerProperties;
      expect(props.cells).not.toBeNull();
      expect(props.cells!.length).toBeGreaterThan(0);
    }
  });

  it('resolves the real tileset.tres: 5 atlas sources, ISOMETRIC DIAMOND_DOWN 128×64', () => {
    const model = tileSetFromTres(parseTresFile(tilesetContent));
    expect(model).not.toBeNull();
    expect(model!.shape).toBe(1);
    expect(model!.layout).toBe(5);
    expect(model!.tileSize).toEqual({ x: 128, y: 64 });
    expect(model!.sources.size).toBe(5);
    for (const source of model!.sources.values()) {
      expect(source.texturePath).toBe('res://tileset/isotiles.png');
    }
  });

  it('decodes the floor layer and places its first cells at hand-computed centers', () => {
    const floor = layers.find((l) => l.name === 'Layer0')!;
    const cells = (floor.properties as TileMapLayerProperties).cells!;
    expect(cells[0]).toEqual({
      coords: { x: 11, y: -14 },
      sourceId: 0,
      atlasCoords: { x: 0, y: 0 },
      alternativeId: 0,
    });

    const model = tileSetFromTres(parseTresFile(tilesetContent))!;
    // DIAMOND_DOWN: x=(11−(−14))/2+0.5 ⇒ 13·128 = 1664; y=((−14+11)·0.5)+0.5 ⇒ −1·64 = −64.
    expect(mapToLocalPx(model, { x: 11, y: -14 })).toEqual({ x: 1664, y: -64 });
    // Second cell (12, −14): x = 13.5·128 = 1728; y = −0.5·64 = −32.
    expect(cells[1]!.coords).toEqual({ x: 12, y: -14 });
    expect(mapToLocalPx(model, { x: 12, y: -14 })).toEqual({ x: 1728, y: -32 });
  });

  /** Mounts `layer` against the real tileset, lit by a pass that spies on its capped items. */
  async function renderLayer(layer: (typeof layers)[number]) {
    const fake = createFakeResourceLoader();
    fake.resources.seed('res://tileset/tileset.tres', parseTresFile(tilesetContent));
    const atlasTex = new THREE.Texture();
    (atlasTex as unknown as { image: { width: number; height: number } }).image = {
      width: 1024,
      height: 1024,
    };
    fake.textures.seed('res://tileset/isotiles.png', atlasTex);
    const registerCappedItem = vi.fn((_item: CappedItem) => () => {});

    const renderer = await ReactThreeTestRenderer.create(
      <ResourceLoaderProvider loader={fake.loader}>
        <SceneResourcesProvider
          internalResources={scene.internalResources}
          externalResources={scene.externalResources}
        >
          <CanvasLighting2DContext.Provider value={{ ...INERT_CANVAS_LIGHTING, registerCappedItem }}>
            <TileMapLayer node={layer} />
          </CanvasLighting2DContext.Provider>
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    );
    return { renderer, registerCappedItem };
  }

  /** Layer0's rendering quadrants: it is y-sorted, so one per tile row (`tile_map_layer.cpp:546-548`). */
  function floorQuadrants() {
    const floor = layers.find((l) => l.name === 'Layer0')!;
    const props = floor.properties as TileMapLayerProperties;
    const model = tileSetFromTres(parseTresFile(tilesetContent))!;
    const quadrants = layerQuadrants(props.cells!, model, {
      ySortEnabled: props.y_sort_enabled,
      ySortOrigin: props.y_sort_origin,
      quadrantSize: props.rendering_quadrant_size,
    });
    return { floor, props, quadrants };
  }

  it('renders a dungeon layer end-to-end: one batched mesh per atlas source of each quadrant', async () => {
    const { floor, props, quadrants } = floorQuadrants();
    const batches = quadrants.reduce((sum, cells) => sum + new Set(cells.map((c) => c.sourceId)).size, 0);

    const { renderer } = await renderLayer(floor);

    const meshes = renderer.scene.findAllByType('Mesh');
    expect(meshes.length).toBe(batches);
    const totalVerts = meshes.reduce(
      (sum, m) => sum + (m.instance as THREE.Mesh).geometry.getAttribute('position').count,
      0
    );
    expect(totalVerts).toBe(props.cells!.length * 4);
  });

  it('declares each rendering quadrant of the floor as a lit item of its own', async () => {
    const { floor, quadrants } = floorQuadrants();
    expect(quadrants.length).toBeGreaterThan(1);

    const { registerCappedItem } = await renderLayer(floor);

    expect(registerCappedItem).toHaveBeenCalledTimes(quadrants.length);
  });
});
