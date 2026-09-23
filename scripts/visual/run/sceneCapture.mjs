/**
 * Drives one golden scene to its settled frame: navigate, apply the display toggle or selection
 * the scene declares, then hand off to the stabilisation gate. Each wait prevents a race that
 * gives a wrong baseline, and its comment names the race.
 */

import {
  findCaptureTarget,
  gotoFixture,
  setDisplayToggle,
  settleCanvas,
} from '../previewServer.mjs';

// Greater than CameraFit's last load-time fit timer (1100 ms after mount), with margin for
// render-loop latency under host contention.
const PRE_SELECT_FIT_QUIESCENCE_MS = 1500;

/**
 * Navigates to a scene and captures its target after two byte-identical screenshots. Returns the
 * PNG buffer, or null with a reason when the scene never settles or logs a console error.
 * `pages.default` holds the framed 3D view and `pages.canvas2D` the 2D parity frame, which exists
 * only when a scene sets `mode: '2d'` and which such a scene both navigates and screenshots.
 */
export async function captureScene(pages, baseUrl, scene) {
  const canvas2D = scene.mode === '2d';
  const pageState = canvas2D ? pages.canvas2D : pages.default;
  if (!pageState) {
    throw new Error(
      `scene "${scene.name}" needs the canvas2D capture context, which this run did not create`
    );
  }
  const { page, errors } = pageState;
  // Cleared here, so an error left from the previous scene on this page is not blamed on this one.
  errors.length = 0;

  // A silent stalled resource chain would become a baseline, so it is logged.
  await gotoFixture(page, baseUrl, scene.file, (ms) =>
    console.log(`[visual]   ${scene.name}: no network idle within ${ms}ms`)
  );
  const { target: canvas, reason: canvasReason } = await findCaptureTarget(page, { canvas2D });
  if (!canvas) return { buffer: null, reason: canvasReason };

  if (scene.navigation) {
    // The navmesh overlay defaults on, but is set explicitly, so the baseline rests on no default.
    const reason = await setDisplayToggle(page, 'Navigation', true);
    if (reason) return { buffer: null, reason };
    await page.waitForTimeout(PRE_SELECT_FIT_QUIESCENCE_MS);
    await page.mouse.move(0, 0);
  }

  if (scene.collisions) {
    // "Visible Collision Shapes" is off by default (ADR-0005/0006), so every other golden hides a
    // CollisionShape gizmo.
    const reason = await setDisplayToggle(page, 'Collisions', true);
    if (reason) return { buffer: null, reason };
    // Let CameraFit's load-time timers finish before changing what is on
    // screen, and take the pointer off the toolbar so no hover is captured.
    await page.waitForTimeout(PRE_SELECT_FIT_QUIESCENCE_MS);
    await page.mouse.move(0, 0);
  }

  // A real tree selection makes a selection-gated gizmo (Marker/Path/PathFollow, ADR-0018) render,
  // through the whole tree-click, SelectionContext, NodeDispatcher and useGizmoVisible path.
  if (scene.select) {
    // Expand the whole tree so nested nodes are reachable, then click the row.
    await page.locator('[aria-label="Expand all"]').click();
    const row = page.locator(`[data-node-path="${scene.select}"] [role="treeitem"]`).first();
    try {
      await row.waitFor({ timeout: 10000 });
    } catch {
      return { buffer: null, reason: `select target not found in tree: ${scene.select}` };
    }
    // After CameraFit's fit timers (150/500/1100 ms after mount) have all fired: a click before the
    // last one lets it see the new gizmo and widen the frame, and host load picks the winner. The
    // row renders from the state that starts those timers, so this wait from it spends them all.
    // Selection never moves the camera (CameraFit in packages/textscene-core/src/r3f/TscnCanvas.tsx).
    await page.waitForTimeout(PRE_SELECT_FIT_QUIESCENCE_MS);
    await row.click();
    // `.click()` hovers the row first and leaves its hover highlight on, so the pointer moves off
    // the tree and only the selection renders.
    await page.mouse.move(0, 0);
  }

  const result = await settleCanvas(page, canvas);
  if (!result.buffer) return result;
  if (errors.length > 0) {
    // A console error in a settled, plausible capture is still a broken render: pixels cannot see a
    // swallowed resource failure that leaves the previous frame on screen.
    return {
      buffer: null,
      reason: `console error(s) logged during capture: ${errors.join(' | ')}`,
      status: 'console-error',
    };
  }
  return result;
}

/**
 * The fail-on-console-error gate of every capture page: a scene that logs an error or throws is a
 * broken render, however plausible its pixels. Returns the mutable array `captureScene` checks and
 * clears per scene.
 */
export function attachConsoleGate(page) {
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(String(err)));
  return errors;
}
