import { describe, expect, it } from 'vitest';
import { treeNodes } from './programTree.mjs';
import { generatePrograms } from './programs.mjs';
import { FIXED_SEED } from './randomSet.mjs';
import { reduceProgram } from './reduce.mjs';

const FAULTY_ROW = 'OP_DIV(vec3,float)';

/** A made-up fault: every program that divides a `vec3` by a float differs from Godot. */
const differsWithFault = async (programs) => programs.map((program) => program.rows.includes(FAULTY_ROW));

const nodeCount = (program) => treeNodes(program.tree).length;

/** A large program of the fixed set that has the faulty row. */
const LARGE_FAULTY = generatePrograms({ seed: FIXED_SEED, count: 400 })
  .filter((program) => program.rows.includes(FAULTY_ROW))
  .sort((a, b) => nodeCount(b) - nodeCount(a))[0];

describe('the reduction of a program that differs', () => {
  it('starts from a program of many nodes', () => {
    expect(nodeCount(LARGE_FAULTY)).toBeGreaterThan(8);
  });

  // The operator and its two operands, and one node more where the program has no `vec3`
  // parameter, so the `vec3` comes from a swizzle or a constructor.
  it('gives a program of a few nodes that still differs', async () => {
    const reduced = await reduceProgram(LARGE_FAULTY, differsWithFault);
    expect(reduced.rows).toContain(FAULTY_ROW);
    expect(nodeCount(reduced)).toBeLessThanOrEqual(4);
  });

  it('keeps the program when no smaller one differs', async () => {
    const reduced = await reduceProgram(LARGE_FAULTY, async (programs) => programs.map(() => false));
    expect(reduced.source).toBe(LARGE_FAULTY.source);
  });
});
