/**
 * Tests for the pure `Diagnostic[]` grouping per line and for the file-level section, and for
 * the problem-count badge.
 */
import { describe, expect, it } from 'vitest';
import type { Diagnostic } from '@textscene/core/linter';
import {
  groupDiagnostics,
  summarizeDiagnostics,
  formatProblemBadge,
} from './lineDiagnostics';

function diagnostic(overrides: Partial<Diagnostic> & Pick<Diagnostic, 'severity' | 'message'>): Diagnostic {
  return {
    nodeName: 'Node',
    nodeType: 'Node3D',
    ruleName: 'test-rule',
    location: { line: 1, column: 1 },
    ...overrides,
  };
}

describe('groupDiagnostics by line', () => {
  it('maps a single diagnostic onto its line at its own severity', () => {
    const d = diagnostic({ severity: 'warning', message: 'oops', location: { line: 3 } });
    const { byLine } = groupDiagnostics([d]);
    expect(byLine.get(3)).toEqual({ line: 3, severity: 'warning', messages: ['oops'] });
  });

  it('collapses multiple diagnostics on one line to the max severity with all messages, in order', () => {
    const diagnostics = [
      diagnostic({ severity: 'warning', message: 'first warning', location: { line: 5 } }),
      diagnostic({ severity: 'error', message: 'fatal problem', location: { line: 5 } }),
      diagnostic({ severity: 'warning', message: 'another note', location: { line: 5 } }),
    ];
    const { byLine } = groupDiagnostics(diagnostics);
    expect(byLine.size).toBe(1);
    expect(byLine.get(5)).toEqual({
      line: 5,
      severity: 'error',
      messages: ['first warning', 'fatal problem', 'another note'],
    });
  });

  it('produces neither a line nor a file-level group for no diagnostics', () => {
    const { byLine, fileLevel } = groupDiagnostics([]);
    expect(byLine.size).toBe(0);
    expect(fileLevel).toBeNull();
  });

  it('floors a severity outside the union rather than letting it hold the row', () => {
    // `SEVERITY_ORDER[<off-union>]` is `undefined` and every comparison against
    // it is false, so an unfloored first severity keeps the gutter against the
    // error behind it.
    const diagnostics = [
      diagnostic({
        severity: 'bogus' as unknown as Diagnostic['severity'],
        message: 'off-union',
        location: { line: 4 },
      }),
      diagnostic({ severity: 'error', message: 'fatal', location: { line: 4 } }),
    ];
    expect(groupDiagnostics(diagnostics).byLine.get(4)).toEqual({
      line: 4,
      severity: 'error',
      messages: ['off-union', 'fatal'],
    });
  });

  it('keeps diagnostics on different lines as separate entries', () => {
    const diagnostics = [
      diagnostic({ severity: 'error', message: 'bad line 2', location: { line: 2 } }),
      diagnostic({ severity: 'warning', message: 'bad line 9', location: { line: 9 } }),
    ];
    const { byLine } = groupDiagnostics(diagnostics);
    expect(byLine.size).toBe(2);
    expect(byLine.get(2)?.severity).toBe('error');
    expect(byLine.get(9)?.severity).toBe('warning');
  });
});

describe('groupDiagnostics for the file-level section', () => {
  it('puts a diagnostic with no location in the file-level group, not on a line', () => {
    const withLocation = diagnostic({ severity: 'error', message: 'has line', location: { line: 4 } });
    const noLocation = diagnostic({ severity: 'warning', message: 'no line info', location: undefined });
    const { byLine, fileLevel } = groupDiagnostics([withLocation, noLocation]);
    expect([...byLine.keys()]).toEqual([4]);
    expect(byLine.get(4)?.messages).toEqual(['has line']);
    expect(fileLevel).toEqual({ severity: 'warning', messages: ['no line info'] });
  });

  it('never puts a locationless diagnostic on line 1, which would claim that line is at fault', () => {
    const { byLine } = groupDiagnostics([diagnostic({ severity: 'info', message: 'file', location: undefined })]);
    expect(byLine.size).toBe(0);
  });

  it('takes a location that names no row: no line, a zero, a negative, a fraction, NaN', () => {
    const rowless = [{ column: 3 }, { line: 0 }, { line: -2 }, { line: 1.5 }, { line: Number.NaN }];
    const { byLine, fileLevel } = groupDiagnostics(
      rowless.map((location, i) => diagnostic({ severity: 'info', message: `m${i}`, location }))
    );
    expect(byLine.size).toBe(0);
    expect(fileLevel?.messages).toEqual(['m0', 'm1', 'm2', 'm3', 'm4']);
  });

  it('keeps the highest severity and every message in order, flooring an off-union one', () => {
    const { fileLevel } = groupDiagnostics([
      diagnostic({ severity: 'info', message: 'a', location: undefined }),
      diagnostic({ severity: 'error', message: 'b', location: undefined }),
      diagnostic({ severity: 'bogus' as unknown as Diagnostic['severity'], message: 'c', location: undefined }),
    ]);
    expect(fileLevel).toEqual({ severity: 'error', messages: ['a', 'b', 'c'] });
  });

  it('is null when every diagnostic names a line', () => {
    const { fileLevel } = groupDiagnostics([diagnostic({ severity: 'error', message: 'x', location: { line: 2 } })]);
    expect(fileLevel).toBeNull();
  });
});

describe('the badge and the two groups', () => {
  it('count the same findings: every diagnostic lands in exactly one group', () => {
    const diagnostics = [
      diagnostic({ severity: 'error', message: 'line 2', location: { line: 2 } }),
      diagnostic({ severity: 'warning', message: 'line 2 again', location: { line: 2 } }),
      diagnostic({ severity: 'info', message: 'line 7', location: { line: 7 } }),
      diagnostic({ severity: 'warning', message: 'file', location: undefined }),
      diagnostic({ severity: 'error', message: 'file too', location: { line: 0 } }),
    ];
    const { byLine, fileLevel } = groupDiagnostics(diagnostics);
    const shown = [...byLine.values()].flatMap((g) => g.messages).concat(fileLevel?.messages ?? []);

    expect(shown.sort()).toEqual(diagnostics.map((d) => d.message).sort());
    expect(shown).toHaveLength(summarizeDiagnostics(diagnostics).total);
  });
});

describe('summarizeDiagnostics', () => {
  it('counts each severity and a total', () => {
    const diagnostics = [
      diagnostic({ severity: 'error', message: 'a' }),
      diagnostic({ severity: 'error', message: 'b' }),
      diagnostic({ severity: 'warning', message: 'c' }),
      diagnostic({ severity: 'warning', message: 'd' }),
      diagnostic({ severity: 'info', message: 'e' }),
    ];
    expect(summarizeDiagnostics(diagnostics)).toEqual({
      errors: 2,
      warnings: 2,
      infos: 1,
      total: 5,
    });
  });

  it('returns all-zero counts for no diagnostics', () => {
    expect(summarizeDiagnostics([])).toEqual({ errors: 0, warnings: 0, infos: 0, total: 0 });
  });

  it('counts a severity outside the union rather than throwing the badge away', () => {
    // The switch is total for tsc; at runtime it floors, because this runs in a
    // `useMemo` and the app carries no error boundary.
    const odd = diagnostic({
      severity: 'bogus' as unknown as Diagnostic['severity'],
      message: 'off-union',
    });

    expect(summarizeDiagnostics([odd])).toEqual({ errors: 0, warnings: 0, infos: 1, total: 1 });
  });
});

describe('formatProblemBadge', () => {
  it('returns null when there are no problems (badge should not render)', () => {
    expect(formatProblemBadge({ errors: 0, warnings: 0, infos: 0, total: 0 })).toBeNull();
  });

  it('formats errors and warnings together, errors first', () => {
    expect(formatProblemBadge({ errors: 1, warnings: 2, infos: 0, total: 3 })).toBe('✖ 1 / ⚠ 2');
    expect(formatProblemBadge({ errors: 1, warnings: 0, infos: 2, total: 3 })).toBe('✖ 1 / ℹ 2');
  });

  it('formats only errors when there are no warnings', () => {
    expect(formatProblemBadge({ errors: 3, warnings: 0, infos: 0, total: 3 })).toBe('✖ 3');
  });

  it('formats only warnings when there are no errors', () => {
    expect(formatProblemBadge({ errors: 0, warnings: 2, infos: 0, total: 2 })).toBe('⚠ 2');
  });
});
