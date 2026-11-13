import { describe, expect, it } from 'vitest';
import { isAnswerable } from './answerable.mjs';
import { generatePrograms } from './programs.mjs';
import { FIXED_SEED } from './randomSet.mjs';
import { reduceProgram } from './reduce.mjs';

const literal = (type, text) => ({ kind: 'literal', type, text });
const parameter = (type) => ({ kind: 'parameter', type, index: 0 });
const operator = (op, row, type, operands) => ({ kind: 'operator', type, row: { id: row }, op, operands });
const product = (vector) => operator('OP_MUL', 'OP_MUL(mat4,vec4)', 'vec4', [literal('mat4', '1.0'), vector]);
const quotient = (divisor) => operator('OP_DIV', 'OP_DIV(int,int)', 'int', [literal('int', '5'), divisor]);

describe('the trees Godot 4.6.3 gives values for', () => {
  it('leaves out a product of a constant matrix and a constant vector', () => {
    expect(isAnswerable({ kind: 'swizzle', base: product(literal('vec4', '1.0')) })).toBe(false);
  });

  it('holds a product with a parameter in it', () => {
    expect(isAnswerable(product(parameter('vec4')))).toBe(true);
  });

  it('leaves out an integer division by a constant that is not a nonzero literal', () => {
    expect(isAnswerable(quotient(literal('int', '0')))).toBe(false);
    expect(
      isAnswerable(
        quotient(operator('OP_SUB', 'OP_SUB(int,int)', 'int', [literal('int', '1'), literal('int', '1')]))
      )
    ).toBe(false);
  });

  it('holds an integer division by a nonzero literal or by a parameter', () => {
    expect(isAnswerable(quotient(literal('int', '3')))).toBe(true);
    expect(isAnswerable(quotient(parameter('int')))).toBe(true);
  });

  it('is every program of the fixed set', () => {
    const programs = generatePrograms({ seed: FIXED_SEED, count: 400 });
    expect(programs.filter((program) => !isAnswerable(program.tree)).map((program) => program.name)).toEqual(
      []
    );
  });

  it('is every candidate of a reduction', async () => {
    const [program] = generatePrograms({ seed: FIXED_SEED, count: 400 }).filter((each) =>
      each.rows.includes('OP_MUL(mat4,vec4)')
    );
    const seen = [];
    await reduceProgram(program, async (candidates) => {
      seen.push(...candidates);
      return candidates.map(() => false);
    });
    expect(seen.filter((candidate) => !isAnswerable(candidate.tree)).map((each) => each.source)).toEqual([]);
  });
});
