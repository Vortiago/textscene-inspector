/**
 * A padded atlas source draws its tiles with each sample held inside the tile's own texels, the
 * effect of Godot's padded atlas (`tile_set.cpp:5622-5671`). An unpadded source samples freely.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { TileSourceMesh } from './TileSourceMesh';
import { LitCanvasItemPixels } from './components/LitCanvasItemPixels';
import { TILE_UV_BOUNDS_ATTRIBUTE } from './tileTexturePadding';
import { ResourceLoaderProvider } from '../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../resources/testing/createFakeResourceLoader';
import { drawableCellOf } from '../resources/tileset/testing/drawableCellOf';
import type { AtlasSourceModel, TileGrid } from '../resources/tileset/types';
import { TileShape } from '../godot/scene/tileSet';

const TEXTURE = 'res://tiles.png';
const grid: TileGrid = {
  shape: TileShape.TILE_SHAPE_SQUARE,
  layout: 0,
  offsetAxis: 0,
  tileSize: { x: 16, y: 16 },
};

function sourceOf(usesTexturePadding: boolean): AtlasSourceModel {
  return {
    texturePath: TEXTURE,
    margins: { x: 0, y: 0 },
    separation: { x: 0, y: 0 },
    textureRegionSize: { x: 16, y: 16 },
    usesTexturePadding,
    tiles: new Map(),
  };
}

async function drawnMesh(source: AtlasSourceModel): Promise<THREE.Mesh> {
  const fake = createFakeResourceLoader();
  const texture = new THREE.Texture();
  (texture as unknown as { image: { width: number; height: number } }).image = { width: 32, height: 16 };
  fake.textures.seed(TEXTURE, texture);
  const renderer = await ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={fake.loader}>
      <LitCanvasItemPixels material={null} lightMask={undefined} zFinal={0}>
        {(pixelMaterial) => (
          <TileSourceMesh
            source={source}
            cells={[drawableCellOf({ coords: { x: 0, y: 0 }, atlasCoords: { x: 1, y: 0 } })]}
            grid={grid}
            renderOrder={0}
            color={new THREE.Color(1, 1, 1)}
            opacity={1}
            pixelMaterial={pixelMaterial}
          />
        )}
      </LitCanvasItemPixels>
    </ResourceLoaderProvider>
  );
  return renderer.scene.findByType('Mesh').instance as THREE.Mesh;
}

const cacheKeyOf = (mesh: THREE.Mesh) => (mesh.material as THREE.Material).customProgramCacheKey();

describe('TileSourceMesh texture padding', () => {
  it('gives a padded source its tile bounds and the clamped program', async () => {
    const mesh = await drawnMesh(sourceOf(true));
    expect(mesh.geometry.getAttribute(TILE_UV_BOUNDS_ATTRIBUTE)?.itemSize).toBe(4);
    expect(cacheKeyOf(mesh)).toContain('tile-texture-padding');
  });

  it('draws an unpadded source with neither', async () => {
    const mesh = await drawnMesh(sourceOf(false));
    expect(mesh.geometry.getAttribute(TILE_UV_BOUNDS_ATTRIBUTE)).toBeUndefined();
    expect(cacheKeyOf(mesh)).not.toContain('tile-texture-padding');
  });
});
