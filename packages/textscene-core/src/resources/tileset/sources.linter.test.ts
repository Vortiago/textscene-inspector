/**
 * The three families whose keys end in no leaf: `sources/<id>` and `pattern_<n>` are an index,
 * and `tile_proxies/<level>` is a fixed three-key set (tile_set.cpp:3961-4006, :4218-4230). Each
 * is an OBJECT or ARRAY slot guarded in the method `_set` forwards to: `add_source` (:476-479) and
 * `add_pattern` (:1358-1359).
 */

import { describe, expect, it } from 'vitest';
import { expectClean, expectDiagnostic, tileSetKey } from './testing/tileSetScene.js';
import '../../linter/index';

interface KeyCase {
  key: string;
  valid?: string[];
  invalid?: Array<{ value: string; severity: 'error' | 'warning'; contains: string[] }>;
}

const ATLAS = 'SubResource("TileSetAtlasSource_1")';
const PATTERN = 'SubResource("TileMapPattern_1")';

const CASES: KeyCase[] = [
  {
    // tile_set.cpp:4218, an OBJECT slot hinted `TileSetAtlasSource`, with PROPERTY_USAGE_NO_EDITOR:
    // the storage bit alone, so it is written.
    key: 'sources/0',
    valid: [ATLAS],
    invalid: [
      // add_source opens ERR_FAIL_COND_V(p_tile_set_source.is_null()) (:477),
      // so a cleared slot adds no source at all.
      { value: 'null', severity: 'error', contains: ['sources/0', 'tile_set.cpp:477'] },
      { value: '5', severity: 'error', contains: ['source', 'SubResource'] },
    ],
  },
  {
    // `INVALID_SOURCE` is -1 (tile_set.h:214), so this one passes :479 and is re-seated at
    // `next_source_id` (:481): the id in the file is not the id the source gets.
    key: 'sources/-1',
    invalid: [{ value: ATLAS, severity: 'error', contains: ['-1', 'tile_set.cpp:481'] }],
  },
  {
    key: 'sources/-2',
    invalid: [{ value: ATLAS, severity: 'error', contains: ['-2', 'tile_set.cpp:479'] }],
  },
  {
    // `components[1].is_valid_int()` (:3961) refuses this, so no branch claims
    // the key and `_set` returns false.
    key: 'sources/x',
    invalid: [{ value: ATLAS, severity: 'error', contains: ['Unknown', 'sources/x'] }],
  },
  {
    // `components.size() == 2` (:3961): a third component matches no branch.
    key: 'sources/0/texture',
    invalid: [{ value: ATLAS, severity: 'error', contains: ['Unknown', 'sources/0/texture'] }],
  },
  { key: 'sources/+3', valid: [ATLAS] },
  {
    // tile_set.cpp:3971 demands Variant::ARRAY and :3973 an even element count,
    // because each pair is one from/to mapping.
    key: 'tile_proxies/source_level',
    // The typed spelling loads: :3971 tests the Variant type, and a typed Array is
    // `Variant::ARRAY`. What the saver emits bounds none of it.
    valid: ['[]', '[0, 1]', '[0, 1, 2, 3]', 'Array[int]([0, 4, 2, 4])', 'Array[int]([])'],
    invalid: [
      { value: '[0]', severity: 'error', contains: ['even', 'tile_set.cpp:3973'] },
      // The pair count is read out of the wrapped body, not off the head of
      // the value: `slice(1, -1)` here yields `rray[int]([0, 4, 2` and counts 3.
      { value: 'Array[int]([0])', severity: 'error', contains: ['even', 'got 1'] },
      { value: 'Array[int]([0, 4, 2])', severity: 'error', contains: ['even', 'got 3'] },
      { value: '5', severity: 'error', contains: ['source_level'] },
    ],
  },
  {
    key: 'tile_proxies/coords_level',
    valid: ['[[0, Vector2i(0, 0)], [4, Vector2i(0, 0)]]'],
    invalid: [
      {
        value: '[[0, Vector2i(0, 0)]]',
        severity: 'error',
        contains: ['even', 'tile_set.cpp:3973'],
      },
    ],
  },
  { key: 'tile_proxies/alternative_level', valid: ['[]'] },
  {
    // :3994 returns false for any other level name.
    key: 'tile_proxies/bogus_level',
    invalid: [{ value: '[]', severity: 'error', contains: ['Unknown', 'tile_proxies/bogus_level'] }],
  },
  {
    // tile_set.cpp:4230, an OBJECT slot hinted `TileMapPattern`, NO_EDITOR.
    key: 'pattern_0',
    valid: [PATTERN],
    invalid: [
      // add_pattern opens ERR_FAIL_COND_V(p_pattern.is_null()) (:1359).
      { value: 'null', severity: 'error', contains: ['pattern_0', 'tile_set.cpp:1359'] },
      { value: '5', severity: 'error', contains: ['pattern'] },
    ],
  },
  {
    // `for (int i = patterns.size(); i <= pattern_index; i++)` (:3997) never
    // runs for a negative index, and `_set` still returns true, so the write is
    // dropped in silence.
    key: 'pattern_-1',
    invalid: [{ value: PATTERN, severity: 'error', contains: ['-1', 'tile_set.cpp:3997'] }],
  },
  {
    // `trim_prefix("pattern_").is_valid_int()` (:3995) refuses this.
    key: 'pattern_x',
    invalid: [{ value: PATTERN, severity: 'error', contains: ['Unknown', 'pattern_x'] }],
  },
  { key: 'pattern_+2', valid: [PATTERN] },
  {
    // `components.size() == 1` (:3995), so the write is dropped, and nothing reports it: the
    // terminal-index routing claims no key with a `/` past the glued `pattern_` prefix. Godot never
    // writes this key, so it falls through unclaimed, as any key no type declares does.
    key: 'pattern_0/cells',
    valid: [PATTERN],
  },
];

describe('TileSet sources, tile proxies and patterns', () => {
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
          expect(found.location?.line).toBe(4);
        });
      }
    });
  }
});
