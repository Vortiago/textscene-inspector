/**
 * Whether the code runs under vitest. happy-dom has no 2D canvas context, so drei's `<Text>` is
 * skipped. The skip is deliberate, so it does not warn.
 */
export const IS_VITEST = (() => {
  const proc = (globalThis as { process?: { env?: { VITEST?: string } } }).process;
  return proc?.env?.VITEST === 'true';
})();
