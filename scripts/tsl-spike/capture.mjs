#!/usr/bin/env node
/**
 * One capture of the spike: a fixture drawn by the renderer path `--renderer` names, compared with
 * a golden's baseline as the visual gate compares it.
 *   node scripts/tsl-spike/capture.mjs unit-directional-light-3d.tscn --renderer handler \
 *     --golden directional-light-3d --out /tmp/handler.png
 * `--browser lavapipe` captures as `pnpm ref:ours` does, for a comparison with Godot.
 * `--2d` captures the 2D comparison frame. `--no-frame` keeps the editor orbit.
 * `--shaders <dir>` writes every GLSL source the page compiles, in compile order.
 */

/* global window, WebGL2RenderingContext */ // The shader recorder runs in the browser.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';
import { baselinePath } from '../visual/baselinePath.mjs';
import { compareImages, formatDelta } from '../visual/imageDelta.mjs';
import {
  createCaptureContext,
  findCaptureTarget,
  gotoFixture,
  previewPort,
  REPO_ROOT,
  settleCanvas,
  withPreviewBrowser,
} from '../visual/previewServer.mjs';
import { launchSpikeBrowser } from './browsers.mjs';

function parseArgs(argv) {
  const args = {
    fixture: null,
    renderer: 'classic',
    golden: null,
    against: null,
    out: null,
    diff: null,
    shaders: null,
    browser: 'swiftshader',
    canvas2D: false,
    frameOnOpen: true,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--renderer') args.renderer = argv[++i];
    else if (arg === '--golden') args.golden = argv[++i];
    else if (arg === '--against') args.against = argv[++i];
    else if (arg === '--out') args.out = argv[++i];
    else if (arg === '--diff') args.diff = argv[++i];
    else if (arg === '--shaders') args.shaders = argv[++i];
    else if (arg === '--browser') args.browser = argv[++i];
    else if (arg === '--2d') args.canvas2D = true;
    else if (arg === '--no-frame') args.frameOnOpen = false;
    else if (arg.startsWith('--')) throw new Error(`unknown flag ${arg}`);
    else args.fixture = arg;
  }
  if (!args.fixture) throw new Error('a fixture filename is required');
  return args;
}

/** Keeps each source a WebGL 2 context compiles in `window.__compiledShaders`. */
function recordShaderSources() {
  window.__compiledShaders = [];
  const shaderSource = WebGL2RenderingContext.prototype.shaderSource;
  WebGL2RenderingContext.prototype.shaderSource = function (shader, source) {
    window.__compiledShaders.push(source);
    return shaderSource.call(this, shader, source);
  };
}

function writeShaders(directory, sources) {
  mkdirSync(resolve(directory), { recursive: true });
  sources.forEach((source, index) => {
    writeFileSync(resolve(directory, `${String(index).padStart(3, '0')}.glsl`), source);
  });
}

/** Captures `fixture` on one renderer path. Answers the PNG, what the page logged and its GLSL. */
export function captureSpike({ fixture, renderer, browser, canvas2D, frameOnOpen }) {
  return withPreviewBrowser(
    { ...previewPort('parity'), launchBrowser: () => launchSpikeBrowser(browser) },
    async (launched, baseUrl) => {
      const context = await createCaptureContext(launched, {
        frameOnOpen: canvas2D ? false : frameOnOpen,
        canvas2D,
      });
      const page = await context.newPage();
      await page.addInitScript(recordShaderSources);
      const logged = [];
      page.on('console', (message) => {
        if (message.type() === 'error' || message.type() === 'warning') logged.push(message.text());
      });
      page.on('pageerror', (error) => logged.push(`pageerror: ${error.message}`));
      await gotoFixture(page, baseUrl, fixture, () => {}, { renderer });
      const { target, reason: targetReason } = await findCaptureTarget(page, { canvas2D });
      if (!target) throw new Error(`${targetReason}\n${logged.join('\n')}`);
      const { buffer, reason } = await settleCanvas(page, target);
      if (!buffer) throw new Error(`${reason}\n${logged.join('\n')}`);
      const shaders = await page.evaluate(() => window.__compiledShaders);
      return { buffer, logged, shaders };
    }
  );
}

function report(label, expected, actual, diffPath) {
  const delta = compareImages(expected, actual, { diff: diffPath !== null });
  console.log(`${label}: ${formatDelta(delta)}`);
  if (diffPath && delta.diff) writeFileSync(resolve(diffPath), PNG.sync.write(delta.diff));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { buffer, logged, shaders } = await captureSpike(args);
  if (args.shaders) writeShaders(args.shaders, shaders);
  if (args.out) writeFileSync(resolve(args.out), buffer);
  for (const line of new Set(logged)) console.log(`[page] ${line.slice(0, 2000)}`);
  if (args.golden) {
    const baseline = readFileSync(resolve(REPO_ROOT, baselinePath(args.golden)));
    report(`${args.renderer} against golden ${args.golden}`, baseline, buffer, args.diff);
  }
  if (args.against) {
    report(
      `${args.renderer} against ${args.against}`,
      readFileSync(resolve(args.against)),
      buffer,
      args.diff
    );
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
