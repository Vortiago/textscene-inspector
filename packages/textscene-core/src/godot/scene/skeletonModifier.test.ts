import { describe, it, expect } from 'vitest';
import {
  AXIS_FLAG_NAMES,
  BONE_AXIS_NAMES,
  BONE_DIRECTION_NAMES,
  XR_HAND_MODIFIER_BONE_UPDATE_NAMES,
  BODY_UPDATE_NAMES,
  BoneAxis,
  CENTER_FROM_NAMES,
  COPY_TRANSFORM_FLAG_NAMES,
  DISPERSE_MODE_NAMES,
  ORIGIN_FROM_NAMES,
  REFERENCE_TYPE_NAMES,
  RETARGET_TRANSFORM_FLAG_NAMES,
  ROTATION_AXIS_NAMES,
  SECONDARY_DIRECTION_NAMES,
  SecondaryDirection,
  TRANSFORM_MODE_NAMES,
  TransformMode,
  XR_BODY_MODIFIER_BONE_UPDATE_NAMES,
} from './skeletonModifier.js';

describe('SkeletonModifier3D axis names', () => {
  it('names each bone axis as `get_hint_bone_axis()` prints it', () => {
    expect(BONE_AXIS_NAMES).toEqual({ 0: '+X', 1: '-X', 2: '+Y', 3: '-Y', 4: '+Z', 5: '-Z' });
  });

  it('names each bone direction as `get_hint_bone_direction()` prints it', () => {
    expect(BONE_DIRECTION_NAMES).toEqual({ ...BONE_AXIS_NAMES, 6: 'FromParent' });
  });

  it('names each secondary direction as `get_hint_secondary_direction()` prints it', () => {
    expect(SECONDARY_DIRECTION_NAMES).toEqual({
      0: 'None',
      1: '+X',
      2: '-X',
      3: '+Y',
      4: '-Y',
      5: '+Z',
      6: '-Z',
      7: 'Custom',
    });
  });

  it('names each rotation axis as `get_hint_rotation_axis()` prints it', () => {
    expect(ROTATION_AXIS_NAMES).toEqual({ 0: 'X', 1: 'Y', 2: 'Z', 3: 'All', 4: 'Custom' });
  });

  it('keeps the integers the rules compare against', () => {
    expect([BoneAxis.PLUS_Y, BoneAxis.PLUS_Z]).toEqual([2, 4]);
    expect([SecondaryDirection.NONE, SecondaryDirection.CUSTOM]).toEqual([0, 7]);
  });
});

describe('modifier setting names', () => {
  it('names each look-at origin as `look_at_modifier_3d.cpp:478` hints it', () => {
    expect(ORIGIN_FROM_NAMES).toEqual({ 0: 'Self', 1: 'SpecificBone', 2: 'ExternalNode' });
  });

  it('names each disperse mode as `bone_twist_disperser_3d.cpp:154` hints it', () => {
    expect(DISPERSE_MODE_NAMES).toEqual({ 0: 'Even', 1: 'Weighted', 2: 'Custom' });
  });

  it('names each spring bone centre as `spring_bone_simulator_3d.cpp:300` hints it', () => {
    expect(CENTER_FROM_NAMES).toEqual({ 0: 'WorldOrigin', 1: 'Node', 2: 'Bone' });
  });

  it('names each reference type by its constant', () => {
    expect(REFERENCE_TYPE_NAMES).toEqual({ 0: 'REFERENCE_TYPE_BONE', 1: 'REFERENCE_TYPE_NODE' });
  });

  it('names each transform mode as `convert_transform_modifier_3d.cpp` hints it', () => {
    expect(TRANSFORM_MODE_NAMES).toEqual({ 0: 'Position', 1: 'Rotation', 2: 'Scale' });
    expect([TransformMode.POSITION, TransformMode.ROTATION]).toEqual([0, 1]);
  });
});

describe('modifier flag names', () => {
  it('names the copy-transform flags as `copy_transform_modifier_3d.cpp:90` hints them', () => {
    expect(COPY_TRANSFORM_FLAG_NAMES).toEqual({ 1: 'Position', 2: 'Rotation', 4: 'Scale' });
  });

  it('names the retarget flags by their constants', () => {
    expect(RETARGET_TRANSFORM_FLAG_NAMES).toEqual({
      1: 'TRANSFORM_FLAG_POSITION',
      2: 'TRANSFORM_FLAG_ROTATION',
      4: 'TRANSFORM_FLAG_SCALE',
    });
  });

  it('names the axis flags as `copy_transform_modifier_3d.cpp:91` hints them', () => {
    expect(AXIS_FLAG_NAMES).toEqual({ 1: 'X', 2: 'Y', 4: 'Z' });
  });
});

describe('XR modifier names', () => {
  it('names the body update flags by their constants', () => {
    expect(BODY_UPDATE_NAMES).toEqual({
      1: 'BODY_UPDATE_UPPER_BODY',
      2: 'BODY_UPDATE_LOWER_BODY',
      4: 'BODY_UPDATE_HANDS',
    });
  });

  it('leaves BONE_UPDATE_MAX out of the bone update modes', () => {
    expect(XR_HAND_MODIFIER_BONE_UPDATE_NAMES).toEqual({ 0: 'FULL', 1: 'ROTATION_ONLY' });
  });

  it('prefixes the bone update modes as `xr_body_modifier_3d.h:53-55` spells them', () => {
    expect(XR_BODY_MODIFIER_BONE_UPDATE_NAMES).toEqual({
      0: 'BONE_UPDATE_FULL',
      1: 'BONE_UPDATE_ROTATION_ONLY',
    });
  });
});
