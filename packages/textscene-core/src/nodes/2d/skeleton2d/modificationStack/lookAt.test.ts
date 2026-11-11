import { describe, expect, it } from 'vitest';
import { TRANSFORM2D_IDENTITY } from '../../../../godot/math/transform2d.js';
import { solveStack } from './stackRun';
import {
  armScene,
  enabledStack,
  expectColumns,
  freeNode,
  lookAtModification,
  NO_CONSTRAINT,
} from './stackScenes.testkit';

const LOOK_AT = lookAtModification('Target');

/** The scene of `unit-skeleton2d-lookat.tscn`, with the target straight below the bone. */
function targetScene(target = freeNode(300, 400)) {
  return armScene({ Target: target });
}

describe('SkeletonModification2DLookAt', () => {
  it('turns the bone to point at the target, as Godot 4.6.3 solves unit-skeleton2d-lookat.tscn', () => {
    const { scene, cache } = targetScene();
    const solved = solveStack(scene, cache, enabledStack([LOOK_AT]));
    expectColumns(solved.locals[0]!, [0, 1, -1, 0, 0, 0]);
    expect(solved.isOverridden).toEqual([true]);
  });

  it('adds the additional rotation to the solved one', () => {
    const { scene, cache } = targetScene();
    const solved = solveStack(scene, cache, enabledStack([{ ...LOOK_AT, additionalRotation: Math.PI / 2 }]));
    expectColumns(solved.locals[0]!, [-1, 0, 0, -1, 0, 0]);
  });

  it('subtracts the bone angle, so the kite and not the x axis points at the target', () => {
    const { scene, cache } = targetScene();
    const bones = [{ ...scene.bones[0]!, boneAngle: Math.PI / 2 }];
    const solved = solveStack({ ...scene, bones }, cache, enabledStack([LOOK_AT]));
    expectColumns(solved.locals[0]!, [1, 0, 0, 1, 0, 0]);
  });

  it('keeps a constrained local rotation inside the limit', () => {
    const { scene, cache } = targetScene();
    const constraint = { ...NO_CONSTRAINT, enabled: true, min: 0, max: Math.PI / 4 };
    const solved = solveStack(scene, cache, enabledStack([{ ...LOOK_AT, constraint }]));
    expectColumns(solved.locals[0]!, [Math.SQRT1_2, Math.SQRT1_2, -Math.SQRT1_2, Math.SQRT1_2, 0, 0]);
  });

  it('uses the stored index where the modification names no bone path', () => {
    const { scene, cache } = targetScene();
    const solved = solveStack(
      scene,
      cache,
      enabledStack([{ ...LOOK_AT, bone: { index: 0, node: undefined } }])
    );
    expectColumns(solved.locals[0]!, [0, 1, -1, 0, 0, 0]);
  });

  it.each([
    ['a bone path that names no node', { ...LOOK_AT, bone: { index: 0, node: 'Missing' } }],
    ['a target path that names no node', { ...LOOK_AT, target: 'Missing' }],
    ['no target path', { ...LOOK_AT, target: undefined }],
    ['a bone index of -1', { ...LOOK_AT, bone: { index: -1, node: undefined } }],
    ['a bone index past the last bone', { ...LOOK_AT, bone: { index: 1, node: undefined } }],
    ['a disabled modification', { ...LOOK_AT, enabled: false }],
  ])('leaves the pose alone for %s', (_case, modification) => {
    const { scene, cache } = targetScene();
    const solved = solveStack(scene, cache, enabledStack([modification]));
    expect(solved.locals).toEqual([TRANSFORM2D_IDENTITY]);
    expect(solved.isOverridden).toEqual([false]);
  });
});
