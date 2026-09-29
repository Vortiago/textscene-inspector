/** Opens one fixture in a fresh browser context, the way every web gate scenario starts. */
import { findCanvas, gotoFixture, VIEWPORT } from '../visual/previewServer.mjs';
import { attachDiagnostics } from './pageDiagnostics.mjs';

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
