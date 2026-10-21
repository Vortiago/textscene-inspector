/**
 * One capture session: a fresh build served on its own port, and a SwiftShader Chromium on it. The
 * browser closes and the server stops however the session ends, so no harness leaves either behind.
 */

import { launchSwiftShaderBrowser } from '../../showcase/browser.mjs';
import { warmUpGLContext } from './captureContext.mjs';
import { assertPortFree, killPreviewGroup, startPreview, waitForServer } from './server.mjs';
import { ensureWebBuilt } from './webBuild.mjs';

/**
 * Runs `work(browser, baseUrl)` against the previewer on `port`, and answers what it answers.
 * `portEnvName` is the variable a user sets when another process holds the port. `launchBrowser`
 * starts the browser: a capture that measures against Godot passes `launchGodotComparisonBrowser`.
 */
export async function withPreviewBrowser(
  { port, portEnvName, launchBrowser = launchSwiftShaderBrowser },
  work
) {
  // Build before the port check: a cold build is long enough for another worktree's harness to
  // claim the port in between.
  ensureWebBuilt();
  await assertPortFree(port, portEnvName);
  const { proc, baseUrl } = startPreview(port);
  let browser;
  try {
    await waitForServer(`${baseUrl}/`);
    browser = await launchBrowser();
    // Takes the first-context-lost risk before any real capture page opens.
    await warmUpGLContext(browser);
    return await work(browser, baseUrl);
  } finally {
    // A crashed browser rejects close(), which would skip the kill below and leave `vite preview`
    // holding the port.
    try {
      await browser?.close();
    } catch {
      /* already gone */
    }
    killPreviewGroup(proc);
  }
}
