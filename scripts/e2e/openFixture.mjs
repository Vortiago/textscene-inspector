/** Opens one fixture in a fresh browser context, the way every web gate scenario starts. */
import {
  attachDiagnostics,
  findCanvas,
  gotoFixture,
  settleCanvas,
  VIEWPORT,
} from '../visual/previewServer.mjs';

/**
 * Installs each `[script, argument]` pair before the first navigation, so a probe sees the
 * first paint. Throws, tagged with `label`, when the fixture draws no canvas.
 */
export async function openFixture(browser, baseUrl, { fixture, label, initScripts = [] }) {
  const context = await browser.newContext({ viewport: VIEWPORT });
  for (const [script, argument] of initScripts) await context.addInitScript(script, argument);
  const page = await context.newPage();
  const diagnostics = attachDiagnostics(page);
  await gotoFixture(page, baseUrl, fixture);
  const { canvas, reason } = await findCanvas(page);
  if (reason) throw new Error(`[${label}] ${fixture}: ${reason}`);
  return { context, page, canvas, diagnostics };
}

/** The settled canvas of `page` as a PNG buffer. Throws, tagged with `label`, when none settles. */
export async function shootCanvas(page, label) {
  const { canvas, reason } = await findCanvas(page);
  if (reason) throw new Error(`[${label}] ${reason}`);
  const { buffer, reason: settleReason } = await settleCanvas(page, canvas);
  if (!buffer) throw new Error(`[${label}] the canvas never settled: ${settleReason}`);
  return buffer;
}
