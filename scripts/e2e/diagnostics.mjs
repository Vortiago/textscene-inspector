/**
 * Load health for the web-app E2E gate: console errors and warnings, uncaught page errors and
 * failed requests, collected per page and checked per scenario.
 */

/**
 * Warnings a healthy load logs, matched by prefix. Every other warning fails the scenario, so a
 * library that warns about a removed feature or a lost WebGL context stops the gate.
 */
const EXPECTED_WARNINGS = [
  // A dependency still constructs a THREE.Clock; the app cannot retire the class.
  'THREE.Clock: This module has been deprecated.',
];

/** The console warnings that no entry in `EXPECTED_WARNINGS` accepts. */
export function unexpectedWarnings(warnings) {
  return warnings.filter((text) => !EXPECTED_WARNINGS.some((prefix) => text.startsWith(prefix)));
}

/** Collects a page's console messages, uncaught errors and failed requests. */
export function attachDiagnostics(page) {
  const consoleErrors = [];
  const consoleWarnings = [];
  const pageErrors = [];
  const failedRequests = [];
  page.on('console', (message) => {
    const type = message.type();
    if (type === 'error') consoleErrors.push(message.text());
    else if (type === 'warning') consoleWarnings.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('requestfailed', (request) => {
    failedRequests.push({ url: request.url(), failure: request.failure()?.errorText });
  });
  return { consoleErrors, consoleWarnings, pageErrors, failedRequests };
}

export function checkDiagnostics(gate, label, diagnostics) {
  gate.check(
    diagnostics.consoleErrors.length === 0,
    `${label} ${diagnostics.consoleErrors.length} console error(s): ${diagnostics.consoleErrors.slice(0, 3).join(' | ')}`
  );
  const warnings = unexpectedWarnings(diagnostics.consoleWarnings);
  gate.check(
    warnings.length === 0,
    `${label} ${warnings.length} unexpected console warning(s): ${warnings.slice(0, 3).join(' | ')}`
  );
  gate.check(
    diagnostics.pageErrors.length === 0,
    `${label} ${diagnostics.pageErrors.length} uncaught page error(s): ${diagnostics.pageErrors.slice(0, 3).join(' | ')}`
  );
  gate.check(
    diagnostics.failedRequests.length === 0,
    `${label} ${diagnostics.failedRequests.length} failed request(s): ` +
      diagnostics.failedRequests
        .slice(0, 3)
        .map((r) => `${r.failure} ${r.url}`)
        .join(' | ')
  );
}
