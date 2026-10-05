/**
 * `diagnosticLine`: a line an editor row carries passes through, and anything else reads as no
 * line, so every host shows it as a diagnostic about the whole file. `diagnosticRange` places
 * the squiggle every host draws.
 */

import { describe, expect, it } from 'vitest';
import { diagnosticLine, diagnosticRange } from './diagnosticLine.js';

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

describe('diagnosticRange', () => {
  const lines = { lineCount: 3, lineLength: (line: number) => [10, 4, 0][line] ?? 0 };

  it('spans a named line from its column to the line end, zero-based', () => {
    expect(diagnosticRange({ location: { line: 1, column: 3 } }, lines)).toEqual({
      start: { line: 0, character: 2 },
      end: { line: 0, character: 10 },
    });
  });

  it('spans the whole line when there is no column', () => {
    expect(diagnosticRange({ location: { line: 2 } }, lines)).toEqual({
      start: { line: 1, character: 0 },
      end: { line: 1, character: 4 },
    });
  });

  it('clamps a line past the end into the last line, and a column past the end to it', () => {
    expect(diagnosticRange({ location: { line: 9, column: 99 } }, lines)).toEqual({
      start: { line: 2, character: 0 },
      end: { line: 2, character: 0 },
    });
  });

  it('gives a diagnostic about the whole file a zero-width range at the start', () => {
    expect(diagnosticRange({}, lines)).toEqual({
      start: { line: 0, character: 0 },
      end: { line: 0, character: 0 },
    });
  });
});
