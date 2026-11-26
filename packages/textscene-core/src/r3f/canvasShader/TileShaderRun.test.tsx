import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DrawableCell } from '../../resources/tileset/drawableCell';
import { tileTextureAt } from '../../resources/tileset/testing/tileTexture';
import { defaultTileData, type AtlasSourceModel, type TileGrid } from '../../resources/tileset/types';
import type { ShaderText } from '../../resources/materials/shadermaterial/types';
import type { CanvasShaderCommand } from './canvasCommands';
import * as imagePixels from '../../resources/formats/image/imagePixels';
import { TileShaderRun } from './TileShaderRun';

/** What the mocked texture hook returns, set by each test and reset after it. */
const sampled = vi.hoisted(() => ({ texture: null as THREE.Texture | null, missing: false }));

vi.mock('../canvasItemTexture', () => ({
  useCanvasItemTextureSampledBy: () => ({
    texture: sampled.texture,
    missing: sampled.missing,
    canvasTexture: null,
    sampler: { filter: 0, repeat: 0 },
  }),
}));

/** Written by the mocked slot on each render, cleared after each test. */
const slotCommands = vi.hoisted(() => ({ last: null as readonly CanvasShaderCommand[] | null }));

vi.mock('./CanvasShaderSlot', () => ({
  CanvasShaderSlot: ({
    commands,
    fallback,
  }: {
    commands: readonly CanvasShaderCommand[];
    fallback: unknown;
  }) => {
    slotCommands.last = commands;
    return <group name="slot">{fallback as never}</group>;
  },
}));

const GRID: TileGrid = { shape: 0, layout: 0, offsetAxis: 0, tileSize: { x: 16, y: 16 } };
const TILE = { sizeInAtlas: { x: 1, y: 1 }, alternatives: new Map() };
const SHADER: ShaderText = {
  code: 'shader_type canvas_item;\n',
  file: 'res://a.gdshader',
  parameters: {},
  textures: {},
};
const SOURCE: AtlasSourceModel = {
  texture: tileTextureAt('res://tiles.png'),
  margins: { x: 0, y: 0 },
  separation: { x: 0, y: 0 },
  textureRegionSize: { x: 16, y: 16 },
  usesTexturePadding: false,
  tiles: new Map([
    ['0:0', TILE],
    ['3:0', TILE],
  ]),
};
const WHITE = { r: 1, g: 1, b: 1, a: 1 };

function cellAt(x: number, atlasX: number): DrawableCell {
  const tileData = defaultTileData();
  return {
    coords: { x, y: 0 },
    sourceId: 0,
    atlasCoords: { x: atlasX, y: 0 },
    alternativeId: 0,
    source: SOURCE,
    tile: TILE,
    tileData,
  };
}

function run(itemOrigin = { x: 0, y: 0 }, cells = [cellAt(0, 0)], source = SOURCE) {
  return ReactThreeTestRenderer.create(
    <TileShaderRun
      shader={SHADER}
      source={source}
      cells={cells}
      tileSet={{ ...GRID, usesUvClipping: false }}
      finalModulate={WHITE}
      sampler={{ filter: 0, repeat: 0 }}
      renderOrder={0}
      itemOrigin={itemOrigin}
      fallback={<group name="fallback" />}
    />
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  sampled.texture = null;
  sampled.missing = false;
  slotCommands.last = null;
});

describe('TileShaderRun', () => {
  it('draws the slot for a source whose texture is here', async () => {
    sampled.texture = new THREE.DataTexture(new Uint8Array(32 * 16 * 4), 32, 16);
    const renderer = await run();

    expect(renderer.scene.findAll((node) => node.props.name === 'slot')).toHaveLength(1);
  });

  it('draws nothing for a texture that failed to load', async () => {
    sampled.texture = new THREE.DataTexture(new Uint8Array(32 * 16 * 4), 32, 16);
    sampled.missing = true;
    const renderer = await run();

    expect(renderer.scene.children).toHaveLength(0);
  });

  it('draws nothing while the texture is pending', async () => {
    const renderer = await run();

    expect(renderer.scene.children).toHaveLength(0);
  });

  it('places the item at its origin and the fallback back in layer pixels', async () => {
    sampled.texture = new THREE.DataTexture(new Uint8Array(32 * 16 * 4), 32, 16);
    const renderer = await run({ x: 24, y: 40 });

    const item = renderer.scene.children[0]!.instance as THREE.Object3D;
    const fallback = renderer.scene.findByProps({ name: 'fallback' }).parent!.instance as THREE.Object3D;
    expect(item.position.toArray()).toEqual([24, -40, 0]);
    expect(fallback.position.toArray()).toEqual([-24, 40, 0]);
  });

  it('gives the slot no rect for a cell past the texture grid', async () => {
    sampled.texture = new THREE.DataTexture(new Uint8Array(32 * 16 * 4), 32, 16);
    await run(undefined, [cellAt(0, 0), cellAt(1, 3)]);

    expect(slotCommands.last).toHaveLength(1);
  });

  it('draws nothing while the padded copy builds, and never the fallback', async () => {
    sampled.texture = new THREE.DataTexture(new Uint8Array(32 * 16 * 4), 32, 16);
    const renderer = await run(undefined, undefined, { ...SOURCE, usesTexturePadding: true });

    expect(renderer.scene.children).toHaveLength(0);
  });

  it('draws the slot from the padded copy once it is built', async () => {
    sampled.texture = new THREE.DataTexture(new Uint8Array(32 * 16 * 4), 32, 16);
    const renderer = await run(undefined, undefined, { ...SOURCE, usesTexturePadding: true });

    await vi.waitFor(() =>
      expect(renderer.scene.findAll((node) => node.props.name === 'slot')).toHaveLength(1)
    );
  });

  it('draws the slot from the placeholder for a padded source whose pixels it cannot read', async () => {
    sampled.texture = new THREE.DataTexture(new Uint8Array(32 * 16 * 4), 32, 16);
    vi.spyOn(imagePixels, 'readImagePixels').mockReturnValue(undefined);
    const renderer = await run(undefined, undefined, { ...SOURCE, usesTexturePadding: true });

    await vi.waitFor(() =>
      expect(renderer.scene.findAll((node) => node.props.name === 'slot')).toHaveLength(1)
    );
  });
});
