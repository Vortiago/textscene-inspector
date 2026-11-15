/**
 * MenuButton sizes as Button does. `autowrap_mode` makes that size depend on the node's own width, so
 * `solveControlTree` must run its second pass for a MenuButton too, and the icon Button shows needs a
 * texture slot to have a size.
 */
import { describe, expect, it } from 'vitest';
import './index.r3f';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { buttonTextureSlots } from '../button/nativeSolver';

describe('MenuButton index.r3f self-registration', () => {
  it("registers Button's texture slots, so the theme icon `icon` has a size (button.cpp:37-41)", () => {
    expect(controlSolverRegistry.textureSlots('MenuButton')).toBe(buttonTextureSlots);
  });

  it('declares MenuButton size-dependent, so an autowrapping label gets its second pass', () => {
    expect(
      controlSolverRegistry.readsTentativeRect({
        node: { type: 'MenuButton', properties: { autowrapMode: 3 } },
      } as unknown as SolveNode)
    ).toBe(true);
  });
});
