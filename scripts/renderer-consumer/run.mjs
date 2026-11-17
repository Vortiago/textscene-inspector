#!/usr/bin/env node
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { preview } from 'vite';
import { launchSwiftShaderBrowser } from '../showcase/browser.mjs';
import { installedVersion, packTarball, run } from '../packTarball.mjs';
import { REPO_ROOT, attachDiagnostics, loggedErrors, previewPort } from '../visual/previewServer.mjs';
import { inkStats } from '../vscode/pixels.mjs';
import { consumerManifest } from './consumerManifest.mjs';

/* global document, getComputedStyle */
// These exist only in the browser that runs the `page.evaluate` calls.

const APP_DIR = join(import.meta.dirname, 'app');

/** The cube fills about a fifth of the 320 x 240 viewport, a twentieth at half scale, and a blank 0. */
const INK_FLOOR = 2000;
/** Software GL draws the first frame slowly. */
const RENDER_TIMEOUT_MS = 90_000;
const POLL_INTERVAL_MS = 500;

const versionsOf = (names, base) =>
  Object.fromEntries(names.map((name) => [name, installedVersion(name, base)]));

/** The tarballs to install, by package name. */
function packRenderer(destination) {
  run('pnpm', ['--filter', './apps/textscene-renderer', 'build'], REPO_ROOT);
  return { '@textscene/renderer': packTarball(join(REPO_ROOT, 'apps/textscene-renderer'), destination) };
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
      ...versionsOf(['vite', '@vitejs/plugin-react'], 'apps/textscene-web'),
      typescript: installedVersion('@typescript/native', 'apps/textscene-web'),
    },
  });
  writeFileSync(join(directory, 'package.json'), JSON.stringify(manifest, null, 2));
}

/** Installs, type-checks and builds the app as a user does. */
function buildConsumer(directory) {
  run('npm', ['install', '--no-audit', '--no-fund'], directory);
  run('node', ['node_modules/typescript/bin/tsc', '-p', '.'], directory);
  run('node', ['node_modules/vite/bin/vite.js', 'build'], directory);
}

/** The views the app draws, by the query that opens each. */
const VIEWS = {
  '3D': '',
  'In-game': '?mode=in-game',
  'In-game after a write': '?mode=in-game&write=scale',
};

/** A cube at half scale draws a quarter of its pixels, so its ink stays under half of the whole cube's. */
const WRITTEN_INK_SHARE = 0.5;

/** What each view drew and threw. It polls, since software GL is slow. */
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
    const drawn = {};
    for (const [view, query] of Object.entries(VIEWS)) {
      drawn[view] = await renderView(await browser.newPage(), `http://localhost:${port}/${query}`);
    }
    return drawn;
  } finally {
    await browser.close();
    await server.close();
  }
}

async function renderView(page, url) {
  const diagnostics = attachDiagnostics(page);
  await page.goto(url);
  const ink = await pollInk(page);
  const hasCanvasStyles = await page.evaluate(() => {
    for (let node = document.querySelector('canvas'); node; node = node.parentElement) {
      if (getComputedStyle(node).touchAction === 'none') return true;
    }
    return false;
  });
  return { ink, hasCanvasStyles, errors: loggedErrors(diagnostics) };
}

async function pollInk(page) {
  const viewport = page.locator('#viewport');
  const deadline = Date.now() + RENDER_TIMEOUT_MS;
  let ink = inkStats(await viewport.screenshot()).ink;
  while (ink < INK_FLOOR && Date.now() < deadline) {
    await page.waitForTimeout(POLL_INTERVAL_MS);
    ink = inkStats(await viewport.screenshot()).ink;
  }
  return ink;
}

/** One line per failed check of a view, or none when it rendered the fixture. */
function failuresOf(view, { ink, hasCanvasStyles, errors }) {
  return [
    ...(ink < INK_FLOOR ? [`expected at least ${INK_FLOOR} drawn pixels in the viewport, got ${ink}`] : []),
    ...(hasCanvasStyles
      ? []
      : ['expected the canvas root to carry the bundle’s touch-action style, got none']),
    ...errors.map((message) => `page error: ${message}`),
  ].map((failure) => `${view}: ${failure}`);
}

/** A line when the host's write did not change the drawn frame as it should, or none. */
function writeFailures(drawn) {
  const whole = drawn['In-game'].ink;
  const written = drawn['In-game after a write'].ink;
  if (written < whole * WRITTEN_INK_SHARE) return [];
  return [`In-game after a write: expected under ${whole * WRITTEN_INK_SHARE} drawn pixels, got ${written}`];
}

/** One line per failed check of every view. */
function failures(drawn) {
  return [
    ...Object.entries(drawn).flatMap(([view, result]) => failuresOf(view, result)),
    ...writeFailures(drawn),
  ];
}

const work = mkdtempSync(join(tmpdir(), 'renderer-consumer-'));
try {
  const tarballs = packRenderer(mkdtempSync(join(work, 'tarballs-')));
  const app = join(work, 'app');
  writeConsumer(app, tarballs);
  buildConsumer(app);
  const found = failures(await renderInBrowser(app));
  for (const failure of found) console.error(`[renderer-consumer] ${failure}`);
  console.log(
    `[renderer-consumer] ${found.length === 0 ? 'the fixture scene rendered in every view' : 'failed'}`
  );
  process.exitCode = found.length === 0 ? 0 : 1;
} finally {
  rmSync(work, { recursive: true, force: true });
}
