/**
 * The four flat indexed layer families, through the full Linter. Each gates on
 * `trim_prefix(<prefix>).is_valid_int()` (tile_set.cpp:3839, :3859, :3928, :3942)
 * and `ERR_FAIL_COND_V(index < 0, false)` (:3842, :3862, :3932, :3945). Leaf tiers
 * come from `_get_property_list` (:4148-4212).
 */

import { describe, expect, it } from 'vitest';
import { expectClean, expectDiagnostic, tileSetKey } from './testing/tileSetScene.js';
import '../../linter/index';

interface KeyCase {
  key: string;
  valid?: string[];
  invalid?: Array<{ value: string; severity: 'error' | 'warning'; contains: string[] }>;
}

const CASES: KeyCase[] = [
  {
    // tile_set.cpp:4148, PROPERTY_HINT_LAYERS_2D_RENDER over a bare assignment
    // (:622): 32 checkboxes express every pattern, so no value is out of range.
    // This hint states no numeric bound.
    key: 'occlusion_layer_0/light_mask',
    valid: ['1', '0', '-1', '2147483647'],
    invalid: [{ value: 'true', severity: 'warning', contains: ['light_mask'] }],
  },
  {
    // tile_set.cpp:3851 demands Variant::BOOL.
    key: 'occlusion_layer_0/sdf_collision',
    valid: ['true', 'false'],
    invalid: [{ value: '1', severity: 'warning', contains: ['sdf_collision'] }],
  },
  {
    key: 'physics_layer_0/collision_layer',
    valid: ['1', '16', '4294967295'],
    invalid: [{ value: 'all', severity: 'error', contains: ['collision_layer'] }],
  },
  {
    key: 'physics_layer_0/collision_mask',
    valid: ['0', '1'],
    invalid: [{ value: 'all', severity: 'error', contains: ['collision_mask'] }],
  },
  {
    // tile_set.cpp:4172, Variant::FLOAT with PROPERTY_HINT_NONE over a bare
    // assignment (:706), so both ends are open.
    key: 'physics_layer_0/collision_priority',
    valid: ['1.0', '0.0', '-2.5', '1000'],
    invalid: [{ value: 'heavy', severity: 'error', contains: ['collision_priority'] }],
  },
  {
    // tile_set.cpp:3884 takes the value as a `Ref<PhysicsMaterial>` with no type
    // check at all, so a cleared slot is stored as an invalid Ref.
    key: 'physics_layer_0/physics_material',
    valid: ['null'],
    invalid: [{ value: '5', severity: 'error', contains: ['physics_material'] }],
  },
  {
    key: 'navigation_layer_0/layers',
    valid: ['1', '0', '4294967295'],
    invalid: [{ value: 'ground', severity: 'error', contains: ['layers'] }],
  },
  {
    // tile_set.cpp:3947 demands `p_value.is_string()`.
    key: 'custom_data_layer_0/name',
    valid: ['"speed"', '""'],
    invalid: [{ value: 'speed', severity: 'error', contains: ['name'] }],
  },
  {
    // tile_set.cpp:4212's hint is built from Variant::VARIANT_MAX, so it names
    // 0..38, the one closed PROPERTY_HINT_ENUM. set_custom_data_layer_type (:1141)
    // casts straight into the enum.
    key: 'custom_data_layer_0/type',
    valid: ['0', '2', '38'],
    invalid: [
      { value: '39', severity: 'warning', contains: ['type', '0 and 38'] },
      { value: '-1', severity: 'warning', contains: ['type'] },
    ],
  },
  {
    // The dispatcher's key verdicts, one family standing for all four.
    key: 'occlusion_layer_0/bogus',
    invalid: [
      { value: '1', severity: 'error', contains: ['Unknown', 'occlusion_layer_0/bogus'] },
    ],
  },
  {
    key: 'occlusion_layer_-1/light_mask',
    invalid: [{ value: '1', severity: 'error', contains: ['index -1', 'tile_set.cpp:3842'] }],
  },
  {
    // `is_valid_int()` refuses this index, so `_set` resolves no layer at all.
    key: 'occlusion_layer_x/light_mask',
    invalid: [
      { value: '1', severity: 'error', contains: ['Unknown', 'occlusion_layer_x/light_mask'] },
    ],
  },
  {
    // `is_valid_int()` skips one leading sign (ustring.cpp:4752), so this resolves
    // to layer 5 and the write lands.
    key: 'occlusion_layer_+5/light_mask',
    valid: ['1'],
  },
  {
    // Each family owns only its own leaves: `name` is a custom-data leaf (:3946),
    // so under `physics_layer_` it falls to the closing `return false` (:4007).
    key: 'physics_layer_0/name',
    invalid: [
      { value: '"nope"', severity: 'error', contains: ['Unknown', 'physics_layer_0/name'] },
    ],
  },
];

describe('TileSet layer families', () => {
  for (const testCase of CASES) {
    describe(testCase.key, () => {
      for (const value of testCase.valid ?? []) {
        it(`accepts ${value}`, () => expectClean(tileSetKey(testCase.key, value)));
      }
      for (const bad of testCase.invalid ?? []) {
        it(`rejects ${bad.value}`, () => {
          const found = expectDiagnostic(tileSetKey(testCase.key, bad.value), {
            contains: bad.contains,
            severity: bad.severity,
          });
          // The property's own line pins the diagnostic to the key under test. A
          // leaf validator names the leaf, so `runResourcePropertyValidation`'s
          // message lookup would miss it.
          expect(found.location?.line).toBe(4);
        });
      }
    });
  }
});
