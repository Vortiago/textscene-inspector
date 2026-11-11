/** Builders for the scenes the modification stack tests solve: a skeleton, a chain of bones and the nodes a stack names. */

import { expect } from 'vitest';
import {
  TRANSFORM2D_IDENTITY,
  transform2DFromParts,
  type Transform2DColumns,
} from '../../../../godot/math/transform2d.js';
import type {
  AngleConstraint,
  LookAtModification2D,
  ModificationStack2D,
  Modification2D,
} from '../../../../resources/skeleton/skeletonmodificationstack2d/types';
import type { OutsideBone, StackNode, StackScene } from './stackScene';

export function translation(x: number, y: number): Transform2DColumns {
  return { ...TRANSFORM2D_IDENTITY, tx: x, ty: y };
}

export function rotated(rotation: number, x = 0, y = 0): Transform2DColumns {
  return transform2DFromParts(rotation, { x: 1, y: 1 }, 0, { x, y });
}

/** A node outside the skeleton at a canvas position. */
export function freeNode(x: number, y: number): StackNode {
  return {
    boneIndex: -1,
    indexInSkeleton: null,
    placement: { carrier: -1, offset: translation(x, y) },
    outsideBone: null,
  };
}

export function boneNode(index: number): StackNode {
  return {
    boneIndex: index,
    indexInSkeleton: index,
    placement: { carrier: index, offset: TRANSFORM2D_IDENTITY },
    outsideBone: null,
  };
}

/** A Bone2D outside the skeleton, at `indexInSkeleton` in the skeleton it joins, or -1 for none. */
export function foreignBoneNode(indexInSkeleton: number): StackNode {
  return { ...freeNode(0, 0), indexInSkeleton };
}

/**
 * A chain of `count` Bone2Ds of another skeleton at `origin`, each `spacing` along its parent, as
 * the nodes `Far/A`, `Far/A/B` and so on.
 */
export function outsideChainNodes(
  count: number,
  spacing: number,
  origin: Transform2DColumns
): Record<string, StackNode> {
  const nodes: Record<string, StackNode> = {};
  let above: OutsideBone | null = null;
  ['Far/A', 'Far/A/B', 'Far/A/B/C'].slice(0, count).forEach((name, index) => {
    const bone: OutsideBone = {
      parent: above ?? { carrier: -1, offset: origin },
      local: above ? translation(spacing, 0) : TRANSFORM2D_IDENTITY,
      length: spacing,
      boneAngle: 0,
    };
    nodes[name] = { ...freeNode(0, 0), indexInSkeleton: index, outsideBone: bone };
    above = bone;
  });
  return nodes;
}

/**
 * A chain of bones named `A`, `A/B` and so on, each `spacing` along the x axis of its parent, with
 * the skeleton at `origin`, and a `Tip` node at the end of the last bone.
 */
export function chainScene(
  boneCount: number,
  spacing: number,
  origin: Transform2DColumns,
  extraNodes: Record<string, StackNode>
): { scene: StackScene; cache: Transform2DColumns[] } {
  const names = ['A', 'A/B', 'A/B/C', 'A/B/C/D'].slice(0, boneCount);
  const nodes = new Map<string, StackNode>(Object.entries(extraNodes));
  names.forEach((name, index) => nodes.set(name, boneNode(index)));
  nodes.set('Tip', {
    ...freeNode(0, 0),
    placement: { carrier: boneCount - 1, offset: translation(spacing, 0) },
  });
  return {
    scene: {
      skeletonGlobal: origin,
      bones: names.map((_name, index) => ({ parent: index - 1, length: spacing, boneAngle: 0 })),
      nodes,
    },
    cache: names.map((_name, index) => (index === 0 ? TRANSFORM2D_IDENTITY : translation(spacing, 0))),
  };
}

export const NO_CONSTRAINT: AngleConstraint = {
  enabled: false,
  min: 0,
  max: Math.PI * 2,
  invert: false,
  inLocalSpace: true,
};

/** One bone `A` of 200 with the skeleton at (300, 150), as in `unit-skeleton2d-lookat.tscn`, and `nodes` beside it. */
export function armScene(nodes: Record<string, StackNode>) {
  return chainScene(1, 200, translation(300, 150), nodes);
}

/** A LookAt that turns the bone of {@link armScene} at the node `target`. */
export function lookAtModification(target: string): LookAtModification2D {
  return {
    type: 'SkeletonModification2DLookAt',
    enabled: true,
    executionMode: 0,
    bone: { index: 0, node: 'A' },
    target,
    additionalRotation: 0,
    constraint: NO_CONSTRAINT,
  };
}

export function enabledStack(modifications: (Modification2D | null)[], strength = 1): ModificationStack2D {
  return { enabled: true, strength, modifications };
}

/** The six numbers of a transform, in the order Godot prints them. */
function columns(t: Transform2DColumns): number[] {
  return [t.a, t.b, t.c, t.d, t.tx, t.ty];
}

/**
 * Expects the axes of `actual` within 0.00005 of `expected` and its origin within 0.005: a solve
 * rounds an origin through an inverse in float, which moves it in the fourth decimal.
 */
export function expectColumns(actual: Transform2DColumns, expected: number[]): void {
  columns(actual).forEach((value, index) => expect(value).toBeCloseTo(expected[index]!, index < 4 ? 4 : 2));
}
