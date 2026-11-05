/**
 * Whether the code runs under vitest. happy-dom has neither `FontFace` nor a 2D canvas context, so a
 * font loader settles on its fallback before any DOM font API, and drei's `<Text>` is skipped. The
 * skip is deliberate, so it does not warn.
 */
export const IS_VITEST = (() => {
  const proc = (globalThis as { process?: { env?: { VITEST?: string } } }).process;
  return proc?.env?.VITEST === 'true';
})();
