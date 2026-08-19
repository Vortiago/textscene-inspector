/**
 * The `terrain_set_<n>/` family, which is the one TileSet family that nests: a
 * flat `mode` leaf beside a whole second indexed level, `terrain_<m>/name` and
 * `terrain_<m>/color` (tile_set.cpp:3893-3927, :4190-4194).
 *
 * Both index positions are gated on `is_valid_int()` (:3893, :3904) and each has
 * its own `ERR_FAIL_COND_V(… < 0, false)` (:3896, :3905), so a rejected or
 * negative index at either level drops the write.
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
    // tile_set.cpp:4190, PROPERTY_HINT_ENUM "Match Corners and Sides,Match
    // Corners,Match Sides". set_terrain_set_mode (:773) casts the int into the
    // enum and assigns; only the terrain-set INDEX has an ERR_FAIL.
    key: 'terrain_set_0/mode',
    valid: ['0', '1', '2'],
    invalid: [
      { value: '3', severity: 'warning', contains: ['mode', 'TERRAIN_MODE_MATCH_SIDES'] },
      { value: '-1', severity: 'warning', contains: ['mode'] },
      { value: 'corners', severity: 'error', contains: ['mode'] },
    ],
  },
  {
    // tile_set.cpp:4193, Variant::STRING; :3907 refuses a non-string.
    key: 'terrain_set_0/terrain_0/name',
    valid: ['"Grass"', '""'],
    invalid: [{ value: 'Grass', severity: 'error', contains: ['name'] }],
  },
  {
    // tile_set.cpp:4194, Variant::COLOR. set_terrain_color (:866-869) OVERWRITES
    // an alpha that is not 1.0, so the stored colour differs from the written one.
    key: 'terrain_set_0/terrain_0/color',
    valid: ['Color(0.5, 0.34375, 0.25, 1)', 'Color(0, 0, 0, 1)'],
    invalid: [
      { value: 'Color(1, 0, 0, 0.5)', severity: 'error', contains: ['alpha', 'tile_set.cpp:866'] },
      { value: 'Color(1, 0, 0)', severity: 'error', contains: ['color'] },
    ],
  },
  {
    key: 'terrain_set_-1/mode',
    invalid: [{ value: '0', severity: 'error', contains: ['index -1', 'tile_set.cpp:3896'] }],
  },
  {
    // The OUTER guard runs first in `_set`, so it is what reports.
    key: 'terrain_set_-1/terrain_0/name',
    invalid: [{ value: '"a"', severity: 'error', contains: ['index -1', 'tile_set.cpp:3896'] }],
  },
  {
    key: 'terrain_set_0/terrain_-1/name',
    invalid: [{ value: '"a"', severity: 'error', contains: ['index -1', 'tile_set.cpp:3905'] }],
  },
  {
    // `is_valid_int()` refuses either index, and then no terrain set exists to
    // write to.
    key: 'terrain_set_x/mode',
    invalid: [{ value: '0', severity: 'error', contains: ['Unknown', 'terrain_set_x/mode'] }],
  },
  {
    key: 'terrain_set_0/terrain_x/name',
    invalid: [
      { value: '"a"', severity: 'error', contains: ['Unknown', 'terrain_set_0/terrain_x/name'] },
    ],
  },
  {
    // `split("/", true, 2)` caps at three components, so `components[2]` is
    // `name/extra` and matches no leaf.
    key: 'terrain_set_0/terrain_0/name/extra',
    invalid: [
      {
        value: '"a"',
        severity: 'error',
        contains: ['Unknown', 'terrain_set_0/terrain_0/name/extra'],
      },
    ],
  },
  {
    // tile_set.cpp:4191 pushes `terrain_set_<n>/terrains` as
    // PROPERTY_USAGE_EDITOR | PROPERTY_USAGE_ARRAY — no storage bit, and `_set`
    // has no case for it either.
    key: 'terrain_set_0/terrains',
    invalid: [{ value: '1', severity: 'error', contains: ['Unknown', 'terrain_set_0/terrains'] }],
  },
  {
    // A leading `+` passes `is_valid_int()` (ustring.cpp:4752) at both levels.
    key: 'terrain_set_+1/terrain_+2/name',
    valid: ['"Stone"'],
  },
];

describe('TileSet terrain sets', () => {
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
