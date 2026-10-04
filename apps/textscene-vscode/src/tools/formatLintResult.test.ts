import { describe, expect, it } from 'vitest';
import { formatLintResult } from './formatLintResult';
import type { Diagnostic } from '@textscene/core/linter';

describe('formatLintResult', () => {
  it('reports a clean scene on one line', () => {
    expect(formatLintResult('scenes/Main.tscn', [])).toBe('scenes/Main.tscn: no findings.');
  });

  it('writes one line per finding with its line, tier, message and rule', () => {
    const diagnostics: Diagnostic[] = [
      {
        severity: 'error',
        message: 'value is refused',
        nodeName: 'Mesh',
        nodeType: 'MeshInstance3D',
        ruleName: 'some-rule',
        location: { line: 7 },
      },
    ];
    expect(formatLintResult('scenes/Main.tscn', diagnostics)).toBe(
      [
        'scenes/Main.tscn: 1 finding.',
        '  line 7: [error] value is refused (some-rule) Mesh (MeshInstance3D)',
      ].join('\n')
    );
  });

  it('says the file rather than a line when a finding names none', () => {
    const diagnostics: Diagnostic[] = [
      { severity: 'warning', message: 'about the file', nodeName: '', nodeType: '', ruleName: 'file-rule' },
    ];
    expect(formatLintResult('Main.tscn', diagnostics)).toContain(
      '  the file: [warning] about the file (file-rule)'
    );
  });
});
