/** Unit tests for the pure CLI output formatters. */

import { describe, expect, it } from 'vitest';
import type { Diagnostic } from '@textscene/core/linter';
import {
  formatDiagnostics,
  formatDim,
  formatError,
  formatFilePath,
  formatSeverity,
  formatSuccess,
  getSeverityIcon,
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
      [makeDiagnostic(), makeDiagnostic({ severity: 'warning' }), makeDiagnostic({ severity: 'info' })],
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

  it('falls back to a bullet for unknown severities', () => {
    expect(getSeverityIcon('bogus')).toBe('•');
  });
});

describe('formatSeverity', () => {
  it('returns plain text when color is off', () => {
    expect(formatSeverity('error', false)).toBe('error');
    expect(formatSeverity('warning', false)).toBe('warning');
  });

  it('wraps severities in ANSI color codes when color is on', () => {
    expect(formatSeverity('error', true)).toBe('\x1b[31merror\x1b[0m');
    expect(formatSeverity('warning', true)).toBe('\x1b[33mwarning\x1b[0m');
    expect(formatSeverity('info', true)).toBe('\x1b[36minfo\x1b[0m');
  });

  it('leaves unknown severities unstyled even when color is on', () => {
    expect(formatSeverity('bogus', true)).toBe('bogus');
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
