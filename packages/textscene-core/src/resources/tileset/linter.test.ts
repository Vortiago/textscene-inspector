/**
 * TileSet's own scalar properties, through the full Linter.
 *
 * The four grid keys are `ADD_PROPERTY` with a `PROPERTY_HINT_ENUM`
 * (tile_set.cpp:4266-4269) over setters that assign straight through
 * (`set_tile_shape` :352, `set_tile_layout` :368, `set_tile_offset_axis` :376),
 * so an out-of-enum value WARNS. `set_tile_size` is the one that refuses:
 * `ERR_FAIL_COND(p_size.x < 1 || p_size.y < 1)` (:392).
 */

import { runResourcePropertyValidation } from '../../linter/testing/testkit.js';
import '../../linter/index';

runResourcePropertyValidation('TileSet', [
  {
    prop: 'tile_shape',
    valid: ['0', '1', '2', '3'],
    invalid: [
      { value: '4', contains: ['tile_shape', 'TILE_SHAPE_HEXAGON'], severity: 'warning' },
      { value: '-1', contains: ['tile_shape'], severity: 'warning' },
      { value: 'square', contains: ['tile_shape'], severity: 'error' },
    ],
  },
  {
    prop: 'tile_layout',
    valid: ['0', '1', '2', '3', '4', '5'],
    invalid: [{ value: '6', contains: ['tile_layout'], severity: 'warning' }],
  },
  {
    prop: 'tile_offset_axis',
    valid: ['0', '1'],
    invalid: [{ value: '2', contains: ['tile_offset_axis'], severity: 'warning' }],
  },
  {
    prop: 'tile_size',
    valid: ['Vector2i(1, 1)', 'Vector2i(16, 16)', 'Vector2i(110, 94)'],
    invalid: [
      { value: 'Vector2i(0, 16)', contains: ['tile_size'], severity: 'error' },
      { value: 'Vector2i(16, -1)', contains: ['tile_size'], severity: 'error' },
    ],
  },
  {
    prop: 'uv_clipping',
    valid: ['true', 'false'],
    invalid: [{ value: '1', contains: ['uv_clipping'], severity: 'error' }],
  },
]);
