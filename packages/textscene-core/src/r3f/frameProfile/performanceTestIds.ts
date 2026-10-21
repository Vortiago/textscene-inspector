/**
 * The test ids of the Performance overlay cells the work budget check reads. The harnesses cannot
 * import TypeScript, so `scripts/visual/preview/appContract.mjs` declares the same values, and
 * `previewServer.test.mjs` fails when they differ.
 */
export const PERFORMANCE_TESTIDS = {
  overlay: 'performance-overlay',
  frameMs: 'performance-frame',
  drawCalls: 'performance-draws',
} as const;
