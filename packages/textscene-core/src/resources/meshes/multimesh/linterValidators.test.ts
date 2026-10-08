import { runResourcePropertyValidation } from '../../../linter/testing/testkit.js';
import '../../../linter/index';

runResourcePropertyValidation('MultiMesh', [
  {
    prop: 'transform_format',
    valid: ['0', '1'],
    invalid: [{ value: '2', contains: ['transform_format'], severity: 'warning' }],
  },
  {
    prop: 'instance_count',
    valid: ['0', '16384', '100000'],
    invalid: [{ value: '-1', contains: ['instance_count'], severity: 'error' }],
  },
  {
    prop: 'visible_instance_count',
    valid: ['-1', '0', '20000'],
    invalid: [{ value: '-2', contains: ['visible_instance_count'], severity: 'error' }],
  },
  {
    prop: 'use_colors',
    valid: ['true', 'false'],
    invalid: [{ value: 'yes', contains: ['use_colors'], severity: 'error' }],
  },
  {
    prop: 'custom_aabb',
    valid: ['AABB(-1, -1, -1, 2, 2, 2)'],
    invalid: [{ value: 'AABB(1, 2)', contains: ['custom_aabb'], severity: 'error' }],
  },
  {
    prop: 'buffer',
    valid: ['PackedFloat32Array(1, 0, 0, 0, 0, 1, 0, 0)', 'PackedFloat32Array()'],
    invalid: [{ value: 'PackedFloat32Array(1, oops)', contains: ['buffer'], severity: 'error' }],
  },
  {
    prop: 'physics_interpolation_quality',
    valid: ['0', '1'],
    invalid: [{ value: '2', contains: ['physics_interpolation_quality'], severity: 'warning' }],
  },
]);
