/**
 * A Button-family node reads `tentativeRect` only when it wraps, so `solveControlTree` runs its
 * second pass for a scene with a wrapping node and for no other.
 */
import { describe, expect, it } from 'vitest';
import '../button/index.r3f';
import '../checkbox/index.r3f';
import '../checkbutton/index.r3f';
import '../menubutton/index.r3f';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';

const AUTOWRAP_OFF = 0;
const AUTOWRAP_WORD_SMART = 3;

function nodeOf(type: string, autowrapMode: number): SolveNode {
  return { node: { type, properties: { autowrapMode } }, children: [] } as unknown as SolveNode;
}

describe.each(['Button', 'CheckBox', 'CheckButton', 'MenuButton'])('%s second solve pass', (type) => {
  it('is read for a wrapping label', () => {
    expect(controlSolverRegistry.readsTentativeRect(nodeOf(type, AUTOWRAP_WORD_SMART))).toBe(true);
  });

  it('is not read at AUTOWRAP_OFF', () => {
    expect(controlSolverRegistry.readsTentativeRect(nodeOf(type, AUTOWRAP_OFF))).toBe(false);
  });
});
