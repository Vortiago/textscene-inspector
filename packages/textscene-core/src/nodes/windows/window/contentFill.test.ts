import { describe, expect, it } from 'vitest';
import type { SolveNode } from '../../../r3f/controls/native/solveTree';
import { controlNode, solveNode } from '../../../r3f/controls/native/testing/solveNode';
import { everyChildFills, largestLaidOutChildMinimum } from './contentFill';

function child(parent: SolveNode, name: string): SolveNode {
  return { ...solveNode(), path: `${parent.path}/${name}`, node: controlNode(name, 'Control', { name }) };
}

const parent: SolveNode = {
  ...solveNode(),
  path: 'Win',
  node: controlNode('Win', 'Control', { name: 'Win' }),
};
const small = child(parent, 'Small');
const wide = child(parent, 'Wide');
const MINIMUMS: Record<string, { x: number; y: number }> = {
  [small.path]: { x: 10, y: 40 },
  [wide.path]: { x: 30, y: 5 },
};
const ctx = { combinedMinimumSize: (n: SolveNode) => MINIMUMS[n.path] ?? { x: 0, y: 0 } };

describe('largestLaidOutChildMinimum', () => {
  it('takes the largest minimum on each axis', () => {
    expect(largestLaidOutChildMinimum({ ...parent, children: [small, wide] }, ctx)).toEqual({ x: 30, y: 40 });
  });

  it('is zero without children', () => {
    expect(largestLaidOutChildMinimum(parent, ctx)).toEqual({ x: 0, y: 0 });
  });

  it('skips a child that is not a scene child of the parent', () => {
    const adopted = { ...wide, path: 'Elsewhere/Wide' };
    expect(largestLaidOutChildMinimum({ ...parent, children: [small, adopted] }, ctx)).toEqual({
      x: 10,
      y: 40,
    });
  });
});

describe('everyChildFills', () => {
  it('gives each child the same rect, by path', () => {
    const rect = { x: 1, y: 2, w: 3, h: 4 };
    const rects = everyChildFills([{ node: small }, { node: wide }], rect);
    expect([...rects]).toEqual([
      [small.path, rect],
      [wide.path, rect],
    ]);
  });

  it('gives an empty map for no children', () => {
    expect(everyChildFills([], { x: 0, y: 0, w: 1, h: 1 }).size).toBe(0);
  });
});
