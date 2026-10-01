/**
 * Load health for the web-app E2E gate: console errors, uncaught page errors and failed
 * requests, collected per page and checked per scenario.
 */

/** Collects a page's errors and failed requests. The app is offline, so all stay empty. */
export function attachDiagnostics(page) {
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('requestfailed', (request) => {
    failedRequests.push({ url: request.url(), failure: request.failure()?.errorText });
  });
  return { consoleErrors, pageErrors, failedRequests };
}

export function checkDiagnostics(gate, label, diagnostics) {
  gate.check(
    diagnostics.consoleErrors.length === 0,
    `${label} ${diagnostics.consoleErrors.length} console error(s): ${diagnostics.consoleErrors.slice(0, 3).join(' | ')}`
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
