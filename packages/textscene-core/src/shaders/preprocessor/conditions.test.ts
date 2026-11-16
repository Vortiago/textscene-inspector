import { describe, expect, it } from 'vitest';
import { utilityHost } from '../../godot/variant/utility/utilityHost.js';
import { isConditionTrue, type ConditionScope } from './conditions.js';
import { Defines } from './macros.js';

const DEFINES = new Defines([['A', { body: '2', arguments: [], isBuiltIn: false }]]);
const scope = (): ConditionScope => ({ defines: DEFINES, host: utilityHost() });

function reasonOf(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    return (error as { reason: string }).reason;
  }
  throw new Error('expected an error, got none');
}

describe('isConditionTrue of defined', () => {
  it('reads defined(NAME) and defined NAME', () => {
    expect(isConditionTrue('defined A && !defined(B) && defined(A)', scope(), 0)).toBe(true);
  });

  it('keeps the end of the last operand for a bare name at the end, so Godot refuses it', () => {
    expect(reasonOf(() => isConditionTrue('defined(A) || defined B', scope(), 0))).toBe(
      'Condition evaluation error.'
    );
  });

  it('refuses a missing closing bracket', () => {
    expect(reasonOf(() => isConditionTrue('defined(A', scope(), 0))).toBe("Expected a ')'.");
  });

  it('refuses a comparison after a bare name', () => {
    expect(reasonOf(() => isConditionTrue('defined A == 1', scope(), 0))).toBe("Unexpected token: '='.");
  });

  it('refuses defined with no name', () => {
    expect(reasonOf(() => isConditionTrue('defined', scope(), 0))).toBe('Invalid macro name.');
  });
});

describe('isConditionTrue', () => {
  it('expands the macros before it evaluates', () => {
    expect(isConditionTrue('A * 2 == 4', scope(), 0)).toBe(true);
  });

  it('gives the Expression parse error', () => {
    expect(reasonOf(() => isConditionTrue('1 +', scope(), 0))).toBe('Expected expression.');
  });

  it('refuses a condition that fails at execution and leaves Nil', () => {
    expect(reasonOf(() => isConditionTrue('"a" + 1', scope(), 0))).toBe('Condition evaluation error.');
  });

  it('takes a division by zero as true, from the error text it leaves', () => {
    expect(isConditionTrue('1 / 0', scope(), 0)).toBe(true);
  });

  it('refuses a null condition', () => {
    expect(reasonOf(() => isConditionTrue('null', scope(), 0))).toBe('Condition evaluation error.');
  });
});
