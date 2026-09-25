/**
 * TileSet resolver: a TileSet reference into the TileSetModel. In the scene
 * adapter, the TileSet and its atlas sources are SubResources of the scene, and
 * texture refs resolve against the scene's external resources.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as logger from '../../logger';
import { tileSetFromScene, tileSetFromTres } from './decode';
import { TscnParser } from '../../parser/TscnParser';
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

  // Every index here is gated on `String::is_valid_int()`, which skips one
  // leading sign, `+` as readily as `-` (ustring.cpp:4752): the source id at
  // tile_set.cpp:3961, the two coordinate components at :4754, the alternative
  // id at :4797.
  it('resolves source, coordinate and alternative indices the way is_valid_int does', () => {
    const signedInternals: TscnInternalResource[] = [
      {
        id: 'atlas1',
        type: 'TileSetAtlasSource',
        data: {
          id: 'atlas1',
          texture: 'ExtResource("2")',
          '+0:+0/+1/flip_v': 'true',
          '-1:2/0/texture_origin': 'Vector2i(4, 4)',
          // -1 is INVALID_TILE_ALTERNATIVE and `_set` refuses it (:4799).
          '+0:+0/-1/flip_h': 'true',
        },
      },
      { id: 'ts', type: 'TileSet', data: { id: 'ts', 'sources/+3': 'SubResource("atlas1")' } },
    ];
    const model = tileSetFromScene('SubResource("ts")', signedInternals, externals);
    const source = model!.sources.get(3)!;

    expect(source).toBeDefined();
    expect(source.tiles.get('0:0')!.alternatives.get(1)!.flipV).toBe(true);
    expect(source.tiles.get('0:0')!.alternatives.has(-1)).toBe(false);
    expect(source.tiles.get('-1:2')!.alternatives.get(0)!.textureOrigin).toEqual({ x: 4, y: 4 });
  });

  // `add_source` re-seats a `-1` override at the auto-assigned `next_source_id`
  // (tile_set.cpp:481-482) and refuses anything below it (:479), so neither
  // spelling names source -1 and this decode cannot know which id the first one
  // landed on.
  it('drops a negative source id rather than seating one', () => {
    const negativeInternals: TscnInternalResource[] = [
      internals[0]!,
      { id: 'ts', type: 'TileSet', data: { id: 'ts', 'sources/-1': 'SubResource("atlas1")' } },
    ];
    const model = tileSetFromScene('SubResource("ts")', negativeInternals, externals);

    expect(model!.sources.size).toBe(0);
    expect(model!.sourceOrder).toEqual([]);
    // With the engine's grammar the key reaches the reader, so the drop is reported.
    const idWarns = warnSpy.mock.calls.filter((c: unknown[]) =>
      String(c[0]).includes('negative source id')
    );
    expect(idWarns).toHaveLength(1);
  });

  // `is_valid_int()` reads `sources/1`, `sources/01` and `sources/+1` as the
  // same source, and `_set` drops whatever sits at the id before re-adding
  // (tile_set.cpp:3965-3968). `sourceOrder` seats the id once, so `drawnSources`
  // cannot batch and draw one source several times over.
  it('collapses several spellings of one source id to a single order entry, last value winning', () => {
    const dupInternals: TscnInternalResource[] = [
      internals[0]!,
      {
        id: 'atlas2',
        type: 'TileSetAtlasSource',
        data: { id: 'atlas2', texture: 'ExtResource("2")', texture_region_size: 'Vector2i(8, 8)' },
      },
      {
        id: 'atlas3',
        type: 'TileSetAtlasSource',
        data: { id: 'atlas3', texture: 'ExtResource("2")', texture_region_size: 'Vector2i(4, 4)' },
      },
      {
        id: 'ts',
        type: 'TileSet',
        data: {
          id: 'ts',
          'sources/1': 'SubResource("atlas1")',
          'sources/01': 'SubResource("atlas2")',
          'sources/+1': 'SubResource("atlas3")',
        },
      },
    ];
    const model = tileSetFromScene('SubResource("ts")', dupInternals, externals);

    expect(model!.sourceOrder).toEqual([1]);
    expect(model!.sources.size).toBe(1);
    expect(model!.sources.get(1)!.textureRegionSize).toEqual({ x: 4, y: 4 });
  });

  it('keeps a re-spelled id in its first-seen place among distinct sources', () => {
    const mixedInternals: TscnInternalResource[] = [
      internals[0]!,
      {
        id: 'atlas2',
        type: 'TileSetAtlasSource',
        data: { id: 'atlas2', texture: 'ExtResource("2")', texture_region_size: 'Vector2i(8, 8)' },
      },
      {
        id: 'ts',
        type: 'TileSet',
        data: {
          id: 'ts',
          'sources/7': 'SubResource("atlas1")',
          'sources/2': 'SubResource("atlas1")',
          'sources/07': 'SubResource("atlas2")',
        },
      },
    ];
    const model = tileSetFromScene('SubResource("ts")', mixedInternals, externals);

    expect(model!.sourceOrder).toEqual([7, 2]);
    expect(model!.sources.get(7)!.textureRegionSize).toEqual({ x: 8, y: 8 });
  });

  it('keeps distinct sources in file order, one entry each', () => {
    const manyInternals: TscnInternalResource[] = [
      internals[0]!,
      {
        id: 'ts',
        type: 'TileSet',
        data: {
          id: 'ts',
          'sources/5': 'SubResource("atlas1")',
          'sources/0': 'SubResource("atlas1")',
          'sources/3': 'SubResource("atlas1")',
        },
      },
    ];
    const model = tileSetFromScene('SubResource("ts")', manyInternals, externals);

    expect(model!.sourceOrder).toEqual([5, 0, 3]);
  });

  it('seats a lone source once', () => {
    const model = tileSetFromScene('SubResource("ts")', internals, externals);
    expect(model!.sourceOrder).toEqual([0]);
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
    expect(model!.offsetAxis).toBe(0); // Absent: the horizontal default.
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

describe('a TileSet Vector2i slot follows the composite type, not the token', () => {
  // A `Vector2` holds two doubles, so `Vector2(4294967295, 16)` narrows through
  // `double -> int32` to the UB sentinel rather than wrapping to -1 the way the
  // `Vector2i` spelling of the same digits does. Measured on 4.6.3.
  it('falls back rather than sizing a tile at a number no platform holds', () => {
    const wide: TscnInternalResource[] = [
      internals[0]!,
      {
        id: 'ts',
        type: 'TileSet',
        data: { id: 'ts', tile_size: 'Vector2(4294967295, 16)', 'sources/0': 'SubResource("atlas1")' },
      },
    ];
    const model = tileSetFromScene('SubResource("ts")', wide, externals);
    expect(model!.tileSize).toEqual({ x: 16, y: 16 }); // Godot's default
    expect(warnSpy).toHaveBeenCalled();
  });

  it('still wraps the same digits in the canonical spelling, and reads an ordinary conversion', () => {
    const cases: Array<[string, { x: number; y: number }]> = [
      ['Vector2i(4294967295, 16)', { x: -1, y: 16 }],
      ['Vector2(128, 64)', { x: 128, y: 64 }],
    ];
    for (const [literal, expected] of cases) {
      const model = tileSetFromScene(
        'SubResource("ts")',
        [
          internals[0]!,
          {
            id: 'ts',
            type: 'TileSet',
            data: { id: 'ts', tile_size: literal, 'sources/0': 'SubResource("atlas1")' },
          },
        ],
        externals
      );
      expect(model!.tileSize).toEqual(expected);
    }
  });
});

describe('a TileSet enum Godot reads differently from `parseInt`', () => {
  it('reads the layout the exponent spelling names', () => {
    // Godot's tokenizer types `1e1` as FLOAT and stores 10, where `parseInt`
    // would stop at the `e` and read 1 (STACKED_OFFSET).
    const model = tileSetFromTres(
      parseTresFile('[gd_resource type="TileSet"]\n\n[resource]\ntile_layout = 1e1\n')!
    );

    expect(model?.layout).toBe(10);
  });
});

describe('a Godot-3 texture_offset', () => {
  it('reaches textureOrigin once the scan has renamed it (tile_set.cpp:6701-6704)', () => {
    const scene = new TscnParser().parse(
      '[gd_scene format=3]\n\n[sub_resource type="TileSetAtlasSource" id="a"]\n0:0/0 = 0\n0:0/0/texture_offset = Vector2i(3, 4)\n\n[sub_resource type="TileSet" id="ts"]\nsources/0 = SubResource("a")\n\n[node name="R" type="Node"]\n'
    );
    const model = tileSetFromScene('SubResource("ts")', scene.internalResources, []);
    expect(model!.sources.get(0)!.tiles.get('0:0')!.alternatives.get(0)!.textureOrigin).toEqual({ x: 3, y: 4 });
  });
});
