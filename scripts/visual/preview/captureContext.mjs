/**
 * The browser context a capture runs in, with the app's chrome turned off through the preferences
 * the shell reads instead of cropped out afterwards.
 */

/* global document, window */ // The addInitScript callbacks run in the browser.

import {
  canvas2DViewportFor,
  CANVAS_2D_CAPTURE,
  CANVAS_2D_TESTIDS,
  FIT_ON_OPEN_2D_STORAGE_KEY,
  FRAME_ON_OPEN_STORAGE_KEY,
  SOURCE_PANE_STORAGE_KEY,
  VIEWPORT,
  VIEWPORT_MODE_STORAGE_KEY,
} from './appContract.mjs';

/**
 * A browser context that renders only the scene: the source pane closed, the floating toolbar
 * painted out (`canvas.screenshot()` composites any DOM over the canvas), and frame-on-open set
 * explicitly. `canvas2DFrame` is the project-viewport rect, which widens the window only when it
 * does not fit the default one.
 */
export async function createCaptureContext(
  browser,
  { frameOnOpen, canvas2D = false, canvas2DFrame = null }
) {
  const context = await browser.newContext({
    viewport: canvas2D ? canvas2DViewportFor(canvas2DFrame) : VIEWPORT,
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
  // Viewport chrome that floats over the canvas in both modes, and so would composite into every
  // capture.
  const hidden = ['viewport-toolbar-overlay', 'viewport-controls-help'];
  let css = '';
  if (canvas2D) {
    hidden.push(
      CANVAS_2D_TESTIDS.frame,
      CANVAS_2D_TESTIDS.zoom,
      CANVAS_2D_TESTIDS.originAxisX,
      CANVAS_2D_TESTIDS.originAxisY
    );
    css +=
      `[data-testid="${CANVAS_2D_TESTIDS.stage}"]{background-image:none !important;` +
      `background-color:${CANVAS_2D_CAPTURE.background} !important}`;
  }
  css += `${hidden.map((id) => `[data-testid="${id}"]`).join(',')}{display:none !important}`;
  // The <style> goes in <head> once it exists: at document-start the parser drops it.
  await context.addInitScript((rules) => {
    const add = () => {
      const style = document.createElement('style');
      style.textContent = rules;
      document.head.appendChild(style);
    };
    if (document.head) add();
    else document.addEventListener('DOMContentLoaded', add, { once: true });
  }, css);
  return context;
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
