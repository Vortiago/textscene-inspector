/**
 * `diagnosticLine`: a line an editor row carries passes through, and anything else reads as no
 * line, so every host shows it as a diagnostic about the whole file.
 */

import { describe, expect, it } from 'vitest';
import { diagnosticLine } from './diagnosticLine.js';

describe('diagnosticLine', () => {
  it.each([1, 7, 100_000])('passes the 1-based line %i through', (line) => {
    expect(diagnosticLine({ location: { line, column: 3 } })).toBe(line);
  });

  it('reads no location, and a location with no line, as no line', () => {
    expect(diagnosticLine({})).toBeUndefined();
    expect(diagnosticLine({ location: { column: 5 } })).toBeUndefined();
  });

  it.each([0, -2, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'reads %s, which no editor row carries, as no line',
    (line) => {
      expect(diagnosticLine({ location: { line } })).toBeUndefined();
    }
  );
});
