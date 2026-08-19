/**
 * Every distinct TileSet key/value Godot's own demo projects write, asserted to
 * produce no ERROR.
 *
 * A false-positive detector, and a needed one: a bound written from the engine
 * source still has to accept what the engine SERIALISES, and a validator that
 * rejects a shipped Godot demo is wrong however well cited it is.
 *
 * The values are carried here as literals rather than read from `scenes/`, for
 * the same reason `lint:scenes` keeps its directory list in the script: the core
 * package takes values, the caller chooses the corpus. It is also the only form
 * that exercises them at all today — every TileSet in the corpus is a standalone
 * `.tres`, whose `[resource]` block reaches no validator
 * (`TscnParserCore.currentOwnerType` yields `undefined` for that section), so the
 * corpus sweep is silent on this whole slice and would stay silent through any
 * bound written here.
 *
 * Duplicate spellings of one key are collapsed; the distinct VALUES are what a
 * bound can disagree with. Ids are as written, and a dangling `SubResource`
 * reference is not a diagnostic inside a `[sub_resource]` block, so the source
 * and pattern slots carry their real ids.
 */

import { describe, expect, it } from 'vitest';
import { lint, node, scene, subResource } from '../../linter/testing/testkit.js';
import { validatorRegistry } from '../../linter/ValidatorRegistry.js';
import '../../linter/index';

/** Every distinct `key = value` under a `[resource]` block of a corpus TileSet. */
const CORPUS: Readonly<Record<string, string>> = {
  // scenes/demos/2d/skeleton/level/tileset/tileset.tres
  pattern_0: 'SubResource("TileMapPattern_4pfkh")',
  pattern_1: 'SubResource("TileMapPattern_fatpo")',
  pattern_2: 'SubResource("TileMapPattern_hwg2d")',
  'terrain_set_0/mode': '0',
  'terrain_set_0/terrain_0/color': 'Color(0.5, 0.34375, 0.25, 1)',
  'terrain_set_0/terrain_0/name': '"Terrain 0"',
  'physics_layer_0/collision_mask': '0',
  // scenes/demos/2d/platformer/level/tileset.tres
  'physics_layer_0/collision_layer': '16',
  // scenes/demos/2d/dynamic_tilemap_layers/world.tscn — the one embedded form,
  // and so the only TileSet the corpus sweep reaches today.
  'physics_layer_0/physics_material': 'SubResource("PhysicsMaterial_on5ov")',
  // scenes/demos/2d/navigation_astar/tileset/tileset.tres — six top-level
  // elements, which is the even count `_set` demands (tile_set.cpp:3973).
  'tile_proxies/coords_level':
    '[[0, Vector2i(0, 0)], [4, Vector2i(0, 0)], [2, Vector2i(0, 0)], ' +
    '[4, Vector2i(1, 0)], [3, Vector2i(0, 0)], [4, Vector2i(2, 0)]]',
  // scenes/isometric/tileset/tileset.tres
  tile_layout: '5',
  // scenes/demos/2d/hexagonal_map/tileset.tres
  tile_offset_axis: '1',
  tile_shape: '3',
  tile_size: 'Vector2i(110, 94)',
  // The source ids the corpus spells run 0..25 across the eleven files; the ends
  // and a few interior ones stand for the range.
  'sources/0': 'SubResource("TileSetAtlasSource_va8am")',
  'sources/1': 'SubResource("TileSetAtlasSource_v5kxh")',
  'sources/9': 'SubResource("TileSetAtlasSource_8m15g")',
  'sources/10': 'SubResource("TileSetAtlasSource_hfgct")',
  'sources/19': 'SubResource("TileSetAtlasSource_70rax")',
  'sources/25': 'SubResource("TileSetAtlasSource_jm5h0")',
};

describe('TileSet corpus values', () => {
  const props: Record<string, string> = { ...CORPUS };

  it('accepts every value Godot itself wrote, in one TileSet', () => {
    const content = scene(subResource('TileSet', props), node('Node3D', {}, { name: 'Root' }));
    const errors = lint(content).filter((d) => d.severity === 'error');
    expect(errors.map((d) => d.message)).toEqual([]);
  });

  it('routes every corpus key, so the assertion above cannot pass vacuously', () => {
    // A key reaching NO validator is accepted for the wrong reason, and a table
    // of such keys vouches for nothing. This is the question the corpus sweep
    // cannot ask, because it never reaches a `[resource]` block at all.
    const unrouted = Object.keys(props).filter(
      (key) => validatorRegistry.findValidator('TileSet', key) === null
    );
    expect(unrouted).toEqual([]);
  });

  for (const [key, value] of Object.entries(CORPUS)) {
    it(`accepts ${key} = ${value.slice(0, 48)}`, () => {
      const content = scene(
        subResource('TileSet', { [key]: value }),
        node('Node3D', {}, { name: 'Root' })
      );
      expect(lint(content).filter((d) => d.severity === 'error')).toEqual([]);
    });
  }
});
