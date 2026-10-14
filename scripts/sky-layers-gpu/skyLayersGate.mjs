#!/usr/bin/env node
/**
 * `pnpm test:gpu`: bakes the sky's layers with the real passes in headless Chromium and checks
 * what they wrote. Unit tests run under happy-dom, which runs no shader.
 */
import { createServer } from 'vite';
import { launchShowcaseBrowser } from '../showcase/browser.mjs';
import { REPO_ROOT } from '../visual/preview/paths.mjs';
import { skyLayerFailures } from './skyLayerChecks.mjs';

/* global window */
// `window` exists only in the browser that runs the `page.evaluate` calls.

const PORT = Number(process.env.GPU_GATE_PORT) || 4323;

const server = await createServer({
  root: import.meta.dirname,
  logLevel: 'error',
  server: { port: PORT, strictPort: true, fs: { allow: [REPO_ROOT] } },
});
await server.listen();
const browser = await launchShowcaseBrowser();
let failures;
try {
  const page = await browser.newPage();
  page.on('pageerror', (error) => console.error(`[sky-layers-gpu] page error: ${error.message}`));
  await page.goto(`http://localhost:${PORT}/index.html`);
  await page.waitForFunction(() => typeof window.skyLayerSamples === 'function');
  failures = skyLayerFailures(await page.evaluate(() => window.skyLayerSamples()));
} finally {
  await browser.close();
  await server.close();
}

for (const failure of failures) console.error(`[sky-layers-gpu] ${failure}`);
console.log(
  `[sky-layers-gpu] ${failures.length === 0 ? 'all checks pass' : `${failures.length} check(s) failed`}`
);
process.exitCode = failures.length === 0 ? 0 : 1;
