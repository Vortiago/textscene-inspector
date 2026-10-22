#!/usr/bin/env node
/**
 * `pnpm test:renderer-consumer`: installs the packed `@textscene/renderer` and `@textscene/tscn`
 * into a plain Vite React app with its own React and three.js, type-checks and builds the app,
 * and renders a fixture scene in headless Chromium. The app sets no `@textscene/source`
 * condition and no CSS-module support, so a bundle that needs either fails here.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire, findPackageJSON } from 'node:module';
import { preview } from 'vite';
import { launchSwiftShaderBrowser } from '../showcase/browser.mjs';
import { REPO_ROOT, previewPort } from '../visual/previewServer.mjs';
import { inkStats } from '../vscode/pixels.mjs';
import { consumerManifest } from './consumerManifest.mjs';

/* global document, getComputedStyle */
// These exist only in the browser that runs the `page.evaluate` calls.

const APP_DIR = join(import.meta.dirname, 'app');

/** The fixture's cube fills about a fifth of its 320 x 240 viewport. A blank canvas scores 0. */
const INK_FLOOR = 2000;
/** Software GL draws the first frame slowly. */
const RENDER_TIMEOUT_MS = 90_000;

const run = (command, args, cwd) => execFileSync(command, args, { cwd, encoding: 'utf8', stdio: 'pipe' });

/** The version of `name` that the workspace package at `base` tests against. */
function installedVersion(name, base) {
  const manifest = createRequire(import.meta.url)(
    findPackageJSON(name, join(REPO_ROOT, base, 'package.json'))
  );
  return manifest.version;
}

const versionsOf = (names, base) =>
  Object.fromEntries(names.map((name) => [name, installedVersion(name, base)]));

function packTarball(packageDir, destination) {
  run('pnpm', ['--filter', `./${packageDir}`, 'build'], REPO_ROOT);
  run('pnpm', ['pack', '--pack-destination', destination], join(REPO_ROOT, packageDir));
}

/** The tarballs of both packages, by package name. The directory holds only these two. */
function packBoth(destination) {
  packTarball('apps/textscene-tscn', destination);
  packTarball('apps/textscene-renderer', destination);
  const files = readdirSync(destination);
  const pathOf = (prefix) =>
    join(
      destination,
      files.find((file) => file.startsWith(prefix))
    );
  return {
    '@textscene/tscn': pathOf('textscene-tscn-'),
    '@textscene/renderer': pathOf('textscene-renderer-'),
  };
}

/**
 * A user's install takes the newest version inside each peer range, so the app does the same. A
 * release outside what the renderer supports fails here, as it fails for a user.
 */
function writeConsumer(directory, tarballs) {
  cpSync(APP_DIR, directory, { recursive: true });
  const { peerDependencies } = JSON.parse(
    run('tar', ['-xzOf', tarballs['@textscene/renderer'], 'package/package.json'], directory)
  );
  const manifest = consumerManifest({
    tarballs,
    peers: peerDependencies,
    tools: {
      ...versionsOf(['@types/react', '@types/react-dom', '@types/three'], 'packages/textscene-core'),
      ...versionsOf(['vite', '@vitejs/plugin-react', 'typescript'], 'apps/textscene-web'),
    },
  });
  writeFileSync(join(directory, 'package.json'), JSON.stringify(manifest, null, 2));
}

/** Installs, type-checks and builds the app as a user does, then returns where its build is. */
function buildConsumer(directory) {
  run('npm', ['install', '--no-audit', '--no-fund'], directory);
  run('node', ['node_modules/typescript/bin/tsc', '-p', '.'], directory);
  run('node', ['node_modules/vite/bin/vite.js', 'build'], directory);
  return directory;
}

/** What the page drew in the viewport, and what it threw. Polls, since software GL is slow. */
async function renderInBrowser(directory) {
  const { port } = previewPort('rendererConsumer');
  const server = await preview({
    root: directory,
    configFile: false,
    logLevel: 'error',
    preview: { port, strictPort: true },
  });
  const browser = await launchSwiftShaderBrowser();
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => message.type() === 'error' && errors.push(message.text()));
    await page.goto(`http://localhost:${port}/`);
    const ink = await pollInk(page);
    const hasCanvasStyles = await page.evaluate(() => {
      for (let node = document.querySelector('canvas'); node; node = node.parentElement) {
        if (getComputedStyle(node).touchAction === 'none') return true;
      }
      return false;
    });
    return { ink, hasCanvasStyles, errors };
  } finally {
    await browser.close();
    await server.close();
  }
}

async function pollInk(page) {
  const viewport = page.locator('#viewport');
  const deadline = Date.now() + RENDER_TIMEOUT_MS;
  let ink = 0;
  while (ink < INK_FLOOR && Date.now() < deadline) {
    await page.waitForTimeout(1000);
    ink = inkStats(await viewport.screenshot()).ink;
  }
  return ink;
}

/** One line per failed check, or none when the consumer rendered the fixture. */
function failures({ ink, hasCanvasStyles, errors }) {
  return [
    ...(ink < INK_FLOOR ? [`expected at least ${INK_FLOOR} drawn pixels in the viewport, got ${ink}`] : []),
    ...(hasCanvasStyles
      ? []
      : ['expected the canvas root to carry the bundle’s touch-action style, got none']),
    ...errors.map((message) => `page error: ${message}`),
  ];
}

const work = mkdtempSync(join(tmpdir(), 'renderer-consumer-'));
try {
  const tarballs = packBoth(mkdtempSync(join(work, 'tarballs-')));
  const app = join(work, 'app');
  writeConsumer(app, tarballs);
  const found = failures(await renderInBrowser(buildConsumer(app)));
  for (const failure of found) console.error(`[renderer-consumer] ${failure}`);
  console.log(`[renderer-consumer] ${found.length === 0 ? 'the fixture scene rendered' : 'failed'}`);
  process.exitCode = found.length === 0 ? 0 : 1;
} finally {
  rmSync(work, { recursive: true, force: true });
}
