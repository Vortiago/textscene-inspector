/** Unit tests for the pure CLI output formatters. */

import { describe, expect, it } from 'vitest';
import type { Diagnostic } from '@textscene/core/linter';
import type { FileDiagnostics } from './lint';
import {
  formatDiagnostics,
  formatDim,
  formatError,
  formatFilePath,
  formatGithubAnnotations,
  formatSeverity,
  formatSuccess,
  formatJson,
  getSeverityIcon,
  toJsonFindings,
} from './format';

function makeDiagnostic(overrides: Partial<Diagnostic> = {}): Diagnostic {
  return {
    severity: 'error',
    message: 'Something is wrong',
    nodeName: 'Camera',
    nodeType: 'Camera3D',
    ruleName: 'camera3d-missing-fov',
    ...overrides,
  };
}

describe('formatDiagnostics', () => {
  it('returns a single success line for a clean file (no color)', () => {
    expect(formatDiagnostics('scenes/a.tscn', [], false)).toEqual(['✓ scenes/a.tscn']);
  });

  it('returns a green success line for a clean file (color)', () => {
    expect(formatDiagnostics('scenes/a.tscn', [], true)).toEqual([
      '\x1b[32m✓ scenes/a.tscn\x1b[0m',
    ]);
  });

  it('formats an errors block: header, diagnostic line, trailing blank line (no color)', () => {
    const lines = formatDiagnostics('bad.tscn', [makeDiagnostic()], false);

    expect(lines).toEqual([
      'bad.tscn',
      '  ✖ error [Camera3D:Camera] Something is wrong (camera3d-missing-fov)',
      '',
    ]);
  });

  it('formats a warnings block with the warning icon and severity (no color)', () => {
    const warning = makeDiagnostic({
      severity: 'warning',
      message: 'Suspicious value',
      nodeName: 'Child',
      nodeType: 'Node3D',
      ruleName: 'valid-node3d-visibility',
    });

    const lines = formatDiagnostics('warn.tscn', [warning], false);

    expect(lines).toEqual([
      'warn.tscn',
      '  ⚠ warning [Node3D:Child] Suspicious value (valid-node3d-visibility)',
      '',
    ]);
  });

  it('applies ANSI styling to path, severity, node info, and rule info (color)', () => {
    const lines = formatDiagnostics('bad.tscn', [makeDiagnostic()], true);

    expect(lines).toEqual([
      '\x1b[1mbad.tscn\x1b[0m',
      '  ✖ \x1b[31merror\x1b[0m \x1b[2m[Camera3D:Camera]\x1b[0m Something is wrong \x1b[2m(camera3d-missing-fov)\x1b[0m',
      '',
    ]);
  });

  it('formats one line per diagnostic with a single trailing blank line', () => {
    const lines = formatDiagnostics(
      'multi.tscn',
      [makeDiagnostic(), makeDiagnostic({ severity: 'warning' }), makeDiagnostic({ severity: 'warning' })],
      false
    );

    expect(lines).toHaveLength(5); // header + 3 diagnostics + blank
    expect(lines[lines.length - 1]).toBe('');
  });
});

describe('getSeverityIcon', () => {
  it('maps each known severity to its icon', () => {
    expect(getSeverityIcon('error')).toBe('✖');
    expect(getSeverityIcon('warning')).toBe('⚠');
    expect(getSeverityIcon('info')).toBe('ℹ');
  });

  it('floors an off-union severity to the info icon', () => {
    // The same floor `--format json` and `--format github` apply, so one run
    // does not name two tiers for one finding.
    expect(getSeverityIcon('bogus')).toBe('ℹ');
    // `'constructor'` reaches Object.prototype through a bare index.
    expect(getSeverityIcon('constructor')).toBe('ℹ');
  });
});

describe('formatSeverity', () => {
  it('returns plain text when color is off', () => {
    expect(formatSeverity('error', false)).toBe('error');
    expect(formatSeverity('warning', false)).toBe('warning');
    expect(formatSeverity('info', false)).toBe('info');
  });

  it('wraps severities in ANSI color codes when color is on', () => {
    expect(formatSeverity('error', true)).toBe('\x1b[31merror\x1b[0m');
    expect(formatSeverity('warning', true)).toBe('\x1b[33mwarning\x1b[0m');
    expect(formatSeverity('info', true)).toBe('\x1b[36minfo\x1b[0m');
  });

  it('floors an off-union severity to the info tier, styled or not', () => {
    // The stdout tier matches the one `toJsonFindings` reports for the same diagnostic.
    expect(formatSeverity('bogus', true)).toBe('\x1b[36minfo\x1b[0m');
    expect(formatSeverity('bogus', false)).toBe('info');
  });
});

describe('toJsonFindings', () => {
  it('returns an empty array for a clean file', () => {
    const clean: FileDiagnostics = { filePath: 'clean.tscn', diagnostics: [] };

    expect(toJsonFindings([clean])).toEqual([]);
  });

  it('maps a located diagnostic to a finding with numeric line/column', () => {
    const file: FileDiagnostics = {
      filePath: 'bad.tscn',
      diagnostics: [
        makeDiagnostic({
          severity: 'error',
          message: 'Invalid Transform3D',
          ruleName: 'strict-parser',
          location: { line: 4, column: 10 },
        }),
      ],
    };

    expect(toJsonFindings([file])).toEqual([
      {
        file: 'bad.tscn',
        line: 4,
        column: 10,
        severity: 'error',
        rule: 'strict-parser',
        message: 'Invalid Transform3D',
        nodeType: 'Camera3D',
        nodeName: 'Camera',
      },
    ]);
  });

  it('maps line/column to null when a diagnostic carries no location', () => {
    const file: FileDiagnostics = { filePath: 'a.tscn', diagnostics: [makeDiagnostic()] };

    const [finding] = toJsonFindings([file]);
    expect(finding?.line).toBeNull();
    expect(finding?.column).toBeNull();
  });

  it('maps a line no editor row carries to null, its column with it, as the other hosts read it', () => {
    const file: FileDiagnostics = {
      filePath: 'a.tscn',
      diagnostics: [
        makeDiagnostic({ location: { line: 0, column: 3 } }),
        makeDiagnostic({ location: { line: 2.5, column: 1 } }),
      ],
    };

    const findings = toJsonFindings([file]);
    expect(findings.map(({ line, column }) => [line, column])).toEqual([
      [null, null],
      [null, null],
    ]);
  });

  it('maps a file readError to a single synthetic finding, not a per-diagnostic one', () => {
    const file: FileDiagnostics = {
      filePath: 'missing.tscn',
      diagnostics: [],
      readError: "ENOENT: no such file or directory, open 'missing.tscn'",
    };

    expect(toJsonFindings([file])).toEqual([
      {
        file: 'missing.tscn',
        line: null,
        column: null,
        severity: 'error',
        rule: 'file-read-error',
        message: "ENOENT: no such file or directory, open 'missing.tscn'",
        nodeType: '',
        nodeName: '',
      },
    ]);
  });

  it('concatenates findings from multiple files in order', () => {
    const fileA: FileDiagnostics = { filePath: 'a.tscn', diagnostics: [makeDiagnostic({ severity: 'error' })] };
    const fileB: FileDiagnostics = { filePath: 'b.tscn', diagnostics: [makeDiagnostic({ severity: 'warning' })] };

    const findings = toJsonFindings([fileA, fileB]);

    expect(findings.map((f) => f.file)).toEqual(['a.tscn', 'b.tscn']);
    expect(findings.map((f) => f.severity)).toEqual(['error', 'warning']);
  });
});

describe('formatJson', () => {
  it('produces a pretty-printed JSON string that parses back to the same findings', () => {
    const file: FileDiagnostics = { filePath: 'bad.tscn', diagnostics: [makeDiagnostic()] };

    const json = formatJson([file]);

    expect(() => JSON.parse(json)).not.toThrow();
    expect(JSON.parse(json)).toEqual(toJsonFindings([file]));
    expect(json).toContain('\n'); // pretty-printed, not a single line
  });

  it('produces an empty JSON array for no files', () => {
    expect(JSON.parse(formatJson([]))).toEqual([]);
  });
});

describe('formatGithubAnnotations', () => {
  it('formats an error-severity diagnostic as a ::error workflow command with file/line/col', () => {
    const file: FileDiagnostics = {
      filePath: 'bad.tscn',
      diagnostics: [
        makeDiagnostic({
          severity: 'error',
          message: 'Invalid Transform3D',
          ruleName: 'strict-parser',
          location: { line: 4, column: 10 },
        }),
      ],
    };

    expect(formatGithubAnnotations([file])).toEqual([
      '::error file=bad.tscn,line=4,col=10::Invalid Transform3D (strict-parser)',
    ]);
  });

  it('leaves line and col off an annotation whose line no editor row carries', () => {
    const file: FileDiagnostics = {
      filePath: 'bad.tscn',
      diagnostics: [
        makeDiagnostic({ ruleName: 'strict-parser', location: { line: 0, column: 10 } }),
      ],
    };

    const [annotation] = formatGithubAnnotations([file]);
    expect(annotation).toMatch(/^::\w+ file=bad\.tscn::/);
  });

  it('formats a warning-severity diagnostic as a ::warning workflow command', () => {
    const file: FileDiagnostics = {
      filePath: 'warn.tscn',
      diagnostics: [makeDiagnostic({ severity: 'warning', ruleName: 'valid-node3d-visibility' })],
    };

    expect(formatGithubAnnotations([file])[0]).toMatch(/^::warning /);
  });

  it('falls back to ::notice for a severity outside the union, including a prototype key', () => {
    // A bare index reaches Object.prototype, so `'constructor'` reads back a
    // function and any other unknown value throws, which costs the run every
    // annotation, not only this finding's level.
    const file: FileDiagnostics = {
      filePath: 'odd.tscn',
      diagnostics: [
        makeDiagnostic({ severity: 'constructor' as unknown as Diagnostic['severity'] }),
        makeDiagnostic({ severity: 'bogus' as unknown as Diagnostic['severity'] }),
      ],
    };

    // Both lines, spelled out: `every` on an empty array is `true`, so a
    // formatter that dropped the findings would pass this arm.
    expect(formatGithubAnnotations([file])).toEqual([
      expect.stringMatching(/^::notice /),
      expect.stringMatching(/^::notice /),
    ]);

    // The JSON output is the contract a CI tool switches on, and its `severity`
    // is declared as the closed union, so the floor reaches it too.
    expect(toJsonFindings([file]).map((f) => f.severity)).toEqual(['info', 'info']);
  });

  it('omits line and col params when the diagnostic has no location', () => {
    const file: FileDiagnostics = { filePath: 'a.tscn', diagnostics: [makeDiagnostic()] };

    expect(formatGithubAnnotations([file])).toEqual([
      '::error file=a.tscn::Something is wrong (camera3d-missing-fov)',
    ]);
  });

  it('escapes %, CR, and LF in the message per the GitHub workflow-command format', () => {
    const file: FileDiagnostics = {
      filePath: 'a.tscn',
      diagnostics: [makeDiagnostic({ message: '100% broken\r\nsee above' })],
    };

    expect(formatGithubAnnotations([file])[0]).toContain('100%25 broken%0D%0Asee above');
  });

  it('escapes colons and commas in the file path property', () => {
    const file: FileDiagnostics = { filePath: 'C:/scenes/a,b.tscn', diagnostics: [makeDiagnostic()] };

    expect(formatGithubAnnotations([file])[0]).toContain('file=C%3A/scenes/a%2Cb.tscn');
  });

  it('emits a single ::error annotation (no line/col) for an unreadable file', () => {
    const file: FileDiagnostics = { filePath: 'missing.tscn', diagnostics: [], readError: 'ENOENT: missing.tscn' };

    expect(formatGithubAnnotations([file])).toEqual([
      '::error file=missing.tscn::ENOENT: missing.tscn (file-read-error)',
    ]);
  });

  it('concatenates annotations from multiple files in order', () => {
    const fileA: FileDiagnostics = { filePath: 'a.tscn', diagnostics: [makeDiagnostic({ severity: 'error' })] };
    const fileB: FileDiagnostics = { filePath: 'b.tscn', diagnostics: [makeDiagnostic({ severity: 'warning' })] };

    const lines = formatGithubAnnotations([fileA, fileB]);

    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('file=a.tscn');
    expect(lines[1]).toContain('file=b.tscn');
  });

  it('returns an empty array when there are no findings', () => {
    expect(formatGithubAnnotations([{ filePath: 'clean.tscn', diagnostics: [] }])).toEqual([]);
  });
});

describe('simple formatters', () => {
  it('formatFilePath bolds only when color is on', () => {
    expect(formatFilePath('a.tscn', true)).toBe('\x1b[1ma.tscn\x1b[0m');
    expect(formatFilePath('a.tscn', false)).toBe('a.tscn');
  });

  it('formatSuccess is green only when color is on', () => {
    expect(formatSuccess('ok', true)).toBe('\x1b[32mok\x1b[0m');
    expect(formatSuccess('ok', false)).toBe('ok');
  });

  it('formatError is red only when color is on', () => {
    expect(formatError('boom', true)).toBe('\x1b[31mboom\x1b[0m');
    expect(formatError('boom', false)).toBe('boom');
  });

  it('formatDim dims only when color is on', () => {
    expect(formatDim('meta', true)).toBe('\x1b[2mmeta\x1b[0m');
    expect(formatDim('meta', false)).toBe('meta');
  });
});
