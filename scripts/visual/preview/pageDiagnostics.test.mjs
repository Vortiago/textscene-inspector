import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import {
  attachDiagnostics,
  clearDiagnostics,
  describeFailedRequests,
  errorReport,
  loggedErrors,
} from './pageDiagnostics.mjs';

/** A Playwright page's `on`, with handlers the test drives. */
function fakePage() {
  return new EventEmitter();
}

/** Emits one console message with the method shape `attachDiagnostics` reads. */
function emitConsole(page, type, text) {
  page.emit('console', { type: () => type, text: () => text });
}

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

  it('records an uncaught page error and a failed request', () => {
    const page = fakePage();
    const diagnostics = attachDiagnostics(page);
    page.emit('pageerror', new TypeError('x is not a function'));
    page.emit('requestfailed', {
      url: () => 'http://h/a.png',
      failure: () => ({ errorText: 'net::ERR_FAILED' }),
    });
    expect(diagnostics.pageErrors).toEqual(['TypeError: x is not a function']);
    expect(diagnostics.failedRequests).toEqual([{ url: 'http://h/a.png', failure: 'net::ERR_FAILED' }]);
  });
});

describe('loggedErrors', () => {
  it('answers the console errors, then the uncaught page errors', () => {
    const page = fakePage();
    const diagnostics = attachDiagnostics(page);
    page.emit('pageerror', new Error('thrown'));
    emitConsole(page, 'error', 'logged');
    expect(loggedErrors(diagnostics)).toEqual(['logged', 'Error: thrown']);
  });

  it('leaves out warnings and failed requests (edge case)', () => {
    const page = fakePage();
    const diagnostics = attachDiagnostics(page);
    emitConsole(page, 'warning', 'a warning');
    page.emit('requestfailed', { url: () => 'http://h/a.png', failure: () => null });
    expect(loggedErrors(diagnostics)).toEqual([]);
  });
});

describe('errorReport', () => {
  it('says a failed request carried no error text, rather than printing undefined', () => {
    const diagnostics = { consoleErrors: [], consoleWarnings: [], pageErrors: [], failedRequests: [] };
    diagnostics.failedRequests.push({ url: 'http://h/a.png', failure: undefined });
    expect(errorReport(diagnostics)).toBe('failed request: http://h/a.png (no error text)');
  });

  it('labels each logged error with its source, before the failed requests', () => {
    const diagnostics = { consoleErrors: ['c'], consoleWarnings: [], pageErrors: ['p'], failedRequests: [] };
    expect(errorReport(diagnostics)).toBe('console error: c | page error: p');
  });
});

describe('clearDiagnostics', () => {
  it('empties every list, so the next scene on the page starts clean', () => {
    const page = fakePage();
    const diagnostics = attachDiagnostics(page);
    emitConsole(page, 'error', 'stale');
    emitConsole(page, 'warning', 'stale');
    page.emit('pageerror', new Error('stale'));
    clearDiagnostics(diagnostics);
    expect(diagnostics).toEqual({
      consoleErrors: [],
      consoleWarnings: [],
      pageErrors: [],
      failedRequests: [],
    });
  });

  it('keeps collecting into the same lists after a clear', () => {
    const page = fakePage();
    const diagnostics = attachDiagnostics(page);
    clearDiagnostics(diagnostics);
    emitConsole(page, 'error', 'fresh');
    expect(diagnostics.consoleErrors).toEqual(['fresh']);
  });
});

describe('describeFailedRequests', () => {
  const lost = (n) =>
    Array.from({ length: n }, (_, i) => ({ url: `http://h/${i}.js`, failure: 'net::ERR_X' }));

  it('names each failed request as its failure and url', () => {
    expect(describeFailedRequests(lost(2))).toBe('net::ERR_X http://h/0.js | net::ERR_X http://h/1.js');
  });

  it('lists the first three and counts the rest (edge case)', () => {
    expect(describeFailedRequests(lost(5))).toBe(
      'net::ERR_X http://h/0.js | net::ERR_X http://h/1.js | net::ERR_X http://h/2.js and 2 more'
    );
  });

  it('names a request that carries no failure text (edge case)', () => {
    expect(describeFailedRequests([{ url: 'http://h/a.js' }])).toBe('unknown failure http://h/a.js');
  });
});
