import { runResourcePropertyValidation } from '../../../linter/testing/testkit.js';
import '../../../linter/index';

runResourcePropertyValidation('HeightMapShape3D', [
  {
    prop: 'map_width',
    valid: ['1', '100', '4096'],
    invalid: [
      { value: '0', contains: ['map_width'], severity: 'error' },
      { value: '-4', contains: ['map_width'], severity: 'error' },
    ],
  },
  {
    prop: 'map_depth',
    valid: ['1', '100', '4096'],
    invalid: [{ value: '0', contains: ['map_depth'], severity: 'error' }],
  },
  {
    prop: 'map_data',
    valid: ['PackedFloat32Array(0, 1, -2.5, 3)', 'PackedFloat32Array()'],
    invalid: [{ value: 'PackedFloat32Array(1, oops)', contains: ['map_data'], severity: 'error' }],
  },
]);
