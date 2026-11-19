import { describe, expect, it } from 'vitest';
import { missingFileFailures } from './missingFileFailures.mjs';

const MISSING = ['res://missing.png'];

const PASSING = { atSettled: MISSING, ofScene: MISSING, heard: [[], MISSING, []], afterWrite: [] };

describe('missingFileFailures', () => {
  it('finds nothing wrong with results that meet every check', () => {
    expect(missingFileFailures(PASSING)).toEqual([]);
  });

  it('names a settled value that lacks the missing file', () => {
    expect(missingFileFailures({ ...PASSING, atSettled: [] })).toEqual([
      'missing files: settled: expected ["res://missing.png"], got []',
    ]);
  });

  it('names a subscribe that never heard the missing file', () => {
    expect(missingFileFailures({ ...PASSING, heard: [[]] })).toEqual([
      'missing files: subscribe: expected a notice that sees res://missing.png, got [[]]',
    ]);
  });

  it('names a file that stays after the write that stops reading it', () => {
    expect(missingFileFailures({ ...PASSING, afterWrite: MISSING, heard: [MISSING] })).toEqual([
      'missing files: settled after texture = null: expected [], got ["res://missing.png"]',
      'missing files: the last subscribe notice: expected [], got ["res://missing.png"]',
    ]);
  });
});
