/**
 * Every distinct TileSet key and value Godot's demos write must produce no error:
 * a validator that rejects a shipped demo is wrong. Literals, since the caller
 * chooses the corpus (as for `lint:scenes`) and a `.tres` `[resource]` block reaches
 * no validator (`TscnParserCore.currentOwnerType`), so the sweep is silent here.
 */

import { describe, expect, it } from 'vitest';
import { lint, node, scene, subResource } from '../../linter/testing/testkit.js';
import { validatorRegistry } from '../../linter/ValidatorRegistry.js';
import '../../linter/index';

/**
 * Every distinct `key = value` under a `[resource]` block of a corpus TileSet.
 * Ids are as written: a dangling `SubResource` is no diagnostic inside a
 * `[sub_resource]` block.
 */
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
  // scenes/demos/2d/dynamic_tilemap_layers/world.tscn, the one embedded form.
  'physics_layer_0/physics_material': 'SubResource("PhysicsMaterial_on5ov")',
  // scenes/demos/2d/navigation_astar/tileset/tileset.tres: six top-level elements,
  // the even count `_set` demands (tile_set.cpp:3973).
  'tile_proxies/coords_level':
    '[[0, Vector2i(0, 0)], [4, Vector2i(0, 0)], [2, Vector2i(0, 0)], ' +
    '[4, Vector2i(1, 0)], [3, Vector2i(0, 0)], [4, Vector2i(2, 0)]]',
  // scenes/isometric/tileset/tileset.tres
  tile_layout: '5',
  // scenes/demos/2d/hexagonal_map/tileset.tres
  tile_offset_axis: '1',
  tile_shape: '3',
  tile_size: 'Vector2i(110, 94)',
  // The ends and a few interior source ids stand for the range the demos spell.
  'sources/0': 'SubResource("TileSetAtlasSource_va8am")',
  'sources/1': 'SubResource("TileSetAtlasSource_v5kxh")',
  'sources/9': 'SubResource("TileSetAtlasSource_8m15g")',
  'sources/10': 'SubResource("TileSetAtlasSource_hfgct")',
  'sources/19': 'SubResource("TileSetAtlasSource_70rax")',
  'sources/25': 'SubResource("TileSetAtlasSource_jm5h0")',
};

/** Every id the corpus values name, declared ahead of the TileSet so none dangles. */
const DECLARED = [...new Set(Object.values(CORPUS).flatMap((v) => [...v.matchAll(/SubResource\("([^"]+)"\)/g)].map((m) => m[1]!)))]
  .map((id) => subResource('Resource', {}, id))
  .join('\n\n');

describe('TileSet corpus values', () => {
  const props: Record<string, string> = { ...CORPUS };

  it('accepts every value Godot itself wrote, in one TileSet', () => {
    const content = scene(DECLARED, subResource('TileSet', props), node('Node3D', {}, { name: 'Root' }));
    const errors = lint(content).filter((d) => d.severity === 'error');
    expect(errors.map((d) => d.message)).toEqual([]);
  });

  it('routes every corpus key, so the assertion above cannot pass vacuously', () => {
    // A key that reaches no validator is accepted for the wrong reason. The corpus
    // sweep cannot ask this, since it never reaches a `[resource]` block.
    const unrouted = Object.keys(props).filter(
      (key) => validatorRegistry.findValidator('TileSet', key) === null
    );
    expect(unrouted).toEqual([]);
  });

  for (const [key, value] of Object.entries(CORPUS)) {
    it(`accepts ${key} = ${value.slice(0, 48)}`, () => {
      const content = scene(
        DECLARED,
        subResource('TileSet', { [key]: value }),
        node('Node3D', {}, { name: 'Root' })
      );
      expect(lint(content).filter((d) => d.severity === 'error')).toEqual([]);
    });
  }
});
