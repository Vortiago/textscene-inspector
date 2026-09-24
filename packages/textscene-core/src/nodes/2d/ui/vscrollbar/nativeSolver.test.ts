/**
 * `vScrollBarMinimumSize` registers `scrollBarMinimumSize` at `vertical = true`.
 * `shared/scrollBarSolver.test.ts` proves the geometry. This pins the registration and the axis.
 */

import { describe, expect, it } from 'vitest';
import type { ControlProperties } from '../control/types';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { SolveContext } from '../../../../r3f/controls/native/solverRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { vScrollBarMinimumSize } from './nativeSolver';
import { solveNode } from '../../../../r3f/controls/native/testing/solveNode';

function node(): SolveNode {
  return {
    ...solveNode(),
    path: 'S',
    node: { name: 'S', type: 'VScrollBar', children: [], properties: { name: 'S' } as ControlProperties },
  };
}

function ctx(): SolveContext {
  return { theme: nativeTheme(1), measureText: null, combinedMinimumSize: () => ({ x: 0, y: 0 }) };
}

describe('vScrollBarMinimumSize', () => {
  it('registers under the "VScrollBar" type name', () => {
    expect(controlSolverRegistry.minimumSize('VScrollBar')).toBe(vScrollBarMinimumSize);
  });

  it('is (8, 8) at scale 1 — track cross-axis + grabber along-axis minimum, both 2*contentMargin', () => {
    expect(vScrollBarMinimumSize(node(), ctx())).toEqual({ x: 8, y: 8 });
  });
});
