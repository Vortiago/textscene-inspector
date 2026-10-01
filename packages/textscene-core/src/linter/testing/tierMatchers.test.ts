import { describe, expect, it } from 'vitest';
import { takeRecordedTiers } from './titleTier.js';

const diagnostic = { severity: 'warning', message: 'outside the hint' } as const;

describe('toBeAtTier', () => {
  it('passes a diagnostic at the named tier', () => {
    expect(diagnostic).toBeAtTier('warning');
  });

  it('fails a diagnostic at another tier, naming both', () => {
    expect(() => expect(diagnostic).toBeAtTier('error')).toThrow(
      'expected a diagnostic at error, got [warning] outside the hint'
    );
    takeRecordedTiers();
  });

  it('fails a missing diagnostic, naming the tier it wanted', () => {
    expect(() => expect(null).toBeAtTier('info')).toThrow('expected a diagnostic at info, got null');
    takeRecordedTiers();
  });

  it('records the tier it asserts', () => {
    expect(diagnostic).toBeAtTier('warning');

    expect(takeRecordedTiers()).toEqual(['warning']);
  });

  it('records the tier it asserts even when the assertion fails', () => {
    expect(() => expect(diagnostic).toBeAtTier('error')).toThrow();

    expect(takeRecordedTiers()).toEqual(['error']);
  });

  it('records nothing when negated, since a tier ruled out is not a tier asserted', () => {
    expect(diagnostic).not.toBeAtTier('info');

    expect(takeRecordedTiers()).toEqual([]);
  });
});

describe('toBeAllAtTier', () => {
  const other = { severity: 'error', message: 'refused by the setter' } as const;

  it('passes a list whose every diagnostic is at the named tier', () => {
    expect([diagnostic, diagnostic]).toBeAllAtTier('warning');
  });

  it('fails a list with a diagnostic at another tier, naming each one', () => {
    expect(() => expect([diagnostic, other, null]).toBeAllAtTier('warning')).toThrow(
      'expected every diagnostic at warning, got:\n  [error] refused by the setter\n  null'
    );
    takeRecordedTiers();
  });

  it('records the tier it asserts', () => {
    expect([diagnostic]).toBeAllAtTier('warning');

    expect(takeRecordedTiers()).toEqual(['warning']);
  });

  it('records nothing when negated', () => {
    expect([diagnostic, other]).not.toBeAllAtTier('warning');

    expect(takeRecordedTiers()).toEqual([]);
  });
});
