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
import { tileTextureAt } from '../resources/tileset/testing/tileTexture';
import type { TscnInternalResource } from '../parser/types';
import { textureSize } from '../resources/textures/textureSize';
import { unconfiguredViewportTexture } from '../resources/textures/viewporttexture/unconfiguredViewportTexture';
import { ViewportTextureProvider } from './contexts/ViewportTextureContext';
import { NodePathProvider } from './contexts/NodePathContext';
import { ViewportTexturePublisher, viewportEntry } from './testing/ViewportTexturePublisher';
import { createCanvasTarget } from '../nodes/viewport/subviewport/offscreenViewport';

const TEXTURE = 'res://tiles.png';
const grid: TileGrid = {
  shape: TileShape.TILE_SHAPE_SQUARE,
  layout: 0,
  offsetAxis: 0,
  tileSize: { x: 16, y: 16 },
};

function sourceOf(usesTexturePadding: boolean): AtlasSourceModel {
  return {
    texture: tileTextureAt(TEXTURE),
    margins: { x: 0, y: 0 },
    separation: { x: 0, y: 0 },
    textureRegionSize: { x: 16, y: 16 },
    usesTexturePadding,
    tiles: new Map(),
  };
}

/** Linear and Disabled, the viewport defaults (`viewport.h:419-420`). */
const DEFAULT_SAMPLER = { filter: 2, repeat: 1 };

/** `texture` null seeds a texture that fails to load. */
async function render(source: AtlasSourceModel, texture: THREE.Texture | null, sampler = DEFAULT_SAMPLER) {
  const fake = createFakeResourceLoader();
  fake.textures.seed(TEXTURE, texture);
  return ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={fake.loader}>{tileMesh(source, sampler)}</ResourceLoaderProvider>
  );
}

/** `source` drawn at `Root/Tiles`, beside a SubViewport published at `Root/SubViewport`. */
async function renderBesideViewport(source: AtlasSourceModel, isTransparent: boolean) {
  const target = createCanvasTarget(32, 32, 'SubViewport');
  return ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={createFakeResourceLoader().loader}>
      <ViewportTextureProvider>
        <ViewportTexturePublisher
          path="Root/SubViewport"
          entry={viewportEntry(target.texture, { x: 32, y: 32 })}
          isTransparent={isTransparent}
        />
        <NodePathProvider path="Root/Tiles">{tileMesh(source, DEFAULT_SAMPLER)}</NodePathProvider>
      </ViewportTextureProvider>
    </ResourceLoaderProvider>
  );
}

function tileMesh(source: AtlasSourceModel, sampler: typeof DEFAULT_SAMPLER) {
  return (
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
          sampler={sampler}
        />
      )}
    </LitCanvasItemPixels>
  );
}

async function drawnMesh(source: AtlasSourceModel): Promise<THREE.Mesh> {
  const texture = new THREE.Texture();
  (texture as unknown as { image: { width: number; height: number } }).image = { width: 32, height: 16 };
  const renderer = await render(source, texture);
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

describe('TileSourceMesh without a usable texture', () => {
  it('draws nothing when the source has no texture (tile_map_layer.cpp:724)', async () => {
    const renderer = await render({ ...sourceOf(false), texture: null }, null);
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(0);
  });

  it('draws the placeholder when the texture is set but fails to load', async () => {
    const renderer = await render(sourceOf(false), null);
    const material = renderer.scene.findByType('Mesh').instance as THREE.Mesh;
    expect((material.material as THREE.MeshBasicMaterial).color.getHexString()).toBe('ff00ff');
  });
});

describe('TileSourceMesh texture sampler', () => {
  it("samples the atlas with the tile layer's filter and repeat", async () => {
    const texture = new THREE.Texture();
    (texture as unknown as { image: { width: number; height: number } }).image = { width: 32, height: 16 };
    const NEAREST = 1;
    const REPEAT_ENABLED = 2;
    const renderer = await render(sourceOf(false), texture, { filter: NEAREST, repeat: REPEAT_ENABLED });
    const mesh = renderer.scene.findByType('Mesh').instance as THREE.Mesh;
    const map = (mesh.material as THREE.MeshBasicMaterial).map!;
    expect([map.magFilter, map.minFilter]).toEqual([THREE.NearestFilter, THREE.NearestFilter]);
    expect([map.wrapS, map.wrapT]).toEqual([THREE.RepeatWrapping, THREE.RepeatWrapping]);
  });
});

/** A GradientTexture2D the TileSet's own tables hold, 8 by 4 texels. */
const GRADIENT_TABLES: TscnInternalResource[] = [
  { id: 'Gradient_g', type: 'Gradient', data: { colors: 'PackedColorArray(1, 0, 0, 1, 0, 0, 1, 1)' } },
  {
    id: 'Ramp',
    type: 'GradientTexture2D',
    data: { gradient: 'SubResource("Gradient_g")', width: '8', height: '4' },
  },
];

describe('TileSourceMesh texture slot', () => {
  it('draws an atlas texture the TileSet holds as a procedural texture, as any Texture2D slot does', async () => {
    const source = {
      ...sourceOf(false),
      texture: { ...tileTextureAt('SubResource("Ramp")'), internalResources: GRADIENT_TABLES },
    };
    const renderer = await render(source, null);
    const mesh = renderer.scene.findByType('Mesh').instance as THREE.Mesh;
    const map = (mesh.material as THREE.MeshBasicMaterial).map!;
    expect(textureSize(map)).toEqual({ width: 8, height: 4 });
  });

  /**
   * An AtlasTexture reports its region while the scene loads, so its tiles exist, and Godot sets its
   * ViewportTexture up only through a TileSet that is local to scene (`core/io/resource.cpp:497-503`).
   */
  it("draws Godot's placeholder for an AtlasTexture over a ViewportTexture in a TileSet that is not local to scene", async () => {
    const renderer = await render(viewportWindowSource(false, 'false'), null);
    expect(distinctTexels(mapTexels(renderer))).toEqual(
      distinctTexels(unconfiguredViewportTexture().image.data!)
    );
  });
});

/** A source whose AtlasTexture windows the SubViewport, in a TileSet local to scene or not. */
function viewportWindowSource(
  usesTexturePadding: boolean,
  isTileSetLocal: 'true' | 'false'
): AtlasSourceModel {
  const tables: TscnInternalResource[] = [
    { id: 'Viewport', type: 'ViewportTexture', data: { viewport_path: 'NodePath("SubViewport")' } },
    {
      id: 'Window',
      type: 'AtlasTexture',
      data: {
        atlas: 'SubResource("Viewport")',
        region: 'Rect2(0, 0, 32, 32)',
        resource_local_to_scene: 'true',
      },
    },
  ];
  const tileSet = { id: 'TileSet_1', type: 'TileSet', data: { resource_local_to_scene: isTileSetLocal } };
  return {
    ...sourceOf(usesTexturePadding),
    texture: { ...tileTextureAt('SubResource("Window")'), internalResources: tables, holders: [tileSet] },
  };
}

type Rendered = Awaited<ReturnType<typeof render>>;

const drawnMeshOf = (renderer: Rendered) => renderer.scene.findByType('Mesh').instance as THREE.Mesh;

function mapTexels(renderer: Rendered): ArrayLike<number> {
  const map = (drawnMeshOf(renderer).material as THREE.MeshBasicMaterial).map!;
  return (map.image as { data: ArrayLike<number> }).data;
}

/**
 * Godot builds a padded source's atlas once, from the texture's image at load (`tile_set.cpp:5622-5654`),
 * and draws each tile at its padded region (`:5333-5345`).
 */
describe('TileSourceMesh padding a texture with no image at load', () => {
  it('samples the placeholder at the padded regions when Godot never sets the ViewportTexture up', async () => {
    const renderer = await render(viewportWindowSource(true, 'false'), null);
    const mesh = drawnMeshOf(renderer);
    expect(distinctTexels(mapTexels(renderer))).toEqual(
      distinctTexels(unconfiguredViewportTexture().image.data!)
    );
    // Atlas (1,0) pads to (19, 1, 16, 16) of the 4×4 placeholder.
    expect(Array.from(mesh.geometry.getAttribute('uv').array)).toEqual([
      4.75, 0.75, 8.75, 0.75, 4.75, -3.25, 8.75, -3.25,
    ]);
    expect(mesh.geometry.getAttribute(TILE_UV_BOUNDS_ATTRIBUTE)).toBeUndefined();
    expect(cacheKeyOf(mesh)).not.toContain('tile-texture-padding');
  });

  /** Godot reads an opaque target's image as RGB8 and a transparent one's as RGBA8 (`texture_storage.cpp:3571-3575`). */
  it('draws the opaque target as it stood before its first render: black', async () => {
    const renderer = await renderBesideViewport(viewportWindowSource(true, 'true'), false);
    expect(distinctTexels(mapTexels(renderer))).toEqual(['0,0,0,255']);
  });

  it('draws the transparent target as it stood before its first render: clear', async () => {
    const renderer = await renderBesideViewport(viewportWindowSource(true, 'true'), true);
    expect(distinctTexels(mapTexels(renderer))).toEqual(['0,0,0,0']);
  });

  it('keeps the padded atlas size, as Godot builds it: the grid of padded cells', async () => {
    const renderer = await renderBesideViewport(viewportWindowSource(true, 'true'), false);
    const map = (drawnMeshOf(renderer).material as THREE.MeshBasicMaterial).map!;
    expect(textureSize(map)).toEqual({ width: 36, height: 36 });
  });

  it('draws the live target of a source that does not pad', async () => {
    const renderer = await renderBesideViewport(viewportWindowSource(false, 'true'), false);
    const map = (drawnMeshOf(renderer).material as THREE.MeshBasicMaterial).map!;
    expect(map.isRenderTargetTexture).toBe(true);
  });
});

/** The distinct RGBA texels of `data`, sorted, each written as `r,g,b,a`. */
function distinctTexels(data: ArrayLike<number>): string[] {
  const texels = new Set<string>();
  for (let i = 0; i < data.length; i += 4)
    texels.add([data[i], data[i + 1], data[i + 2], data[i + 3]].join(','));
  return [...texels].sort();
}
