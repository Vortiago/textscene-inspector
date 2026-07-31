/**
 * Integration against the vendored isometric dungeon (scenes/isometric/,
 * godot-demo-projects, MIT): the real dungeon.tscn parses, its real
 * tileset.tres resolves (5 atlas sources, ISOMETRIC DIAMOND_DOWN 128×64),
 * known cells decode to hand-computed map_to_local centers, and a layer
 * renders batched meshes end-to-end.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { TscnParser } from '../../../../parser/TscnParser';
import { parseTresFile } from '../../../../parser/parsedResource';
import { tileSetFromTres } from '../../../../resources/tileset/resolveTileSet';
import { mapToLocalPx } from '../../../../resources/tileset/tilePlacement';
import { TileMapLayer } from './Component';
import { SceneResourcesProvider } from '../../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../../resources/testing/createFakeResourceLoader';
import { findByType } from './findByType';
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

  it('renders a dungeon layer end-to-end: one batched mesh per atlas source used', async () => {
    const floor = layers.find((l) => l.name === 'Layer0')!;
    const cells = (floor.properties as TileMapLayerProperties).cells!;
    const distinctSources = new Set(cells.map((c) => c.sourceId)).size;

    const fake = createFakeResourceLoader();
    fake.resources.seed('res://tileset/tileset.tres', parseTresFile(tilesetContent));
    const atlasTex = new THREE.Texture();
    (atlasTex as unknown as { image: { width: number; height: number } }).image = {
      width: 1024,
      height: 1024,
    };
    fake.textures.seed('res://tileset/isotiles.png', atlasTex);

    const r = await ReactThreeTestRenderer.create(
      <ResourceLoaderProvider loader={fake.loader}>
        <SceneResourcesProvider
          internalResources={scene.internalResources}
          externalResources={scene.externalResources}
        >
          <TileMapLayer node={floor} />
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    );

    const meshes = r.scene.findAllByType('Mesh');
    expect(meshes.length).toBe(distinctSources);
    const totalVerts = meshes.reduce(
      (sum, m) => sum + (m.instance as THREE.Mesh).geometry.getAttribute('position').count,
      0
    );
    expect(totalVerts).toBe(cells.length * 4);
  });
});
