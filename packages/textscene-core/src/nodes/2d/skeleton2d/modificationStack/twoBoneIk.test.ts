import { describe, expect, it } from 'vitest';
import type { TwoBoneIKModification2D } from '../../../../resources/skeleton/skeletonmodificationstack2d/types';
import { solveStack } from './stackRun';
import {
  chainScene,
  enabledStack,
  expectColumns,
  freeNode,
  rotated,
  translation,
} from './stackScenes.testkit';

const TWO_BONE_IK: TwoBoneIKModification2D = {
  type: 'SkeletonModification2DTwoBoneIK',
  enabled: true,
  executionMode: 0,
  target: 'Target',
  targetMinimumDistance: 0,
  targetMaximumDistance: 0,
  flipBendDirection: false,
  jointOne: { index: 0, node: 'A' },
  jointTwo: { index: 1, node: 'A/B' },
};

/** The scene of `unit-skeleton2d-twoboneik.tscn`: two bones of 150 at (300, 150), and a target in reach. */
function limbScene(target = freeNode(450, 350)) {
  return chainScene(2, 150, translation(300, 150), { Target: target });
}

/** Where the end of the second bone sits on the canvas. */
function tipOf(locals: readonly { a: number; b: number; tx: number; ty: number }[]): {
  x: number;
  y: number;
} {
  const [upper, lower] = locals as [(typeof locals)[0], (typeof locals)[0]];
  const elbow = { x: upper.a * 150, y: upper.b * 150 };
  // The x axis of the lower bone in skeleton space is the upper rotation applied to its own.
  const axis = { x: upper.a * lower.a - upper.b * lower.b, y: upper.b * lower.a + upper.a * lower.b };
  return { x: 300 + elbow.x + axis.x * 150, y: 150 + elbow.y + axis.y * 150 };
}

describe('SkeletonModification2DTwoBoneIK', () => {
  it('bends both bones to the target, as Godot 4.6.3 solves unit-skeleton2d-twoboneik.tscn', () => {
    const { scene, cache } = limbScene();
    const solved = solveStack(scene, cache, enabledStack([TWO_BONE_IK]));
    expectColumns(
      solved.locals[0]!,
      [0.942216634750366, 0.335004240274429, -0.335004240274429, 0.942216634750366, 0, 0]
    );
    expectColumns(
      solved.locals[1]!,
      [0.388888776302338, 0.921284735202789, -0.921284735202789, 0.388888776302338, 150, 0]
    );
    expect(solved.isOverridden).toEqual([true, true]);
  });

  it('moves each bone half way at a stack strength of 0.5, as Godot 4.6.3 solves unit-skeleton2d-stack-strength.tscn', () => {
    const { scene, cache } = limbScene();
    const solved = solveStack(scene, cache, enabledStack([TWO_BONE_IK], 0.5));
    expectColumns(
      solved.locals[0]!,
      [0.98544830083847, 0.16997554898262, -0.16997554898262, 0.98544830083847, 0, 0]
    );
    expectColumns(
      solved.locals[1]!,
      [0.833333313465118, 0.552770853042603, -0.552770853042603, 0.833333313465118, 150, 0]
    );
  });

  it('bends the other way with flip_bend_direction, to the same target', () => {
    const { scene, cache } = limbScene();
    const plain = solveStack(scene, cache, enabledStack([TWO_BONE_IK]));
    const flipped = solveStack(scene, cache, enabledStack([{ ...TWO_BONE_IK, flipBendDirection: true }]));
    expect(flipped.locals[1]!.b).toBeCloseTo(-plain.locals[1]!.b, 4);
    expect(tipOf(flipped.locals).x).toBeCloseTo(450, 2);
    expect(tipOf(flipped.locals).y).toBeCloseTo(350, 2);
  });

  it('points both bones at a target out of reach', () => {
    const { scene, cache } = limbScene(freeNode(300, 950));
    const solved = solveStack(scene, cache, enabledStack([TWO_BONE_IK]));
    expectColumns(solved.locals[0]!, [0, 1, -1, 0, 0, 0]);
    expectColumns(solved.locals[1]!, [1, 0, 0, 1, 150, 0]);
  });

  it('aims no further than target_maximum_distance', () => {
    const { scene, cache } = limbScene(freeNode(300, 950));
    const solved = solveStack(scene, cache, enabledStack([{ ...TWO_BONE_IK, targetMaximumDistance: 150 }]));
    const tip = tipOf(solved.locals);
    expect(Math.hypot(tip.x - 300, tip.y - 150)).toBeCloseTo(150, 2);
  });

  it('aims no nearer than target_minimum_distance', () => {
    const { scene, cache } = limbScene(freeNode(300, 160));
    const solved = solveStack(scene, cache, enabledStack([{ ...TWO_BONE_IK, targetMinimumDistance: 200 }]));
    const tip = tipOf(solved.locals);
    expect(Math.hypot(tip.x - 300, tip.y - 150)).toBeCloseTo(200, 2);
  });

  // `Math::acos` holds its argument inside -1 to 1 (`math_funcs.h:107-112`), so no angle is NaN.
  it('folds the second bone back for a target too near to reach, as Godot 4.6.3 solves it', () => {
    const { scene, cache } = chainScene(2, 60, translation(720, 122), { Target: freeNode(730, 132) });
    scene.bones[1]!.length = 30;
    const solved = solveStack(scene, cache, enabledStack([TWO_BONE_IK]));
    expectColumns(
      solved.locals[0]!,
      [0.707106709480286, 0.707106709480286, -0.707106709480286, 0.707106709480286, 0, 0]
    );
    expectColumns(solved.locals[1]!, [-1, 0, 0, -1, 60, 0]);
  });

  it('starts each frame from the pose an animation wrote, not from the solved one', () => {
    const { scene } = limbScene();
    const animated = [rotated(1), rotated(-0.5, 150, 0)];
    const solved = solveStack(scene, animated, enabledStack([TWO_BONE_IK]));
    expect(tipOf(solved.locals).x).toBeCloseTo(450, 2);
    expect(tipOf(solved.locals).y).toBeCloseTo(350, 2);
  });

  it('keeps the pose where a joint index names no bone', () => {
    const { scene, cache } = limbScene();
    const modification = { ...TWO_BONE_IK, jointTwo: { index: 5, node: undefined } };
    expect(solveStack(scene, cache, enabledStack([modification])).locals).toEqual(cache);
  });
});
