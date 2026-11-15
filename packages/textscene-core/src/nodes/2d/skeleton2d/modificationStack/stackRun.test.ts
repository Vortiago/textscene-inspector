import { describe, expect, it } from 'vitest';
import type { Modification2D } from '../../../../resources/skeleton/skeletonmodificationstack2d/types';
import { solveStack } from './stackRun';
import { armScene, enabledStack, expectColumns, freeNode, lookAtModification } from './stackScenes.testkit';

/** Turns the bone a quarter turn, to the target below it. */
const LOOK_DOWN = lookAtModification('Below');
const QUARTER_TURN = [0, 1, -1, 0, 0, 0];
const HALF_TURN = [-1, 0, 0, -1, 0, 0];

function twoTargetScene() {
  return armScene({ Below: freeNode(300, 400), Left: freeNode(0, 150) });
}

function solve(modifications: (Modification2D | null)[], strength = 1) {
  const { scene, cache } = twoTargetScene();
  return { cache, solved: solveStack(scene, cache, enabledStack(modifications, strength)) };
}

describe('solveStack', () => {
  it('keeps the pose for a disabled stack, as Godot 4.6.3 solves unit-skeleton2d-stack-disabled.tscn', () => {
    const { scene, cache } = twoTargetScene();
    const solved = solveStack(scene, cache, { ...enabledStack([LOOK_DOWN]), enabled: false });
    expect(solved).toEqual({ locals: cache, isOverridden: [false] });
  });

  it('skips an empty slot and runs the modification after it', () => {
    expectColumns(solve([null, LOOK_DOWN]).solved.locals[0]!, QUARTER_TURN);
  });

  it('runs the modifications in order, so the last one to hold a bone wins', () => {
    const lookLeft = { ...LOOK_DOWN, target: 'Left' };
    expectColumns(solve([LOOK_DOWN, lookLeft]).solved.locals[0]!, HALF_TURN);
    expectColumns(solve([lookLeft, LOOK_DOWN]).solved.locals[0]!, QUARTER_TURN);
  });

  it('holds no bone at a strength of 0', () => {
    const { cache, solved } = solve([LOOK_DOWN], 0);
    expect(solved).toEqual({ locals: cache, isOverridden: [false] });
  });

  // Godot 4.6.3 holds such a bone only in a frame that follows a physics tick, and the Harness
  // frame follows none: `unit-skeleton2d-lookat.tscn` with `execution_mode = 1` reads the identity.
  it('keeps the pose for a modification in the physics mode', () => {
    const { cache, solved } = solve([{ ...LOOK_DOWN, executionMode: 1 }]);
    expect(solved).toEqual({ locals: cache, isOverridden: [false] });
  });

  it.each(['SkeletonModification2DJiggle', 'SkeletonModification2DPhysicalBones'] as const)(
    'keeps the pose for a %s, which needs simulated time',
    (type) => {
      const { cache, solved } = solve([{ type, enabled: true, executionMode: 0 }]);
      expect(solved).toEqual({ locals: cache, isOverridden: [false] });
    }
  );

  describe('SkeletonModification2DStackHolder', () => {
    const holder = (held: Partial<ReturnType<typeof enabledStack>>, own: Partial<Modification2D> = {}) =>
      ({
        type: 'SkeletonModification2DStackHolder',
        enabled: true,
        executionMode: 0,
        heldStack: { ...enabledStack([LOOK_DOWN]), ...held },
        ...own,
      }) as Modification2D;

    it('runs the stack it holds', () => {
      expectColumns(solve([holder({})]).solved.locals[0]!, QUARTER_TURN);
    });

    it('runs the stack it holds while disabled itself', () => {
      expectColumns(solve([holder({}, { enabled: false })]).solved.locals[0]!, QUARTER_TURN);
    });

    it('runs nothing for a held stack that is disabled', () => {
      const { cache, solved } = solve([holder({ enabled: false })]);
      expect(solved.locals).toEqual(cache);
    });

    it('moves a bone by the strength of the held stack, not of the outer one', () => {
      const halfHeld = solve([holder({ strength: 0.5 })]).solved;
      expectColumns(halfHeld.locals[0]!, [Math.SQRT1_2, Math.SQRT1_2, -Math.SQRT1_2, Math.SQRT1_2, 0, 0]);
      expectColumns(solve([holder({})], 0.5).solved.locals[0]!, QUARTER_TURN);
    });
  });
});
