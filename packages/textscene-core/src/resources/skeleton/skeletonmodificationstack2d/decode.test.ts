/**
 * SkeletonModificationStack2D decode against the scene Godot 4.6.3 saves for a stack that holds
 * one modification of each type.
 */

import { describe, expect, it } from 'vitest';
import type { ParsedResource } from '../../../parser/parsedResource';
import type { TscnInternalResource } from '../../../parser/types';
import type { SceneResources } from '../../../r3f/SceneResourcesContext';
import { degToRadf } from '../../../godot/math/math.js';
import { decodeModificationStack, modificationStackFiles } from './decode';
import type { Modification2D } from './types';

const sub = (id: string, type: string, data: Record<string, string>): TscnInternalResource =>
  ({ id, type, data }) as TscnInternalResource;

function poolsOf(internalResources: TscnInternalResource[]): SceneResources {
  return { internalResources, externalResources: [] } as unknown as SceneResources;
}

const NO_FILES = () => undefined;

function decodeOne(type: string, data: Record<string, string>): Modification2D | null {
  const pools = poolsOf([
    sub('mod', type, data),
    sub('stack', 'SkeletonModificationStack2D', {
      modification_count: '1',
      'modifications/0': 'SubResource("mod")',
    }),
  ]);
  return decodeModificationStack('SubResource("stack")', pools, NO_FILES)!.modifications[0]!;
}

describe('decodeModificationStack', () => {
  it('reads a stack at its defaults: disabled, full strength, no modification', () => {
    const pools = poolsOf([sub('stack', 'SkeletonModificationStack2D', {})]);

    expect(decodeModificationStack('SubResource("stack")', pools, NO_FILES)).toEqual({
      enabled: false,
      strength: 1,
      modifications: [],
    });
  });

  it('reads enabled, strength and one slot for each of modification_count', () => {
    const pools = poolsOf([
      sub('stack', 'SkeletonModificationStack2D', {
        enabled: 'true',
        strength: '0.5',
        modification_count: '2',
        'modifications/1': 'SubResource("jiggle")',
      }),
      sub('jiggle', 'SkeletonModification2DJiggle', {}),
    ]);

    expect(decodeModificationStack('SubResource("stack")', pools, NO_FILES)).toEqual({
      enabled: true,
      strength: 0.5,
      modifications: [null, { type: 'SkeletonModification2DJiggle', enabled: true, executionMode: 0 }],
    });
  });

  // `set_strength` returns before it stores such a value (`skeleton_modification_stack_2d.cpp:232-233`).
  it.each(['1.5', '-0.25'])('keeps the default strength for the %s the setter refuses', (strength) => {
    const pools = poolsOf([sub('stack', 'SkeletonModificationStack2D', { strength })]);

    expect(decodeModificationStack('SubResource("stack")', pools, NO_FILES)?.strength).toBe(1);
  });

  it('answers null for no stack and for a resource of another type', () => {
    const pools = poolsOf([sub('curve', 'Curve', {})]);

    expect(decodeModificationStack(undefined, pools, NO_FILES)).toBeNull();
    expect(decodeModificationStack('SubResource("curve")', pools, NO_FILES)).toBeNull();
  });

  it('reads a LookAt with its constraint in radians', () => {
    const lookAt = decodeOne('SkeletonModification2DLookAt', {
      bone_index: '0',
      bone2d_node: 'NodePath("Arm")',
      target_nodepath: 'NodePath("../Target")',
      enable_constraint: 'true',
      constraint_angle_min: '9.999999',
      constraint_angle_max: '360.0',
      constraint_angle_invert: 'false',
      constraint_in_localspace: 'true',
      additional_rotation: '30.0',
    });

    expect(lookAt).toEqual({
      type: 'SkeletonModification2DLookAt',
      enabled: true,
      executionMode: 0,
      bone: { index: 0, node: 'NodePath("Arm")' },
      target: 'NodePath("../Target")',
      additionalRotation: degToRadf(30),
      constraint: {
        enabled: true,
        min: degToRadf(9.999999),
        max: degToRadf(360),
        invert: false,
        inLocalSpace: true,
      },
    });
  });

  it('reads an empty NodePath as no path, which `is_empty` gates the bone cache on', () => {
    const lookAt = decodeOne('SkeletonModification2DLookAt', {
      bone_index: '2',
      bone2d_node: 'NodePath("")',
      target_nodepath: 'NodePath("")',
    });

    expect(lookAt).toMatchObject({ bone: { index: 2, node: undefined }, target: undefined });
  });

  it('reads a LookAt at its defaults: no bone, no constraint, a full turn as the maximum', () => {
    expect(decodeOne('SkeletonModification2DLookAt', {})).toMatchObject({
      bone: { index: -1, node: undefined },
      target: undefined,
      additionalRotation: 0,
      constraint: { enabled: false, min: 0, max: 2 * Math.PI, invert: false, inLocalSpace: true },
    });
  });

  it('reads a TwoBoneIK with its joints, its distances and its mode', () => {
    const ik = decodeOne('SkeletonModification2DTwoBoneIK', {
      execution_mode: '1',
      target_nodepath: 'NodePath("../Target")',
      target_minimum_distance: '20.0',
      target_maximum_distance: '250.0',
      flip_bend_direction: 'true',
      joint_one_bone_idx: '0',
      joint_one_bone2d_node: 'NodePath("Arm")',
      joint_two_bone_idx: '1',
      joint_two_bone2d_node: 'NodePath("Arm/Fore")',
    });

    expect(ik).toEqual({
      type: 'SkeletonModification2DTwoBoneIK',
      enabled: true,
      executionMode: 1,
      target: 'NodePath("../Target")',
      targetMinimumDistance: 20,
      targetMaximumDistance: 250,
      flipBendDirection: true,
      jointOne: { index: 0, node: 'NodePath("Arm")' },
      jointTwo: { index: 1, node: 'NodePath("Arm/Fore")' },
    });
  });

  it('reads a CCDIK chain, one joint for each of ccdik_data_chain_length', () => {
    const ccdik = decodeOne('SkeletonModification2DCCDIK', {
      target_nodepath: 'NodePath("../Target")',
      tip_nodepath: 'NodePath("Arm/Fore")',
      ccdik_data_chain_length: '2',
      'joint_data/0/bone_index': '0',
      'joint_data/0/bone2d_node': 'NodePath("Arm")',
      'joint_data/1/bone_index': '1',
      'joint_data/1/bone2d_node': 'NodePath("Arm/Fore")',
      'joint_data/1/rotate_from_joint': 'true',
      'joint_data/1/enable_constraint': 'true',
      'joint_data/1/constraint_angle_max': '90.0',
      'joint_data/2/bone_index': '7',
    });

    const free = { enabled: false, min: 0, max: 2 * Math.PI, invert: false, inLocalSpace: true };
    expect(ccdik).toMatchObject({
      type: 'SkeletonModification2DCCDIK',
      target: 'NodePath("../Target")',
      tip: 'NodePath("Arm/Fore")',
      joints: [
        { bone: { index: 0, node: 'NodePath("Arm")' }, rotateFromJoint: false, constraint: free },
        {
          bone: { index: 1, node: 'NodePath("Arm/Fore")' },
          rotateFromJoint: true,
          constraint: { ...free, enabled: true, max: degToRadf(90) },
        },
      ],
    });
  });

  it('reads a FABRIK chain with its magnets', () => {
    const fabrik = decodeOne('SkeletonModification2DFABRIK', {
      enabled: 'false',
      target_nodepath: 'NodePath("../Target")',
      fabrik_data_chain_length: '2',
      'joint_data/0/bone_index': '0',
      'joint_data/0/bone2d_node': 'NodePath("Arm")',
      'joint_data/1/bone_index': '1',
      'joint_data/1/bone2d_node': 'NodePath("Arm/Fore")',
      'joint_data/1/magnet_position': 'Vector2(3, 4)',
      'joint_data/1/use_target_rotation': 'true',
    });

    expect(fabrik).toEqual({
      type: 'SkeletonModification2DFABRIK',
      enabled: false,
      executionMode: 0,
      target: 'NodePath("../Target")',
      joints: [
        {
          bone: { index: 0, node: 'NodePath("Arm")' },
          magnetPosition: { x: 0, y: 0 },
          useTargetRotation: false,
        },
        {
          bone: { index: 1, node: 'NodePath("Arm/Fore")' },
          magnetPosition: { x: 3, y: 4 },
          useTargetRotation: true,
        },
      ],
    });
  });

  it('reads the stack a StackHolder holds', () => {
    const pools = poolsOf([
      sub('held', 'SkeletonModificationStack2D', { enabled: 'true' }),
      sub('holder', 'SkeletonModification2DStackHolder', { held_modification_stack: 'SubResource("held")' }),
      sub('stack', 'SkeletonModificationStack2D', {
        modification_count: '1',
        'modifications/0': 'SubResource("holder")',
      }),
    ]);

    expect(decodeModificationStack('SubResource("stack")', pools, NO_FILES)!.modifications[0]).toEqual({
      type: 'SkeletonModification2DStackHolder',
      enabled: true,
      executionMode: 0,
      heldStack: { enabled: true, strength: 1, modifications: [] },
    });
  });

  it('holds no stack where a StackHolder holds its own stack (edge case)', () => {
    const pools = poolsOf([
      sub('holder', 'SkeletonModification2DStackHolder', { held_modification_stack: 'SubResource("stack")' }),
      sub('stack', 'SkeletonModificationStack2D', {
        modification_count: '1',
        'modifications/0': 'SubResource("holder")',
      }),
    ]);

    expect(decodeModificationStack('SubResource("stack")', pools, NO_FILES)!.modifications[0]).toMatchObject({
      heldStack: null,
    });
  });

  it('leaves a slot empty for a resource that is no modification (edge case)', () => {
    expect(decodeOne('Curve', {})).toBeNull();
  });
});

describe('modificationStackFiles', () => {
  const stackFile = {
    resourceType: 'SkeletonModificationStack2D',
    properties: { modification_count: '1', 'modifications/0': 'ExtResource("1")' },
    extResources: [{ id: '1', type: 'Resource', path: 'res://look.tres' }],
    subResources: [],
  } as unknown as ParsedResource;
  const pools = {
    internalResources: [],
    externalResources: [{ id: 's', type: 'Resource', path: 'res://stack.tres' }],
  } as unknown as SceneResources;

  it('names the file of an external stack, then the files its modifications load from', () => {
    expect(modificationStackFiles('ExtResource("s")', pools, NO_FILES)).toEqual(['res://stack.tres']);
    expect(
      modificationStackFiles('ExtResource("s")', pools, (path) =>
        path === 'res://stack.tres' ? stackFile : undefined
      )
    ).toEqual(['res://stack.tres', 'res://look.tres']);
  });
});
