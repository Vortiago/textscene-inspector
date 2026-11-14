import { describe, expect, it } from 'vitest';
import { generateFunctionPrograms } from './functionPrograms.mjs';
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

  // The operator and its two operands, and up to three nodes more where the program has no `vec3`
  // parameter, so the `vec3` comes from a swizzle or a constructor of three literals.
  it('gives a program of a few nodes that still differs', async () => {
    const reduced = await reduceProgram(LARGE_FAULTY, differsWithFault);
    expect(reduced.rows).toContain(FAULTY_ROW);
    expect(nodeCount(reduced)).toBeLessThanOrEqual(6);
  });

  it('returns the subtree that differs in place of the whole program', async () => {
    const reduced = await reduceProgram(LARGE_FAULTY, differsWithFault);
    expect(reduced.returns).toBe('vec3');
  });

  it('keeps the program when no smaller one differs', async () => {
    const reduced = await reduceProgram(LARGE_FAULTY, async (programs) => programs.map(() => false));
    expect(reduced.source).toBe(LARGE_FAULTY.source);
  });

  it('prints a program with functions of its own whole, as it has no one tree to cut', async () => {
    const [program] = generateFunctionPrograms({ seed: FIXED_SEED, count: 1 });
    const judged = [];
    const reduced = await reduceProgram(program, async (candidates) => {
      judged.push(...candidates);
      return candidates.map(() => true);
    });
    expect([reduced, judged]).toEqual([program, []]);
  });
});
