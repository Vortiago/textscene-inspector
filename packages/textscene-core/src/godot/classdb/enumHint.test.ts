import { describe, expect, it } from 'vitest';
import { parseHintEnum, parseHintFlags } from './enumHint';

describe('parseHintEnum', () => {
  it('runs the value on from an explicit one', () => {
    expect(parseHintEnum('Off,On:4,Auto')).toEqual([
      { label: 'Off', value: 0 },
      { label: 'On', value: 4 },
      { label: 'Auto', value: 5 },
    ]);
  });

  it('reads the second colon slice as the value', () => {
    expect(parseHintEnum('A:7:ignored,B')).toEqual([
      { label: 'A', value: 7 },
      { label: 'B', value: 8 },
    ]);
  });

  it('answers 0 for a value that is not a number, then runs on', () => {
    expect(parseHintEnum('A:no,B')).toEqual([
      { label: 'A', value: 0 },
      { label: 'B', value: 1 },
    ]);
  });

  it('gives an empty value 0, then runs on', () => {
    expect(parseHintEnum('A:,B')).toEqual([
      { label: 'A', value: 0 },
      { label: 'B', value: 1 },
    ]);
  });

  it('keeps each label when two share a value', () => {
    expect(parseHintEnum('A:4,A:4,B')).toEqual([
      { label: 'A', value: 4 },
      { label: 'A', value: 4 },
      { label: 'B', value: 5 },
    ]);
  });

  it('returns no entry for an empty hint string', () => {
    expect(parseHintEnum('')).toEqual([]);
  });
});

describe('parseHintFlags', () => {
  it('gives an implicit label the bit of its position', () => {
    expect(parseHintFlags('A,B,C')).toEqual([
      { label: 'A', value: 1 },
      { label: 'B', value: 2 },
      { label: 'C', value: 4 },
    ]);
  });

  it('reads an explicit value', () => {
    expect(parseHintFlags('Vertical:1,Horizontal:2,Floating:4')).toEqual([
      { label: 'Vertical', value: 1 },
      { label: 'Horizontal', value: 2 },
      { label: 'Floating', value: 4 },
    ]);
  });

  it('skips an empty option, which keeps its position', () => {
    expect(parseHintFlags('A,,C')).toEqual([
      { label: 'A', value: 1 },
      { label: 'C', value: 4 },
    ]);
  });
});
