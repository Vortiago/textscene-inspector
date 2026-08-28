/**
 * The three `ParseError` constructors every property refusal goes through, and
 * the fields that separate them.
 */

import { describe, expect, it } from 'vitest';
import { keyShapeError, nilShapeError, propertyError } from './propertyError.js';

describe('propertyError', () => {
  it('anchors the column past `key = `, on the value', () => {
    const error = propertyError('visible', 7, 'nope', 'CODE');
    expect(error).toEqual({
      severity: 'error',
      message: 'nope',
      line: 7,
      column: 'visible'.length + 3,
      code: 'CODE',
    });
  });

  it('claims neither verdict, so the nil rewrite still owns its message', () => {
    const error = propertyError('visible', 1, 'nope', 'CODE');
    expect(error).not.toHaveProperty('keyVerdict');
    expect(error).not.toHaveProperty('nilVerdict');
  });

  it('anchors an empty key at the column a zero-length name leaves', () => {
    expect(propertyError('', 1, 'nope', 'CODE').column).toBe(3);
  });
});

describe('keyShapeError', () => {
  it('is a propertyError that declares the verdict is about the KEY', () => {
    const key = 'item_0/bogus';
    expect(keyShapeError(key, 4, 'nope', 'CODE')).toEqual({
      ...propertyError(key, 4, 'nope', 'CODE'),
      keyVerdict: true,
    });
  });

  it('carries the flag whatever the value would have been', () => {
    // The seam reads it for a bare `null` alone, and the constructor never sees
    // the value, so the flag cannot depend on one.
    expect(keyShapeError('bones/-1/name', 1, 'nope', 'CODE').keyVerdict).toBe(true);
  });
});

describe('nilShapeError', () => {
  it('is a propertyError that declares the verdict is about the NULL', () => {
    const key = 'sources/0';
    expect(nilShapeError(key, 9, 'nope', 'CODE')).toEqual({
      ...propertyError(key, 9, 'nope', 'CODE'),
      nilVerdict: true,
    });
  });

  it('is the other verdict, not the same one under a second name', () => {
    // A key refusal rejects every value; this one rejects the null a real slot
    // was handed. `ownsNilMessage` takes both, but only a key refusal is
    // value-independent, so collapsing them would misreport what the
    // conformance guard sweeps for.
    expect(nilShapeError('sources/0', 1, 'nope', 'CODE')).not.toHaveProperty('keyVerdict');
    expect(keyShapeError('item_0/bogus', 1, 'nope', 'CODE')).not.toHaveProperty('nilVerdict');
  });
});
