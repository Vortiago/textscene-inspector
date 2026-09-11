/**
 * A `SplitContainer` must lay out identically to a fixed-axis sibling given
 * the same `vertical` and the same children — that IS the base/subclass
 * relationship (`split_container.h`'s `HSplitContainer()`/`VSplitContainer()`
 * each just call `SplitContainer(bool)`). Verified two ways: exact numbers
 * derived from `SplitContainer::_get_valid_range`/`_update_dragger_positions`/
 * `_resort` (`split_container.cpp:305-338,527-618,710-782`), and a
 * differential check against the REAL registered HSplitContainer/
 * VSplitContainer solvers.
 */
import { describe, expect, it } from 'vitest';
import type { TscnNode } from '../../../../parser/types';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { createSolveContext, solveControlTree } from '../../../../r3f/controls/native/controlRectSolver';
import { solveNode } from '../../../../r3f/controls/native/testing/solveNode';
import './nativeSolver';
import '../hsplitcontainer/nativeSolver';
import '../vsplitcontainer/nativeSolver';

const THEME = nativeTheme(1);
const EXPAND_FILL = 3;

function expandChild(path: string, axisFlag: 'sizeFlagsHorizontal' | 'sizeFlagsVertical'): SolveNode {
  const node: TscnNode = {
    name: path,
    type: 'Control',
    children: [],
    properties: { name: path, [axisFlag]: EXPAND_FILL },
  };
  return { ...solveNode(), path: `Split/${path}`, node };
}

function splitRoot(type: string, vertical: boolean | undefined, children: SolveNode[]): SolveNode {
  const properties: Record<string, unknown> = {
    name: 'Split',
    anchorLeft: 0,
    anchorTop: 0,
    anchorRight: 1,
    anchorBottom: 1,
  };
  if (vertical !== undefined) properties.vertical = vertical;
  const node: TscnNode = { name: 'Split', type, children: [], properties };
  return { ...solveNode(), path: 'Split', node, children };
}

describe('SplitContainer native layout — exact numbers', () => {
  it('vertical: false (default) splits an even 1:1 pair at the centre, separation 12', () => {
    const viewport: Rect2 = { x: 0, y: 0, w: 200, h: 100 };
    const root = splitRoot('SplitContainer', undefined, [
      expandChild('A', 'sizeFlagsHorizontal'),
      expandChild('B', 'sizeFlagsHorizontal'),
    ]);
    const solved = solveControlTree([root], viewport, createSolveContext(THEME));

    // split_container.cpp:557-563: wished = trunc(size*0.5 - sep*0.5) =
    // trunc(200*0.5 - 12*0.5) = 94; clamp(94, 0, 200-12-0) = 94.
    expect(solved.get('Split/A')?.rect).toEqual({ x: 0, y: 0, w: 94, h: 100 });
    expect(solved.get('Split/B')?.rect).toEqual({ x: 106, y: 0, w: 94, h: 100 });
  });

  it('vertical: true splits an even 1:1 pair at the centre, separation 12', () => {
    const viewport: Rect2 = { x: 0, y: 0, w: 100, h: 200 };
    const root = splitRoot('SplitContainer', true, [
      expandChild('A', 'sizeFlagsVertical'),
      expandChild('B', 'sizeFlagsVertical'),
    ]);
    const solved = solveControlTree([root], viewport, createSolveContext(THEME));

    expect(solved.get('Split/A')?.rect).toEqual({ x: 0, y: 0, w: 100, h: 94 });
    expect(solved.get('Split/B')?.rect).toEqual({ x: 0, y: 106, w: 100, h: 94 });
  });
});

describe('SplitContainer at vertical=X matches its fixed-axis sibling', () => {
  it('vertical=true produces the SAME child rects as VSplitContainer given the same children', () => {
    const viewport: Rect2 = { x: 0, y: 0, w: 100, h: 200 };
    const splitSolved = solveControlTree(
      [splitRoot('SplitContainer', true, [expandChild('A', 'sizeFlagsVertical'), expandChild('B', 'sizeFlagsVertical')])],
      viewport,
      createSolveContext(THEME)
    );
    const vsplitSolved = solveControlTree(
      [splitRoot('VSplitContainer', undefined, [expandChild('A', 'sizeFlagsVertical'), expandChild('B', 'sizeFlagsVertical')])],
      viewport,
      createSolveContext(THEME)
    );

    expect(splitSolved.get('Split/A')?.rect).toEqual(vsplitSolved.get('Split/A')?.rect);
    expect(splitSolved.get('Split/B')?.rect).toEqual(vsplitSolved.get('Split/B')?.rect);
  });

  it('vertical=false (or absent) produces the SAME child rects as HSplitContainer given the same children', () => {
    const viewport: Rect2 = { x: 0, y: 0, w: 200, h: 100 };
    const splitSolved = solveControlTree(
      [splitRoot('SplitContainer', undefined, [expandChild('A', 'sizeFlagsHorizontal'), expandChild('B', 'sizeFlagsHorizontal')])],
      viewport,
      createSolveContext(THEME)
    );
    const hsplitSolved = solveControlTree(
      [splitRoot('HSplitContainer', undefined, [expandChild('A', 'sizeFlagsHorizontal'), expandChild('B', 'sizeFlagsHorizontal')])],
      viewport,
      createSolveContext(THEME)
    );

    expect(splitSolved.get('Split/A')?.rect).toEqual(hsplitSolved.get('Split/A')?.rect);
    expect(splitSolved.get('Split/B')?.rect).toEqual(hsplitSolved.get('Split/B')?.rect);
  });
});

describe('SplitContainer registration', () => {
  it('registers a container layout and a minimum size function', () => {
    expect(controlSolverRegistry.containerLayout('SplitContainer')).toBeDefined();
    expect(controlSolverRegistry.minimumSize('SplitContainer')).toBeDefined();
  });

  it('with a single child fits it to the whole rect (split_container.cpp:714-719)', () => {
    const viewport: Rect2 = { x: 0, y: 0, w: 200, h: 100 };
    const root = splitRoot('SplitContainer', undefined, [expandChild('Only', 'sizeFlagsHorizontal')]);
    const solved = solveControlTree([root], viewport, createSolveContext(THEME));
    expect(solved.get('Split/Only')?.rect).toEqual({ x: 0, y: 0, w: 200, h: 100 });
  });
});
