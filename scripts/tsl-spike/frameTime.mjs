#!/usr/bin/env node
/**
 * Frame times of the previewer's 3D canvas on one renderer path: the main thread's time in a frame,
 * the time until the GPU has finished it, and the time from navigation to the first whole frame.
 *   node scripts/tsl-spike/frameTime.mjs unit-directional-light-3d.tscn --renderer handler [--boxes 400]
 * `--boxes` adds that many marker boxes to the scene the page receives. `--browser` picks the
 * launch: run it with `hardware` on a machine with a GPU, since the default is a software rasteriser.
 */

/* global window, document, WebGL2RenderingContext */ // The recorder runs in the browser.

import {
  createCaptureContext,
  findCaptureTarget,
  gotoFixture,
  previewPort,
  settleCanvas,
  withPreviewBrowser,
} from '../visual/previewServer.mjs';
import { launchSpikeBrowser } from './browsers.mjs';

const WARM_UP_FRAMES = 60;
const MEASURED_FRAMES = 600;
/** 660 frames of a software rasteriser at a tenth of a second each, with room. */
const FRAMES_WAIT_MS = 300_000;

function parseArgs(argv) {
  const args = { fixture: null, renderer: 'classic', boxes: 0, browser: 'webgpu-swiftshader' };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--renderer') args.renderer = argv[++i];
    else if (arg === '--boxes') args.boxes = Number(argv[++i]);
    else if (arg === '--browser') args.browser = argv[++i];
    else if (arg.startsWith('--')) throw new Error(`unknown flag ${arg}`);
    else args.fixture = arg;
  }
  if (!args.fixture) throw new Error('a fixture filename is required');
  return args;
}

/** The scene with `count` small boxes in a grid on the ground, each a draw of the marker's mesh. */
export function withMarkerBoxes(sceneText, count) {
  const side = Math.ceil(Math.sqrt(count));
  const boxes = Array.from({ length: count }, (_, index) => {
    const x = (((index % side) / side - 0.5) * 5).toFixed(3);
    const z = ((Math.floor(index / side) / side - 0.5) * 5).toFixed(3);
    return (
      `[node name="Box${index}" type="MeshInstance3D" parent="."]\n` +
      `transform = Transform3D(0.1, 0, 0, 0, 0.1, 0, 0, 0, 0.1, ${x}, -0.95, ${z})\n` +
      'mesh = SubResource("BoxMesh_marker")\n'
    );
  });
  return `${sceneText}\n${boxes.join('\n')}`;
}

/**
 * Times every animation frame and counts its draw calls. A read of one pixel after the frame's
 * callbacks waits for the GPU, which a WebGL context offers no promise for.
 */
function recordFrames() {
  const frames = [];
  let current = null;
  const onePixel = new Uint8Array(4);
  const countDraw = (name) => {
    const draw = WebGL2RenderingContext.prototype[name];
    WebGL2RenderingContext.prototype[name] = function (...args) {
      if (current) current.draws++;
      return draw.apply(this, args);
    };
  };
  ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced'].forEach(countDraw);
  const requestFrame = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (callback) =>
    requestFrame((time) => {
      if (current?.time !== time) {
        current = { time, startedAt: performance.now(), cpuMs: 0, finishedMs: 0, draws: 0 };
        frames.push(current);
      }
      const startedAt = performance.now();
      callback(time);
      current.cpuMs += performance.now() - startedAt;
      const gl = current.draws > 0 ? document.querySelector('canvas')?.getContext('webgl2') : null;
      if (gl) gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, onePixel);
      current.finishedMs += performance.now() - startedAt;
    });
  window.__spikeFrames = frames;
}

function percentile(sorted, share) {
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * share))];
}

function summary(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  return { median: percentile(sorted, 0.5), p95: percentile(sorted, 0.95) };
}

async function main() {
  const { fixture, renderer, boxes, browser: browserName } = parseArgs(process.argv.slice(2));
  const result = await withPreviewBrowser(
    { ...previewPort('perf'), launchBrowser: () => launchSpikeBrowser(browserName) },
    async (browser, baseUrl) => {
      const context = await createCaptureContext(browser, { frameOnOpen: true });
      const page = await context.newPage();
      await page.addInitScript(recordFrames);
      if (boxes > 0) {
        const url = `${baseUrl.replace(/\/$/, '')}/fixtures/${fixture}`;
        const sceneText = await (await page.request.get(url)).text();
        await page.route(url, (route) => route.fulfill({ body: withMarkerBoxes(sceneText, boxes) }));
      }
      await gotoFixture(page, baseUrl, fixture, () => {}, { renderer });
      const { target, reason } = await findCaptureTarget(page);
      if (!target) throw new Error(reason);
      const settled = await settleCanvas(page, target);
      if (!settled.buffer) throw new Error(settled.reason);
      const settledAt = await page.evaluate(() => window.__spikeFrames.length);
      await page.waitForFunction(
        (frameCount) => window.__spikeFrames.length >= frameCount,
        settledAt + WARM_UP_FRAMES + MEASURED_FRAMES,
        { timeout: FRAMES_WAIT_MS }
      );
      return page.evaluate(
        ([from, count]) => {
          const all = window.__spikeFrames;
          const measured = all.slice(from, from + count);
          const steadyDraws = measured[0].draws;
          const firstWhole = all.find((frame) => frame.draws >= steadyDraws);
          return {
            drawCalls: steadyDraws,
            firstWholeFrameMs: firstWhole.startedAt + firstWhole.finishedMs,
            cpuMs: measured.map((frame) => frame.cpuMs),
            finishedMs: measured.map((frame) => frame.finishedMs),
          };
        },
        [settledAt + WARM_UP_FRAMES, MEASURED_FRAMES]
      );
    }
  );
  console.log(
    JSON.stringify({
      fixture,
      renderer,
      boxes,
      browser: browserName,
      frames: MEASURED_FRAMES,
      drawCalls: result.drawCalls,
      firstWholeFrameMs: Math.round(result.firstWholeFrameMs),
      cpuMs: summary(result.cpuMs),
      untilGpuFinishedMs: summary(result.finishedMs),
    })
  );
  process.exit(0);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
