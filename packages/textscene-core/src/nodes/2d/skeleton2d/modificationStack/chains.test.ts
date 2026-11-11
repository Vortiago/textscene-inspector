import { describe, expect, it } from 'vitest';
import type {
  CCDIKModification2D,
  FABRIKModification2D,
} from '../../../../resources/skeleton/skeletonmodificationstack2d/types';
import { solveStack } from './stackRun';
import {
  chainScene,
  enabledStack,
  expectColumns,
  freeNode,
  NO_CONSTRAINT,
  rotated,
  translation,
} from './stackScenes.testkit';

const PATHS = ['A', 'A/B', 'A/B/C'];

const FABRIK: FABRIKModification2D = {
  type: 'SkeletonModification2DFABRIK',
  enabled: true,
  executionMode: 0,
  target: 'Target',
  joints: PATHS.map((node, index) => ({
    bone: { index, node },
    magnetPosition: { x: 0, y: 0 },
    useTargetRotation: false,
  })),
};

const CCDIK: CCDIKModification2D = {
  type: 'SkeletonModification2DCCDIK',
  enabled: true,
  executionMode: 0,
  target: 'Target',
  tip: 'Tip',
  joints: PATHS.map((node, index) => ({
    bone: { index, node },
    rotateFromJoint: false,
    constraint: NO_CONSTRAINT,
  })),
};

/** The scene of the two chain fixtures: three bones of 100 at (250, 150), and a target in reach. */
function threeBoneChain() {
  return chainScene(3, 100, translation(250, 150), { Target: freeNode(400, 380) });
}

describe('SkeletonModification2DFABRIK', () => {
  it('reaches the target with the chain, as Godot 4.6.3 solves unit-skeleton2d-fabrik.tscn', () => {
    const { scene, cache } = threeBoneChain();
    const solved = solveStack(scene, cache, enabledStack([FABRIK]));
    expectColumns(
      solved.locals[0]!,
      [0.882208526134491, 0.470858305692673, -0.470858305692673, 0.882208526134491, 0, 0]
    );
    expectColumns(
      solved.locals[1]!,
      [0.882000803947449, 0.471248418092728, -0.471248418092728, 0.882000803947449, 100, 0]
    );
    expectColumns(
      solved.locals[2]!,
      [0.863707184791565, 0.5039923787117, -0.5039923787117, 0.863707184791565, 100, 0]
    );
    expect(solved.isOverridden).toEqual([true, true, true]);
  });

  it('keeps the pose where a joint names no bone path', () => {
    const { scene, cache } = threeBoneChain();
    const joints = FABRIK.joints.map((joint, index) =>
      index === 1 ? { ...joint, bone: { index, node: undefined } } : joint
    );
    expect(solveStack(scene, cache, enabledStack([{ ...FABRIK, joints }])).locals).toEqual(cache);
  });

  it('keeps the pose for a chain of one joint', () => {
    const { scene, cache } = threeBoneChain();
    const modification = { ...FABRIK, joints: FABRIK.joints.slice(0, 1) };
    expect(solveStack(scene, cache, enabledStack([modification])).locals).toEqual(cache);
  });
});

describe('SkeletonModification2DCCDIK', () => {
  it('carries the tip to the target, as Godot 4.6.3 solves unit-skeleton2d-ccdik.tscn', () => {
    const { scene, cache } = threeBoneChain();
    cache[1] = rotated(0.3, 100, 0);
    const solved = solveStack(scene, cache, enabledStack([CCDIK]));
    expectColumns(solved.locals[0]!, [0.922893, 0.385056, -0.385056, 0.922893, 0, 0]);
    expectColumns(solved.locals[1]!, [0.634984, 0.772526, -0.772526, 0.634984, 100, 0]);
    expectColumns(solved.locals[2]!, [1, 0, 0, 1, 100, 0]);
    expect(solved.isOverridden).toEqual([true, true, true]);
  });

  it('keeps the pose where the tip path names no node', () => {
    const { scene, cache } = threeBoneChain();
    expect(solveStack(scene, cache, enabledStack([{ ...CCDIK, tip: 'Missing' }])).locals).toEqual(cache);
  });
});
