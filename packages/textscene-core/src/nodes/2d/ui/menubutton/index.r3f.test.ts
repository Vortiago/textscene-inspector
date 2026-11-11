/**
 * MenuButton sizes as Button does, and `autowrap_mode` makes that size depend on the node's own
 * width, so `solveControlTree` must run its second pass for a MenuButton too.
 */
import { describe, expect, it } from 'vitest';
import './index.r3f';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';

describe('MenuButton index.r3f self-registration', () => {
  it('declares MenuButton size-dependent, so an autowrapping label gets its second pass', () => {
    expect(
      controlSolverRegistry.readsTentativeRect({
        node: { type: 'MenuButton', properties: { autowrapMode: 3 } },
      } as unknown as SolveNode)
    ).toBe(true);
  });
});
