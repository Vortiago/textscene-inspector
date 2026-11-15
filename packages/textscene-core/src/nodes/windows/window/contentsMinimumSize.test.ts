/**
 * The contents minimum `wrap_controls` floors a window at (`window.cpp:1839-1853`), read from the
 * window's solved Controls.
 */
import { describe, expect, it } from 'vitest';
import type { SolveNode } from '../../../r3f/controls/native/solveTree';
import type { SolvedControl } from '../../../r3f/controls/native/controlRectSolver';
import { controlNode, solveNode } from '../../../r3f/controls/native/testing/solveNode';
import { windowContentsMinimumSize } from './contentsMinimumSize';

function node(path: string, type: string, children: SolveNode[] = [], properties = {}): SolveNode {
  const name = path.split('/').pop()!;
  return { ...solveNode(), path, node: controlNode(name, type, { name, ...properties }), children };
}

function solved(entries: [string, SolvedControl][]): ReadonlyMap<string, SolvedControl> {
  return new Map(entries);
}

describe('windowContentsMinimumSize', () => {
  it('takes the furthest corner of each child’s position plus its minimum (`window.cpp:1842-1849`)', () => {
    const window = node('Dialog', 'Window', [node('Dialog/A', 'Control'), node('Dialog/B', 'Control')]);
    const minimum = windowContentsMinimumSize(
      window,
      solved([
        ['Dialog/A', { rect: { x: 10, y: 20, w: 5, h: 5 }, minSize: { x: 100, y: 30 } }],
        ['Dialog/B', { rect: { x: 50, y: 0, w: 5, h: 5 }, minSize: { x: 40, y: 80 } }],
      ])
    );
    expect(minimum).toEqual({ x: 110, y: 80 });
  });

  it('truncates the position and minimum to integers, as `Point2i` and `Size2i` do', () => {
    const window = node('Dialog', 'Window', [node('Dialog/A', 'Control')]);
    const minimum = windowContentsMinimumSize(
      window,
      solved([['Dialog/A', { rect: { x: 10.7, y: 0.5, w: 5, h: 5 }, minSize: { x: 20.9, y: 30.2 } }]])
    );
    expect(minimum).toEqual({ x: 30, y: 30 });
  });

  it('counts only the window’s own children, not the Controls it adopted from deeper', () => {
    const window = node('Dialog', 'Window', [node('Dialog/Holder/A', 'Control')]);
    const minimum = windowContentsMinimumSize(
      window,
      solved([['Dialog/Holder/A', { rect: { x: 0, y: 0, w: 5, h: 5 }, minSize: { x: 100, y: 30 } }]])
    );
    expect(minimum).toEqual({ x: 0, y: 0 });
  });
});
