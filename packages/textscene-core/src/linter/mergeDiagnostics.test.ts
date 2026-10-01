/** The one merge a lint session publishes through: a file's own diagnostics and the cross-file ones, sorted. */

import { describe, expect, it } from 'vitest';
import { mergeDiagnostics, sortDiagnostics } from './mergeDiagnostics.js';
import type { Diagnostic } from './types.js';

function diagnostic(severity: string, ruleName: string): Diagnostic {
  return {
    severity: severity as Diagnostic['severity'],
    message: ruleName,
    nodeName: 'n',
    nodeType: 't',
    ruleName,
  };
}

describe('sortDiagnostics', () => {
  it('orders errors, then warnings, then infos, keeping the order within a tier', () => {
    const sorted = sortDiagnostics([
      diagnostic('info', 'i'),
      diagnostic('warning', 'w1'),
      diagnostic('error', 'e'),
      diagnostic('warning', 'w2'),
    ]);
    expect(sorted.map((d) => d.ruleName)).toEqual(['e', 'w1', 'w2', 'i']);
  });

  it('ranks a severity outside the union as info', () => {
    const sorted = sortDiagnostics([
      diagnostic('fatal', 'x'),
      diagnostic('warning', 'w'),
      diagnostic('info', 'i'),
    ]);
    expect(sorted.map((d) => d.ruleName)).toEqual(['w', 'x', 'i']);
  });
});

describe('mergeDiagnostics', () => {
  it('holds every diagnostic of both lists, sorted errors first', () => {
    const local = [diagnostic('warning', 'local-w'), diagnostic('info', 'local-i')];
    const crossFile = [diagnostic('error', 'cross-e')];

    expect(mergeDiagnostics(local, crossFile).map((d) => d.ruleName)).toEqual([
      'cross-e',
      'local-w',
      'local-i',
    ]);
  });

  it('writes to neither input', () => {
    const local = [diagnostic('info', 'i')];
    const crossFile = [diagnostic('error', 'e')];

    mergeDiagnostics(local, crossFile);

    expect(local.map((d) => d.ruleName)).toEqual(['i']);
    expect(crossFile.map((d) => d.ruleName)).toEqual(['e']);
  });

  it('is the file-local list for no cross-file diagnostic', () => {
    const local = [diagnostic('error', 'e'), diagnostic('info', 'i')];
    expect(mergeDiagnostics(local, [])).toEqual(local);
  });
});
