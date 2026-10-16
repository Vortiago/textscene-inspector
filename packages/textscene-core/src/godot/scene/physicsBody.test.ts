import { describe, expect, it } from 'vitest';
import {
  CCD_MODE_NAMES,
  CENTER_OF_MASS_MODE_NAMES,
  COLLISION_OBJECT_DISABLE_MODE_NAMES,
  DAMP_MODE_NAMES,
  FREEZE_MODE_NAMES,
  PHYSICAL_BONE_JOINT_TYPE_NAMES,
  MOTION_MODE_NAMES,
  PLATFORM_ON_LEAVE_NAMES,
  SOFT_BODY_DISABLE_MODE_NAMES,
} from './physicsBody';

describe('physics body enum label tables', () => {
  it('names the collision object disable modes (collision_object_3d.h:43-47)', () => {
    expect(COLLISION_OBJECT_DISABLE_MODE_NAMES).toEqual({
      0: 'REMOVE',
      1: 'MAKE_STATIC',
      2: 'KEEP_ACTIVE',
    });
  });

  it('names the two SoftBody3D disable modes, which have no MAKE_STATIC (soft_body_3d.h:70-73)', () => {
    expect(SOFT_BODY_DISABLE_MODE_NAMES).toEqual({ 0: 'REMOVE', 1: 'KEEP_ACTIVE' });
  });

  it('names the character body motion modes and platform-on-leave behaviours', () => {
    expect(MOTION_MODE_NAMES).toEqual({ 0: 'GROUNDED', 1: 'FLOATING' });
    expect(PLATFORM_ON_LEAVE_NAMES).toEqual({
      0: 'ADD_VELOCITY',
      1: 'ADD_UPWARD_VELOCITY',
      2: 'DO_NOTHING',
    });
  });

  it('names the rigid body freeze, centre of mass and damp modes', () => {
    expect(FREEZE_MODE_NAMES).toEqual({ 0: 'STATIC', 1: 'KINEMATIC' });
    expect(CENTER_OF_MASS_MODE_NAMES).toEqual({ 0: 'AUTO', 1: 'CUSTOM' });
    expect(DAMP_MODE_NAMES).toEqual({ 0: 'COMBINE', 1: 'REPLACE' });
  });

  it('names the 2D continuous collision detection modes', () => {
    expect(CCD_MODE_NAMES).toEqual({ 0: 'DISABLED', 1: 'CAST_RAY', 2: 'CAST_SHAPE' });
  });

  it('names the PhysicalBone3D joint types with 6DOF last (physical_bone_3d.h:47-54)', () => {
    expect(PHYSICAL_BONE_JOINT_TYPE_NAMES).toEqual({
      0: 'NONE',
      1: 'PIN',
      2: 'CONE',
      3: 'HINGE',
      4: 'SLIDER',
      5: '6DOF',
    });
  });
});
