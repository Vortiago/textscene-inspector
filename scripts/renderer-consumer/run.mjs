#!/usr/bin/env node
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { preview } from 'vite';
import { launchSwiftShaderBrowser } from '../showcase/browser.mjs';
import { installedVersion, packTarball, run } from '../packTarball.mjs';
import { REPO_ROOT, attachDiagnostics, loggedErrors, previewPort } from '../visual/previewServer.mjs';
import { compareImages, formatDelta, isSameImage } from '../visual/imageDelta.mjs';
import { writeBaselineFile } from '../visual/run/baselines.mjs';
import { consumerManifest } from './consumerManifest.mjs';
import { heldResourceFailures } from './heldResourceFailures.mjs';
import { mountFailures } from './mountFailures.mjs';
import { runPickChecks } from './pickChecks.mjs';
import { pickFailures } from './pickFailures.mjs';
import { RENDER_TIMEOUT_MS, pollInk } from './pollInk.mjs';
import { runSwitchChecks } from './switchChecks.mjs';
import { switchFailures } from './switchFailures.mjs';

/* global document, getComputedStyle, window */
// These exist only in the browser that runs the `page.evaluate` calls.

const APP_DIR = join(import.meta.dirname, 'app');
/** The PNG `captureImage` gives for the consumer scene. `--update` writes it again. */
const BASELINE_PATH = join(import.meta.dirname, 'baselines', 'consumer-scene.png');
const isUpdatingBaseline = process.argv.includes('--update');

/** The drawn pixels that prove a view drew the cube: a blank canvas scores 0. */
const INK_FLOOR = 2000;
/** The red rectangle draws about 26,000 pixels, and the stage with no content about 1,000. */
const INK_FLOOR_2D = 10_000;
/** A cube at half scale draws about a quarter of the pixels, so its view proves less. */
const WRITTEN_INK_FLOOR = INK_FLOOR / 4;
/** The mount checks draw eight views one after another, and capture three of them at 1152 x 648. */
const MOUNT_CHECKS_TIMEOUT_MS = 4 * RENDER_TIMEOUT_MS;
/** The checks of a resource the scene file holds draw four views, each a short 320 x 240 window. */
const HELD_CHECKS_TIMEOUT_MS = 2 * RENDER_TIMEOUT_MS;

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
  '3D': { query: '', inkFloor: INK_FLOOR },
  'In-game': { query: '?mode=in-game', inkFloor: INK_FLOOR },
  'In-game after a write': { query: '?mode=in-game&write=scale', inkFloor: WRITTEN_INK_FLOOR },
  'In-game after a call': { query: '?mode=in-game&call=close', inkFloor: INK_FLOOR },
  '2D': { query: '?mode=2D', inkFloor: INK_FLOOR_2D },
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
    for (const [view, { query, inkFloor }] of Object.entries(VIEWS)) {
      const page = await browser.newPage();
      drawn[view] = await renderView(page, `http://localhost:${port}/${query}`, inkFloor);
    }
    const mounted = await runPageChecks(
      await browser.newPage(),
      `http://localhost:${port}/?checks=mount`,
      'mountChecks',
      MOUNT_CHECKS_TIMEOUT_MS
    );
    const held = await runPageChecks(
      await browser.newPage(),
      `http://localhost:${port}/?checks=held`,
      'heldResourceChecks',
      HELD_CHECKS_TIMEOUT_MS
    );
    const switched = await runSwitchChecks(
      await browser.newPage(),
      `http://localhost:${port}/?checks=switch`
    );
    const picked = await runPickChecks(await browser.newPage(), `http://localhost:${port}/?checks=pick`);
    return { drawn, mounted, held, switched, picked };
  } finally {
    await browser.close();
    await server.close();
  }
}

async function renderView(page, url, inkFloor) {
  const diagnostics = attachDiagnostics(page);
  await page.goto(url);
  const ink = await pollInk(page, (drawn) => drawn >= inkFloor);
  const hasCanvasStyles = await page.evaluate(() => {
    for (let node = document.querySelector('canvas'); node; node = node.parentElement) {
      if (getComputedStyle(node).touchAction === 'none') return true;
    }
    return false;
  });
  return { ink, hasCanvasStyles, errors: loggedErrors(diagnostics) };
}

/** The results the page writes to `window[key]`, and what the page threw on the way. */
async function runPageChecks(page, url, key, timeout) {
  const diagnostics = attachDiagnostics(page);
  await page.goto(url);
  const handle = await page.waitForFunction((name) => window[name], key, { timeout });
  return { results: await handle.jsonValue(), errors: loggedErrors(diagnostics) };
}

/** The consumer scene's PNG matches its baseline, or `--update` writes the baseline from it. */
function baselineFailures(png) {
  if (isUpdatingBaseline) {
    const { status, detail } = writeBaselineFile(BASELINE_PATH, png);
    console.log(`[renderer-consumer] baseline ${status}: ${detail}`);
    return status === 'refused' ? [`captureImage: ${detail}`] : [];
  }
  if (!existsSync(BASELINE_PATH))
    return [`expected a baseline at ${BASELINE_PATH}, got none: run with --update`];
  const delta = compareImages(readFileSync(BASELINE_PATH), png);
  if (isSameImage(delta)) return [];
  return [`captureImage: expected the baseline, got ${formatDelta(delta)}`];
}

/** One line per failed check of a view, or none when it rendered the fixture. */
function failuresOf(view, { ink, hasCanvasStyles, errors }) {
  const { inkFloor } = VIEWS[view];
  return [
    ...(ink < inkFloor ? [`expected at least ${inkFloor} drawn pixels in the viewport, got ${ink}`] : []),
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

/** The nearer camera draws the cube at about 2.4 times the area, so its ink passes 1.5 times the whole. */
const CALLED_INK_SHARE = 1.5;

/** A line when the host's `make_current` did not move the view to the nearer camera, or none. */
function callFailures(drawn) {
  const whole = drawn['In-game'].ink;
  const called = drawn['In-game after a call'].ink;
  if (called > whole * CALLED_INK_SHARE) return [];
  return [`In-game after a call: expected over ${whole * CALLED_INK_SHARE} drawn pixels, got ${called}`];
}

/** One line per failed check of every view and of `mountScene`. */
function failures({ drawn, mounted, held, switched, picked }) {
  return [
    ...Object.entries(drawn).flatMap(([view, result]) => failuresOf(view, result)),
    ...writeFailures(drawn),
    ...callFailures(drawn),
    ...mountFailures(mounted.results),
    ...mounted.errors.map((message) => `mountScene: page error: ${message}`),
    ...baselineFailures(Buffer.from(mounted.results.smallElementPng, 'base64')),
    ...heldResourceFailures(held.results),
    ...held.errors.map((message) => `held resource: page error: ${message}`),
    ...switchFailures(switched),
    ...pickFailures(picked),
  ];
}

const work = mkdtempSync(join(tmpdir(), 'renderer-consumer-'));
try {
  const tarballs = packRenderer(mkdtempSync(join(work, 'tarballs-')));
  const app = join(work, 'app');
  writeConsumer(app, tarballs);
  buildConsumer(app);
  const results = await renderInBrowser(app);
  const captureDeltas = Object.entries(results.switched.results.capturedVsShown)
    .map(([mode, delta]) => `${mode} ${delta.changedPixels ?? 'size mismatch'}`)
    .join(', ');
  console.log(`[renderer-consumer] captureImage against the view, changed pixels: ${captureDeltas}`);
  const { onCube, onNothing, hostSelected, onNothingHostOwned } = results.picked.results;
  console.log(
    `[renderer-consumer] outline pixels: after a click on the cube ${onCube.outline}, on nothing ` +
      `${onNothing.outline}, the host's cube ${hostSelected}, then a click on nothing ${onNothingHostOwned.outline}`
  );
  const found = failures(results);
  for (const failure of found) console.error(`[renderer-consumer] ${failure}`);
  console.log(
    `[renderer-consumer] ${found.length === 0 ? 'the fixture scene rendered in every view' : 'failed'}`
  );
  process.exitCode = found.length === 0 ? 0 : 1;
} finally {
  rmSync(work, { recursive: true, force: true });
}
