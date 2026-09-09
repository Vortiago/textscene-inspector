/**
 * The browser context a capture runs in: the app's own chrome turned off
 * through the very preferences the shell reads, rather than cropped out after
 * the fact.
 */

/* global document, window */ // the addInitScript callbacks run in the browser.

import {
  CANVAS_2D_CAPTURE,
  CANVAS_2D_TESTIDS,
  FIT_ON_OPEN_2D_STORAGE_KEY,
  FRAME_ON_OPEN_STORAGE_KEY,
  SOURCE_PANE_STORAGE_KEY,
  VIEWPORT,
  VIEWPORT_MODE_STORAGE_KEY,
} from './appContract.mjs';

/**
 * A browser context scoped to rendering only the scene: source pane closed,
 * viewport toolbar painted out (it floats over the canvas, and
 * `canvas.screenshot()` composites any DOM over the canvas box), and
 * frame-on-open set explicitly rather than inherited from a default a future
 * change could flip.
 *
 * `canvas2D` prepares the 2D stage the same way for the 2D comparison frame:
 * its chrome (grid, viewport outline and dimension label, origin axes, the
 * zoom HUD) painted out, its background flattened to what
 * Godot clears a 2D viewport to, and its opening view pinned to zoom 1 at the
 * origin instead of "Fit" — so the frame is the game frame at 1:1 and sits at
 * the same integer pixels every run. It is OPT-IN because the golden gate
 * captures 2D scenes WITH that chrome; turning any of it on unconditionally
 * would move those baselines.
 */
export async function createCaptureContext(browser, { frameOnOpen, canvas2D = false }) {
  const context = await browser.newContext({
    viewport: canvas2D ? CANVAS_2D_CAPTURE.viewport : VIEWPORT,
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
  if (canvas2D) {
    await context.addInitScript(
      ([key, value]) => window.localStorage.setItem(key, value),
      [FIT_ON_OPEN_2D_STORAGE_KEY, 'false']
    );
    // Seeds the preference the shell reads once at mount. A scene whose root
    // DOES claim a workspace still wins here (WorkspaceAutoSelect applies its
    // claim after), so a Node3D-rooted scene captured with --2d still reports
    // the mismatch rather than silently shooting the wrong frame.
    await context.addInitScript(
      ([key, value]) => window.localStorage.setItem(key, value),
      [VIEWPORT_MODE_STORAGE_KEY, JSON.stringify('2D')]
    );
  }
  // Viewport chrome that floats over the canvas in BOTH modes, and so would
  // composite into every capture the way the toolbar overlay does.
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
  // The <style> must land in <head> once it exists — appending at
  // document-start puts it in an invalid position the parser drops.
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
