/**
 * The browser context a capture runs in, with the app's chrome turned off through the preferences
 * the shell reads instead of cropped out afterwards.
 */

/* global document, window */ // The addInitScript callbacks run in the browser.

import {
  canvas2DViewportFor,
  CANVAS_2D_TESTIDS,
  FIT_ON_OPEN_2D_STORAGE_KEY,
  FRAME_ON_OPEN_STORAGE_KEY,
  PERFORMANCE_TESTIDS,
  SHOW_GIZMOS_STORAGE_KEY,
  SHOW_PERFORMANCE_STORAGE_KEY,
  SOURCE_PANE_STORAGE_KEY,
  VIEWPORT,
  VIEWPORT_MODE_STORAGE_KEY,
  windowForCanvas,
} from './appContract.mjs';
import { installTimingLog, printTimingLines } from './glTiming.mjs';

/**
 * A context that renders only the scene: the source pane closed and the floating chrome painted out.
 * @param {import('playwright').Browser} browser
 * @param {object} options
 * @param {boolean} options.frameOnOpen set explicitly, never left to the app's default
 * @param {boolean} [options.canvas2D] open the 2D workspace
 * @param {{ width: number, height: number } | null} [options.canvas2DFrame] the project-viewport rect,
 *   which widens the window only when it does not fit the default one
 * @param {{ width: number, height: number }} [options.viewport] the 3D window, which a 2D context ignores
 * @param {boolean} [options.showPerformance] turn the frame profile on, its overlay painted out too
 * @param {boolean} [options.showGizmos] turn the editor gizmos on: off by default, as in Godot's running game
 * @param {{ width: number, height: number } | null} [options.inGameFrame] the game window: the context
 *   opens the In-game mode with a canvas of that size
 */
export async function createCaptureContext(
  browser,
  {
    frameOnOpen,
    canvas2D = false,
    canvas2DFrame = null,
    viewport = VIEWPORT,
    showPerformance = false,
    showGizmos = false,
    inGameFrame = null,
  }
) {
  const context = await browser.newContext({
    viewport: contextViewport({ canvas2D, canvas2DFrame, inGameFrame, viewport }),
    deviceScaleFactor: 1,
  });
  await context.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [SOURCE_PANE_STORAGE_KEY, JSON.stringify({ visible: false, width: 320 })]
  );
  await context.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [FRAME_ON_OPEN_STORAGE_KEY, frameOnOpen ? 'true' : 'false']
  );
  await context.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [SHOW_GIZMOS_STORAGE_KEY, showGizmos ? 'true' : 'false']
  );
  if (showPerformance) {
    await context.addInitScript(
      ([key, value]) => window.localStorage.setItem(key, value),
      [SHOW_PERFORMANCE_STORAGE_KEY, 'true']
    );
  }
  // `canvas2D` paints out the 2D stage's chrome, flattens its background to Godot's 2D clear
  // colour and opens it at zoom 1 on the origin, so the frame sits on the same integer pixels each
  // run. It is opt-in: the golden gate captures 2D scenes with the chrome.
  if (canvas2D) {
    await context.addInitScript(
      ([key, value]) => window.localStorage.setItem(key, value),
      [FIT_ON_OPEN_2D_STORAGE_KEY, 'false']
    );
    // Seeds the preference the shell reads once at mount. WorkspaceAutoSelect applies a root's
    // claim after it, so a Node3D-rooted scene captured with --2d still reports the mismatch.
    await context.addInitScript(
      ([key, value]) => window.localStorage.setItem(key, value),
      [VIEWPORT_MODE_STORAGE_KEY, JSON.stringify('2D')]
    );
  }
  if (inGameFrame) {
    await context.addInitScript(
      ([key, value]) => window.localStorage.setItem(key, value),
      [VIEWPORT_MODE_STORAGE_KEY, JSON.stringify('in-game')]
    );
  }
  await context.addInitScript(installStyle, paintedOutChromeCss({ canvas2D }));
  await context.addInitScript(installTimingLog);
  context.on?.('page', printTimingLines);
  return context;
}

/** The window of a context: the 2D frame's, the game window's, or the 3D window. */
function contextViewport({ canvas2D, canvas2DFrame, inGameFrame, viewport }) {
  if (canvas2D) return canvas2DViewportFor(canvas2DFrame);
  if (inGameFrame) return windowForCanvas(inGameFrame);
  return viewport;
}

/** The "switch to 2D" hint carries no testid, so a capture finds it by its title. */
const SWITCH_TO_2D_HINT = 'button[title*="switch to the 2D view"]';

/** A capture holds the DOM over the canvas, so this hides the chrome, and the 2D stage's for `canvas2D`. */
export function paintedOutChromeCss({ canvas2D }) {
  const hidden = [
    'viewport-toolbar-overlay',
    'viewport-controls-help',
    'freelook-speed-readout',
    'game-start-notes',
    PERFORMANCE_TESTIDS.overlay,
  ];
  if (canvas2D) {
    hidden.push(
      CANVAS_2D_TESTIDS.frame,
      CANVAS_2D_TESTIDS.zoom,
      CANVAS_2D_TESTIDS.originAxisX,
      CANVAS_2D_TESTIDS.originAxisY
    );
  }
  const selectors = [...hidden.map((id) => `[data-testid="${id}"]`), SWITCH_TO_2D_HINT];
  return `${selectors.join(',')}{display:none !important}`;
}

/**
 * An init script that adds `rules` as a <style>. It goes in <head> once that exists: at
 * document-start the parser drops it.
 */
export function installStyle(rules) {
  const add = () => {
    const style = document.createElement('style');
    style.textContent = rules;
    document.head.appendChild(style);
  };
  if (document.head) add();
  else document.addEventListener('DOMContentLoaded', add, { once: true });
}

/**
 * A throwaway WebGL context, torn down before any real capture. The first WebGL context in a fresh
 * headless Chromium and SwiftShader process can be lost under load, and two captures of a dead
 * canvas are as byte-identical as a settled frame. This page takes that risk instead of a scene.
 */
export async function warmUpGLContext(browser) {
  const context = await browser.newContext({ viewport: { width: 64, height: 64 } });
  try {
    const page = await context.newPage();
    await page.setContent(
      '<canvas id="warmup" width="64" height="64"></canvas><script>' +
        'const gl = document.getElementById("warmup").getContext("webgl2") || ' +
        'document.getElementById("warmup").getContext("webgl"); ' +
        'if (gl) { for (let i = 0; i < 60; i++) { ' +
        'gl.clearColor(Math.random(), Math.random(), Math.random(), 1); ' +
        'gl.clear(gl.COLOR_BUFFER_BIT); gl.finish(); } }' +
        '</script>'
    );
    await page.waitForTimeout(500);
  } finally {
    await context.close();
  }
}
