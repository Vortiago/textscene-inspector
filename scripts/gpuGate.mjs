/**
 * Runs one GPU gate: serves the gate's page, draws it in headless Chromium, reads the samples the
 * page's entry function returns, and judges them. Unit tests run under happy-dom, which runs no
 * shader, so a gate checks what the real shaders draw.
 */
import { createServer } from 'vite';
import { launchShowcaseBrowser } from './showcase/browser.mjs';
import { REPO_ROOT } from './visual/preview/paths.mjs';
import { previewPort } from './visual/preview/ports.mjs';

/* global window */
// `window` exists only in the browser that runs the `page.evaluate` calls.

/**
 * `root` holds the page `index.html`. The page defines `window[entry]`, which returns the samples
 * as plain data. `failuresOf` answers one message for each check the samples fail. Sets the exit
 * code to 1 when any check fails.
 *
 * @canonical A GPU gate script
 */
export async function runGpuGate({ name, harness, root, entry, failuresOf }) {
  const { port } = previewPort(harness);
  const server = await createServer({
    root,
    logLevel: 'error',
    server: { port, strictPort: true, fs: { allow: [REPO_ROOT] } },
  });
  await server.listen();
  const browser = await launchShowcaseBrowser();
  let failures;
  try {
    const page = await browser.newPage();
    page.on('pageerror', (error) => console.error(`[${name}] page error: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') console.error(`[${name}] console error: ${message.text()}`);
    });
    await page.goto(`http://localhost:${port}/index.html`);
    await page.waitForFunction((fn) => typeof window[fn] === 'function', entry);
    failures = failuresOf(await page.evaluate((fn) => window[fn](), entry));
  } finally {
    await browser.close();
    await server.close();
  }

  for (const failure of failures) console.error(`[${name}] ${failure}`);
  console.log(
    `[${name}] ${failures.length === 0 ? 'all checks pass' : `${failures.length} check(s) failed`}`
  );
  process.exitCode = failures.length === 0 ? 0 : 1;
}
