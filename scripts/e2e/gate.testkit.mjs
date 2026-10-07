/** Test doubles for the web-app E2E gate's check functions. */

/** The gate shape every check writes to, keeping each failure message. */
export function fakeGate() {
  const failures = [];
  return { failures, check: (condition, message) => !condition && failures.push(message) };
}

/** A page load that logged no warning, no error and no failed request. */
export const CLEAN_LOAD = { consoleErrors: [], consoleWarnings: [], pageErrors: [], failedRequests: [] };
