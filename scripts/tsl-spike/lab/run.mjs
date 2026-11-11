#!/usr/bin/env node
/**
 * Runs one lab experiment in a spike browser and prints what it found:
 *   node scripts/tsl-spike/lab/run.mjs shadow-depth [--browser webgpu-swiftshader] [--out shot.png]
 * The lab is a page of plain three, with none of the previewer, for a question about three alone.
 */

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import { launchSpikeBrowser } from '../browsers.mjs';

const CORE_MODULES = resolve(import.meta.dirname, '../../../packages/textscene-core/node_modules');
const CORE_PACKAGES = ['react', 'react-dom', '@react-three/fiber'];

/** A lab page reports within this, or the run fails. Software WebGPU compiles slowly. */
const RESULT_WAIT_MS = 120_000;

function parseArgs(argv) {
  const args = { experiment: null, browser: 'swiftshader', out: null, query: '' };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--browser') args.browser = argv[++i];
    else if (arg === '--out') args.out = argv[++i];
    else if (arg === '--query') args.query = argv[++i];
    else if (arg.startsWith('--')) throw new Error(`unknown flag ${arg}`);
    else args.experiment = arg;
  }
  if (!args.experiment) throw new Error('an experiment name is required');
  return args;
}

export async function runExperiment({ experiment, browser: browserName, out, query }) {
  const server = await createServer({
    root: import.meta.dirname,
    configFile: false,
    // The lab sits outside every package, so it borrows the core package's React and fiber.
    resolve: { alias: Object.fromEntries(CORE_PACKAGES.map((name) => [name, resolve(CORE_MODULES, name)])) },
    logLevel: 'error',
    server: { port: 0, host: '127.0.0.1' },
  });
  await server.listen();
  const { port } = server.httpServer.address();
  const browser = await launchSpikeBrowser(browserName);
  try {
    const page = await browser.newPage({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 1 });
    const logged = [];
    page.on('console', (message) => {
      if (message.type() !== 'log') logged.push(message.text().slice(0, 600));
    });
    await page.goto(`http://127.0.0.1:${port}/?experiment=${experiment}${query ? `&${query}` : ''}`);
    await page.waitForFunction(() => window.__labResult || window.__labError, null, {
      timeout: RESULT_WAIT_MS,
    });
    const { result, error } = await page.evaluate(() => ({
      result: window.__labResult,
      error: window.__labError,
    }));
    if (out) writeFileSync(resolve(out), await page.locator('#lab').screenshot());
    return { result, error, logged: [...new Set(logged)] };
  } finally {
    await browser.close();
    await server.close();
  }
}

/* global window */ // The page predicates run in the browser.

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  runExperiment(parseArgs(process.argv.slice(2))).then(
    (outcome) => {
      console.log(JSON.stringify(outcome, null, 2));
      process.exit(outcome.error ? 1 : 0);
    },
    (error) => {
      console.error(error.message);
      process.exit(1);
    }
  );
}
