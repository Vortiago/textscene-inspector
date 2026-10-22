import { describe, it, expect } from 'vitest';
import { VECTOR3_AXIS_NAMES, VECTOR3_AXIS_SUFFIXED_NAMES } from './vector3Axis.js';

describe('VECTOR3_AXIS_NAMES', () => {
  it('names each axis as its enum hint does', () => {
    // `aim_modifier_3d.cpp:93` hints `primary_rotation_axis` as "X,Y,Z".
    expect(VECTOR3_AXIS_NAMES).toEqual({ 0: 'X', 1: 'Y', 2: 'Z' });
  });
});

describe('VECTOR3_AXIS_SUFFIXED_NAMES', () => {
  it('names each axis with an _AXIS suffix, as a Sprite3D diagnostic names its axis', () => {
    expect(VECTOR3_AXIS_SUFFIXED_NAMES).toEqual({ 0: 'X_AXIS', 1: 'Y_AXIS', 2: 'Z_AXIS' });
  });
});
