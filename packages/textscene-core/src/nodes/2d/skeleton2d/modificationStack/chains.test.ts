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
  outsideChainNodes,
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

describe('SkeletonModification2DFABRIK on the bones of another skeleton', () => {
  /** Three bones of 80 at (200, 120), and the same chain of the skeleton Far at (200, 330). */
  function twoChains() {
    return chainScene(3, 80, translation(200, 120), {
      Target: freeNode(330, 500),
      ...outsideChainNodes(3, 80, translation(200, 330)),
    });
  }

  const ON_FAR: FABRIKModification2D = {
    ...FABRIK,
    joints: FABRIK.joints.map((joint) => ({
      ...joint,
      bone: { ...joint.bone, node: `Far/${joint.bone.node}` },
    })),
  };

  // Godot 4.6.3 on unit-skeleton2d-fabrik-foreign.tscn: the bones of Far, then the same on Near.
  const SOLVED = [
    [0.936635, 0.350307, -0.350307, 0.936635, 0, 0],
    [0.862298, 0.506401, -0.506401, 0.862298, 80, 0],
    [0.811691, 0.584087, -0.584087, 0.811691, 80, 0],
  ];

  it('moves the bones the joints name to the target', () => {
    const { scene, cache } = twoChains();
    const solved = solveStack(scene, cache, enabledStack([ON_FAR]));
    SOLVED.forEach((columns, bone) => expectColumns(solved.locals[3 + bone]!, columns));
  });

  it('gives each bone of the skeleton the transform of the outside bone at its index', () => {
    const { scene, cache } = twoChains();
    const solved = solveStack(scene, cache, enabledStack([ON_FAR]));
    SOLVED.forEach((columns, bone) => expectColumns(solved.locals[bone]!, columns));
    expect(solved.isOverridden).toEqual([true, true, true]);
  });

  it('moves the outside bones the whole way at a stack strength of a half', () => {
    const { scene, cache } = twoChains();
    const solved = solveStack(scene, cache, enabledStack([ON_FAR], 0.5));
    SOLVED.forEach((columns, bone) => expectColumns(solved.locals[3 + bone]!, columns));
    expect(solved.locals[0]!.b).toBeCloseTo(Math.sin(Math.atan2(0.350307, 0.936635) / 2), 4);
  });

  it('moves the outside bones and no bone of the skeleton for bones that join no skeleton', () => {
    const { scene, cache } = twoChains();
    for (const node of scene.nodes.values()) if (node.outsideBone) node.indexInSkeleton = -1;
    const solved = solveStack(scene, cache, enabledStack([ON_FAR]));
    expect(solved.locals.slice(0, 3)).toEqual(cache);
    expectColumns(solved.locals[3]!, SOLVED[0]!);
  });

  it('keeps every bone where a joint names a node that is no Bone2D', () => {
    const { scene, cache } = twoChains();
    const joints = [
      ...ON_FAR.joints.slice(0, 2),
      { ...ON_FAR.joints[2]!, bone: { index: 2, node: 'Target' } },
    ];
    const solved = solveStack(scene, cache, enabledStack([{ ...ON_FAR, joints }]));
    expect(solved.locals.slice(0, 3)).toEqual(cache);
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

  // The first pass folds the last bone onto its parent, and Godot bends the chain to the side the
  // last bit of its `atan2f` picks. A correctly rounded atan2 bends it to the other side.
  it('bends four equal bones that fold onto one line as Godot 4.6.3 does', () => {
    const { scene, cache } = chainScene(4, 30, translation(432, 122), { Target: freeNode(472, 192) });
    cache[1] = rotated(Math.fround(0.3), 30, 0);
    const joints = ['A', 'A/B', 'A/B/C', 'A/B/C/D'].map((node, index) => ({
      bone: { index, node },
      rotateFromJoint: false,
      constraint: NO_CONSTRAINT,
    }));
    const solved = solveStack(scene, cache, enabledStack([{ ...CCDIK, joints }]));
    expectColumns(solved.locals[0]!, [0.539312, 0.842106, -0.842106, 0.539312, 0, 0]);
    expectColumns(solved.locals[1]!, [0.96239, 0.27167, -0.27167, 0.96239, 30, 0]);
    expectColumns(solved.locals[2]!, [-0.085475, -0.996341, 0.996341, -0.085475, 30, 0]);
    expectColumns(solved.locals[3]!, [-0.730379, 0.683044, -0.683044, -0.730379, 30, 0]);
  });

  it('keeps the pose where the tip path names no node', () => {
    const { scene, cache } = threeBoneChain();
    expect(solveStack(scene, cache, enabledStack([{ ...CCDIK, tip: 'Missing' }])).locals).toEqual(cache);
  });
});
