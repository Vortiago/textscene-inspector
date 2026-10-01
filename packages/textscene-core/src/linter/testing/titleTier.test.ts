import { describe, expect, it } from 'vitest';
import { expectTitleNamesRecordedTiers, recordTier, takeRecordedTiers, titleTierDrift } from './titleTier.js';

describe('titleTierDrift', () => {
  it('names the drift when a title claims a tier its test does not record', () => {
    expect(titleTierDrift('warns on a negative size', ['error'])).toBe(
      'the title "warns on a negative size" names warning, but the test asserts error'
    );
  });

  it('passes a title that names the recorded tier', () => {
    expect(titleTierDrift('errors on a negative size', ['error'])).toBeNull();
  });

  it('passes a title that names the recorded tier beside another one', () => {
    expect(titleTierDrift('reports at info, not error', ['info'])).toBeNull();
  });

  it('passes a title that names no tier', () => {
    expect(titleTierDrift('refuses a negative size', ['error'])).toBeNull();
  });

  it('exempts a test that records two tiers, since its title can name both', () => {
    expect(titleTierDrift('warns on a negative size', ['error', 'info'])).toBeNull();
  });

  it('exempts a test that records no tier', () => {
    expect(titleTierDrift('warns on a negative size', [])).toBeNull();
  });

  it('reads a tier word as a whole word only', () => {
    expect(titleTierDrift('keeps the terror of an informal note', ['warning'])).toBeNull();
  });
});

describe('recordTier', () => {
  it('hands each recorded tier back once, and then forgets it', () => {
    recordTier('warning');
    recordTier('warning');

    expect([takeRecordedTiers(), takeRecordedTiers()]).toEqual([['warning'], []]);
  });
});

describe('expectTitleNamesRecordedTiers', () => {
  it('throws the drift for the recorded tiers, and clears them', () => {
    recordTier('error');

    expect(() => expectTitleNamesRecordedTiers('warns on a negative size')).toThrow(
      'names warning, but the test asserts error'
    );
    expect(takeRecordedTiers()).toEqual([]);
  });
});
