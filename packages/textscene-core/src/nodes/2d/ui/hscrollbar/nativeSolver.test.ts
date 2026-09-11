/**
 * `hScrollBarMinimumSize` registers `../shared/scrollBarSolver.ts`'s
 * `scrollBarMinimumSize` at `vertical = false`. The geometry itself is proved
 * once in `shared/scrollBarSolver.test.ts`; this only pins the registration
 * and the axis this slice supplies.
 */
import { describe, expect, it } from 'vitest';
import type { ControlProperties } from '../control/types';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { SolveContext } from '../../../../r3f/controls/native/solverRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { hScrollBarMinimumSize } from './nativeSolver';
import { solveNode } from '../../../../r3f/controls/native/testing/solveNode';

function node(): SolveNode {
  return {
    ...solveNode(),
    path: 'S',
    node: { name: 'S', type: 'HScrollBar', children: [], properties: { name: 'S' } as ControlProperties },
  };
}

function ctx(): SolveContext {
  return { theme: nativeTheme(1), measureText: null, combinedMinimumSize: () => ({ x: 0, y: 0 }) };
}

describe('hScrollBarMinimumSize', () => {
  it('registers under the "HScrollBar" type name', () => {
    expect(controlSolverRegistry.minimumSize('HScrollBar')).toBe(hScrollBarMinimumSize);
  });

  it('is (8, 8) at scale 1 — track cross-axis + grabber along-axis minimum, both 2*contentMargin', () => {
    expect(hScrollBarMinimumSize(node(), ctx())).toEqual({ x: 8, y: 8 });
  });
});
