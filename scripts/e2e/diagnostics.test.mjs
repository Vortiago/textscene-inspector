import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import { attachDiagnostics, checkDiagnostics, unexpectedWarnings } from './diagnostics.mjs';

const CLOCK_DEPRECATION = 'THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.';
const REMOVED_TYPE_WARNING =
  'THREE.WebGLShadowMap: PCFSoftShadowMap has been removed. Using PCFShadowMap instead.';

/** A Playwright page's `on`, with handlers the test drives. */
function fakePage() {
  return new EventEmitter();
}

/** Emits one console message with the method shape `attachDiagnostics` reads. */
function emitConsole(page, type, text) {
  page.emit('console', { type: () => type, text: () => text });
}

/** The gate shape `checkDiagnostics` writes to. */
function fakeGate() {
  const failures = [];
  return { failures, check: (condition, message) => !condition && failures.push(message) };
}

const CLEAN_LOAD = { consoleErrors: [], consoleWarnings: [], pageErrors: [], failedRequests: [] };

describe('unexpectedWarnings', () => {
  it('accepts a warning a healthy load logs', () => {
    expect(unexpectedWarnings([CLOCK_DEPRECATION])).toEqual([]);
  });

  it('accepts an accepted warning that carries more text after the prefix', () => {
    expect(unexpectedWarnings([`${CLOCK_DEPRECATION} Raised on the first Canvas.`])).toEqual([]);
  });

  it('reports a warning about a removed feature (error case)', () => {
    expect(unexpectedWarnings([REMOVED_TYPE_WARNING])).toEqual([REMOVED_TYPE_WARNING]);
  });

  it('reports a message that only contains an accepted prefix (edge case)', () => {
    expect(unexpectedWarnings([`prefix ${CLOCK_DEPRECATION}`])).toEqual([`prefix ${CLOCK_DEPRECATION}`]);
  });

  it('reports nothing for a page that logged no warning', () => {
    expect(unexpectedWarnings([])).toEqual([]);
  });
});

describe('attachDiagnostics', () => {
  it('keeps warnings and errors apart and drops info and debug', () => {
    const page = fakePage();
    const diagnostics = attachDiagnostics(page);
    emitConsole(page, 'warning', 'a warning');
    emitConsole(page, 'error', 'an error');
    emitConsole(page, 'info', 'an info');
    emitConsole(page, 'debug', 'a debug');
    expect(diagnostics.consoleWarnings).toEqual(['a warning']);
    expect(diagnostics.consoleErrors).toEqual(['an error']);
  });
});

describe('checkDiagnostics', () => {
  it('records nothing for a load with no warning and no error', () => {
    const gate = fakeGate();
    checkDiagnostics(gate, '[3D]', CLEAN_LOAD);
    expect(gate.failures).toEqual([]);
  });

  it('records nothing for an accepted warning', () => {
    const gate = fakeGate();
    checkDiagnostics(gate, '[3D]', { ...CLEAN_LOAD, consoleWarnings: [CLOCK_DEPRECATION] });
    expect(gate.failures).toEqual([]);
  });

  it('records an unexpected warning, naming it (error case)', () => {
    const gate = fakeGate();
    checkDiagnostics(gate, '[3D]', { ...CLEAN_LOAD, consoleWarnings: [REMOVED_TYPE_WARNING] });
    expect(gate.failures).toHaveLength(1);
    expect(gate.failures[0]).toContain('[3D] 1 unexpected console warning(s)');
    expect(gate.failures[0]).toContain('PCFSoftShadowMap');
  });
});
