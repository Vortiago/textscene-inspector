/**
 * One capture session: a fresh build served on its own port, and a SwiftShader Chromium on it. The
 * browser closes and the server stops however the session ends, so no harness leaves either behind.
 */

import { launchSwiftShaderBrowser } from '../../showcase/browser.mjs';
import { acquireBuildLock } from './buildLock.mjs';
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
  const release = await acquireBuildLock({ portEnvName });
  try {
    ensureWebBuilt();
    await assertPortFree(port, portEnvName);
    const { proc, baseUrl } = startPreview(port);
    let browser;
    try {
      await waitForServer(`${baseUrl}/`);
      browser = await launchBrowser();
      await warmUpGLContext(browser);
      return await work(browser, baseUrl);
    } finally {
      try {
        await browser?.close();
      } catch {
        // A crashed browser can reject close while its preview still holds the port.
      }
      await killPreviewGroup(proc);
    }
  } finally {
    release();
  }
}
