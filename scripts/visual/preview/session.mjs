/**
 * One capture session: a fresh build served on its own port, and a SwiftShader Chromium on it. The
 * browser closes and the server stops however the session ends, so no harness leaves either behind.
 */

import { chromium } from 'playwright';
import { SWIFTSHADER_GL_ARGS } from '../../showcase/browser.mjs';
import { warmUpGLContext } from './captureContext.mjs';
import { assertPortFree, killPreviewGroup, startPreview, waitForServer } from './server.mjs';
import { ensureWebBuilt } from './webBuild.mjs';

/**
 * Runs `work(browser, baseUrl)` against the previewer on `port`, and answers what it answers.
 * `portEnvName` is the variable a user sets when another process holds the port.
 */
export async function withPreviewBrowser({ port, portEnvName }, work) {
  // Build before the port check: a cold build is long enough for another worktree's harness to
  // claim the port in between.
  ensureWebBuilt();
  await assertPortFree(port, portEnvName);
  const { proc, baseUrl } = startPreview(port);
  let browser;
  try {
    await waitForServer(`${baseUrl}/`);
    // Playwright's bundled Chromium, pinned by the lockfile, and SwiftShader software GL, so local
    // and CI render the same bits with no GPU or driver variance.
    browser = await chromium.launch({ headless: true, args: SWIFTSHADER_GL_ARGS });
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
