import { describe, expect, it } from 'vitest';
import { NODE_3D_ROTATION_EDIT_MODE_NAMES, NODE_3D_ROTATION_ORDER_NAMES } from './node3d.js';

describe('NODE_3D_ROTATION_ORDER_NAMES', () => {
  it('names the six Euler orders by their axes (math_defs.h:129-136)', () => {
    expect(NODE_3D_ROTATION_ORDER_NAMES).toEqual({
      0: 'XYZ',
      1: 'XZY',
      2: 'YXZ',
      3: 'YZX',
      4: 'ZXY',
      5: 'ZYX',
    });
  });
});

describe('NODE_3D_ROTATION_EDIT_MODE_NAMES', () => {
  it('names the three edit modes as the inspector hint spells them (node_3d.h:62-66)', () => {
    expect(NODE_3D_ROTATION_EDIT_MODE_NAMES).toEqual({ 0: 'Euler', 1: 'Quaternion', 2: 'Basis' });
  });
});
