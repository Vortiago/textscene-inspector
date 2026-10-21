/**
 * What a page logs while a harness drives it: console errors and warnings, uncaught page errors
 * and failed requests. The one collector of every harness. Each harness decides which of them
 * fail its check.
 */

/** Collects a page's console messages, uncaught errors and failed requests, from now on. */
export function attachDiagnostics(page) {
  const diagnostics = { consoleErrors: [], consoleWarnings: [], pageErrors: [], failedRequests: [] };
  page.on('console', (message) => {
    const type = message.type();
    if (type === 'error') diagnostics.consoleErrors.push(message.text());
    else if (type === 'warning') diagnostics.consoleWarnings.push(message.text());
  });
  page.on('pageerror', (error) => diagnostics.pageErrors.push(String(error)));
  page.on('requestfailed', (request) => {
    diagnostics.failedRequests.push({ url: request.url(), failure: request.failure()?.errorText });
  });
  return diagnostics;
}

/**
 * Empties every list in place, since the page's listeners hold them. A harness that captures many
 * scenes on one page clears before each, so an error from the previous scene is not blamed on it.
 */
export function clearDiagnostics(diagnostics) {
  for (const list of Object.values(diagnostics)) list.length = 0;
}

/** The console errors and uncaught page errors: a broken render, however plausible its pixels. */
export function loggedErrors({ consoleErrors, pageErrors }) {
  return [...consoleErrors, ...pageErrors];
}
