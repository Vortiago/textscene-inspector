/**
 * Polls every 50ms until `predicate()` is true or `timeoutMs` elapses, and returns
 * whether it held. Every wait in the extension host suites builds on it. With
 * `describeFailure`, a timeout throws its message instead of returning `false`.
 */
export async function waitFor(
  predicate: () => boolean,
  timeoutMs: number,
  describeFailure?: () => string
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) {
      return true;
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  // The condition can come true during the last sleep, which a loaded CI runner
  // otherwise reports as a timeout.
  if (predicate()) {
    return true;
  }
  if (describeFailure) {
    throw new Error(describeFailure());
  }
  return false;
}
