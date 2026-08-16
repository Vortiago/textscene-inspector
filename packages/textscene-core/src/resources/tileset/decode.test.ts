/**
 * TileSet resolver — normalizes a TileSet reference into the TileSetModel.
 * Scene adapter: the TileSet and its atlas sources are SubResources of the
 * scene; texture refs resolve against the scene's external resources.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as logger from '../../logger';
import { tileSetFromScene, tileSetFromTres } from './decode';
import { parseTresFile } from '../../parser/parsedResource';
import type { TscnExternalResource, TscnInternalResource } from '../../parser/types';

let warnSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  warnSpy.mockRestore();
});

const externals: TscnExternalResource[] = [
  { id: '2', type: 'Texture2D', path: 'res://tiles.png' },
];

const internals: TscnInternalResource[] = [
  {
    id: 'atlas1',
    type: 'TileSetAtlasSource',
    data: {
      id: 'atlas1',
      texture: 'ExtResource("2")',
      texture_region_size: 'Vector2i(32, 24)',
    },
  },
  {
    id: 'ts',
    type: 'TileSet',
    data: { id: 'ts', 'sources/0': 'SubResource("atlas1")' },
  },
];

describe('tileSetFromScene', () => {
  it('resolves an embedded TileSet: grid defaults plus an atlas source with texture path and region size', () => {
    const model = tileSetFromScene('SubResource("ts")', internals, externals);
    expect(model).not.toBeNull();
    expect(model!.tileSize).toEqual({ x: 16, y: 16 }); // Godot default
    const source = model!.sources.get(0);
    expect(source).toBeDefined();
    expect(source!.texturePath).toBe('res://tiles.png');
    expect(source!.textureRegionSize).toEqual({ x: 32, y: 24 });
    expect(source!.margins).toEqual({ x: 0, y: 0 });
    expect(source!.separation).toEqual({ x: 0, y: 0 });
  });

  it('reads per-tile entries: alternatives with flip flags, texture_origin, and size_in_atlas', () => {
    const richInternals: TscnInternalResource[] = [
      {
        id: 'atlas1',
        type: 'TileSetAtlasSource',
        data: {
          id: 'atlas1',
          texture: 'ExtResource("2")',
          '0:0/next_alternative_id': '2',
          '0:0/0': '0',
          '0:0/1': '1',
          '0:0/1/flip_h': 'true',
          '0:0/1/transpose': 'true',
          '2:1/0': '0',
          '2:1/0/texture_origin': 'Vector2i(0, -16)',
          '1:3/size_in_atlas': 'Vector2i(2, 2)',
          '1:3/0': '0',
        },
      },
      { id: 'ts', type: 'TileSet', data: { id: 'ts', 'sources/0': 'SubResource("atlas1")' } },
    ];
    const model = tileSetFromScene('SubResource("ts")', richInternals, externals);
    const source = model!.sources.get(0)!;

    expect(source.tiles.get('0:0')!.alternatives.get(1)).toEqual({
      flipH: true,
      flipV: false,
      transpose: true,
      textureOrigin: { x: 0, y: 0 },
    });
    expect(source.tiles.get('2:1')!.alternatives.get(0)!.textureOrigin).toEqual({ x: 0, y: -16 });
    expect(source.tiles.get('1:3')!.sizeInAtlas).toEqual({ x: 2, y: 2 });
  });

  it('reads the grid surface: tile_shape, tile_layout, tile_offset_axis, tile_size', () => {
    const isoInternals: TscnInternalResource[] = [
      internals[0]!,
      {
        id: 'ts',
        type: 'TileSet',
        data: {
          id: 'ts',
          tile_shape: '1',
          tile_layout: '5',
          tile_size: 'Vector2i(128, 64)',
          'sources/0': 'SubResource("atlas1")',
        },
      },
    ];
    const model = tileSetFromScene('SubResource("ts")', isoInternals, externals);
    expect(model!.shape).toBe(1);
    expect(model!.layout).toBe(5);
    expect(model!.offsetAxis).toBe(0); // absent → horizontal default
    expect(model!.tileSize).toEqual({ x: 128, y: 64 });
  });

  it('does not warn for hexagon/half-offset shapes — they place correctly now', () => {
    for (const shape of ['2', '3']) {
      warnSpy.mockClear();
      const hexInternals: TscnInternalResource[] = [
        internals[0]!,
        {
          id: 'ts',
          type: 'TileSet',
          data: { id: 'ts', tile_shape: shape, 'sources/0': 'SubResource("atlas1")' },
        },
      ];
      const model = tileSetFromScene('SubResource("ts")', hexInternals, externals);
      expect(model!.shape).toBe(Number(shape));
      const shapeWarns = warnSpy.mock.calls.filter((c: unknown[]) => String(c[0]).includes('tile_shape'));
      expect(shapeWarns).toHaveLength(0);
    }
  });

  it('warns ONCE per TileSet for genuinely unknown tile shapes', () => {
    const oddInternals: TscnInternalResource[] = [
      internals[0]!,
      {
        id: 'ts',
        type: 'TileSet',
        data: { id: 'ts', tile_shape: '99', 'sources/0': 'SubResource("atlas1")' },
      },
    ];
    tileSetFromScene('SubResource("ts")', oddInternals, externals);
    const shapeWarns = warnSpy.mock.calls.filter((c: unknown[]) => String(c[0]).includes('tile_shape'));
    expect(shapeWarns).toHaveLength(1);
  });
});

describe('tileSetFromTres', () => {
  const TILESET_TRES = `[gd_resource type="TileSet" load_steps=3 format=3]

[ext_resource type="Texture2D" path="res://tileset/isotiles.png" id="1"]

[sub_resource type="TileSetAtlasSource" id="TileSetAtlasSource_a"]
texture = ExtResource("1")
margins = Vector2i(28, 75)
texture_region_size = Vector2i(135, 105)
0:0/0 = 0
0:0/1 = 1
0:0/1/flip_h = true

[resource]
tile_shape = 1
tile_layout = 5
tile_size = Vector2i(128, 64)
sources/0 = SubResource("TileSetAtlasSource_a")
`;

  it('resolves a TileSet .tres against its own ext/sub resources', () => {
    const model = tileSetFromTres(parseTresFile(TILESET_TRES));
    expect(model).not.toBeNull();
    expect(model!.shape).toBe(1);
    expect(model!.tileSize).toEqual({ x: 128, y: 64 });
    const source = model!.sources.get(0)!;
    expect(source.texturePath).toBe('res://tileset/isotiles.png');
    expect(source.margins).toEqual({ x: 28, y: 75 });
    expect(source.textureRegionSize).toEqual({ x: 135, y: 105 });
    expect(source.tiles.get('0:0')!.alternatives.get(1)!.flipH).toBe(true);
  });

  it('returns null for a .tres that is not a TileSet', () => {
    const material = parseTresFile(
      '[gd_resource type="StandardMaterial3D" format=3]\n\n[resource]\nmetallic = 0.5\n'
    );
    expect(tileSetFromTres(material)).toBeNull();
  });
});

describe('a TileSet enum Godot reads differently from `parseInt`', () => {
  it('reads the layout the exponent spelling names', () => {
    // `parseInt` stops at the `e`, so `1e1` decoded to 1 (STACKED_OFFSET)
    // where Godot's tokenizer types the token FLOAT and stores 10.
    const model = tileSetFromTres(
      parseTresFile('[gd_resource type="TileSet"]\n\n[resource]\ntile_layout = 1e1\n')!
    );

    expect(model?.layout).toBe(10);
  });
});
