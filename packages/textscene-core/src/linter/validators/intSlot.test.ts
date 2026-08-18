/**
 * The INT-slot verdicts, at the seam that produces them.
 *
 * The sweeps in `nonFiniteInts.test.ts` ask the whole registry whether every
 * slot is silent; these ask the shared helpers what they say and at which tier.
 */

import { describe, expect, it } from 'vitest';
import {
  readIntSlot,
  slotWidth,
  truncatedComponent,
  truncatedInt,
  unrepresentableInt,
} from './intSlot.js';

describe('truncatedComponent', () => {
  it('warns about a finite fractional component, naming it and what is stored', () => {
    const diagnostic = truncatedComponent('size', 'size', 1, ['1.5', '2'], 'CODE');
    expect(diagnostic?.severity).toBe('warning');
    expect(diagnostic?.message).toContain('1.5');
    expect(diagnostic?.message).toContain('stores 1');
  });

  it('says nothing when every component is whole, however spelled', () => {
    expect(truncatedComponent('size', 'size', 1, ['1', '2e1'], 'CODE')).toBeNull();
    expect(truncatedComponent('size', 'size', 1, ['1.0', '-2.0'], 'CODE')).toBeNull();
  });

  it.each(['inf', '-inf', 'inf_neg', 'nan', '1e999'])(
    'says nothing about the non-finite %s, whose stored value is unnameable',
    (spelling) => {
      // Its callers match on the linter's WIDENED grammar, which admits these
      // deliberately, and `Number.isInteger(Infinity)` is false — so they
      // reached the truncation arm and printed "stores Infinity". ADR-0032
      // forbids naming a value the conversion leaves undefined; the caller's
      // own unstorable arm is what reports these.
      expect(truncatedComponent('size', 'size', 1, [spelling, '2'], 'CODE')).toBeNull();
    }
  );

  it('skips an absent capture rather than reading it as a number', () => {
    expect(truncatedComponent('size', 'size', 1, [undefined, '2'], 'CODE')).toBeNull();
  });

  it('reports the FIRST offending component only', () => {
    expect(truncatedComponent('size', 'size', 1, ['1.5', '2.5'], 'CODE')?.message).toContain('1.5');
  });
});

describe('truncatedInt', () => {
  it('warns about a fractional scalar at the value code, never the format one', () => {
    const diagnostic = truncatedInt('hframes', 'hframes', '5.5', 1, 'INVALID_HFRAMES_VALUE', {
      asFloat: 5.5,
      stored: 5,
    });
    expect(diagnostic?.severity).toBe('warning');
    expect(diagnostic?.code).toBe('INVALID_HFRAMES_VALUE');
  });

  it('says nothing about a whole value or an unstorable one', () => {
    expect(truncatedInt('hframes', 'hframes', '5', 1, 'CODE', { asFloat: 5, stored: 5 })).toBeNull();
    expect(
      truncatedInt('hframes', 'hframes', 'inf', 1, 'CODE', { asFloat: Infinity, stored: NaN })
    ).toBeNull();
    expect(
      truncatedInt('hframes', 'hframes', 'nope', 1, 'CODE', { asFloat: null, stored: null })
    ).toBeNull();
  });

  it('answers from the float its caller read, never from the text again', () => {
    // The proof it parses once. A re-reading implementation reads "5", finds it
    // whole and says nothing; this one follows the read it was handed. The
    // message still quotes the LITERAL, which is what the file says.
    expect(
      truncatedInt('hframes', 'hframes', '5', 1, 'CODE', { asFloat: 5.5, stored: 5 })
    ).not.toBeNull();
  });
});

describe('readIntSlot', () => {
  it('returns both readings of one literal, and null for text outside the grammar', () => {
    expect(readIntSlot('5.5')).toEqual({ asFloat: 5.5, stored: 5 });
    expect(readIntSlot('nope')).toEqual({ asFloat: null, stored: null });
  });

  it('reads at the width the slot ceiling implies, so an unsigned ceiling is reachable', () => {
    expect(readIntSlot('4294967295.0', 4294967295).stored).toBe(4294967295);
    expect(Number.isNaN(readIntSlot('4294967295.0', 255).stored)).toBe(true);
  });
});

describe('unrepresentableInt', () => {
  it('errors only on the NaN signal, never on a usable number or a miss', () => {
    expect(unrepresentableInt('seed', 'seed', 'inf', 1, 'CODE', NaN)?.severity).toBe('error');
    expect(unrepresentableInt('seed', 'seed', '5', 1, 'CODE', 5)).toBeNull();
    expect(unrepresentableInt('seed', 'seed', 'nope', 1, 'CODE', null)).toBeNull();
  });

  it('never names the stored number, which no two platforms agree on', () => {
    const message = unrepresentableInt('seed', 'seed', 'inf', 1, 'CODE', NaN)?.message ?? '';
    expect(message).toContain('"inf"');
    expect(message).not.toMatch(/-?2147483648|Infinity|NaN/);
  });
});

describe('slotWidth', () => {
  it('reads unsigned only from a ceiling no int32 can hold', () => {
    expect(slotWidth(4294967295)).toBe('uint32');
    expect(slotWidth(2147483647)).toBe('int32');
    expect(slotWidth(undefined)).toBe('int32');
    expect(slotWidth(null)).toBe('int32');
  });
});
