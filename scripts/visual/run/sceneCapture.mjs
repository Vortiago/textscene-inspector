/**
 * Drives one golden scene to its settled frame: navigate, apply the display toggle or selection
 * the scene declares, then hand off to the stabilisation gate. Each wait prevents a race that
 * gives a wrong baseline, and its comment names the race.
 */

import {
  CANVAS_WAIT_MS,
  clearDiagnostics,
  describeFailedRequests,
  errorReport,
  loggedErrors,
  openScene,
  showDisplayOverlay,
  FIT_QUIESCENCE_MS,
  settleCanvas,
} from '../previewServer.mjs';
import { pausePlayer, seekPlayer } from './seekAnimation.mjs';
import { applySceneWrites, selectThroughConsole } from '../sceneWrites.mjs';

/** Most scenes open in a few seconds, so a longer open is logged with its share of the canvas wait. */
const SLOW_OPEN_MS = 10000;

/** The line that logs a slow open against `CANVAS_WAIT_MS`, or null for an open under `SLOW_OPEN_MS`. */
export function slowCanvasLine(sceneName, openMs) {
  if (openMs < SLOW_OPEN_MS) return null;
  const share = Math.round((openMs / CANVAS_WAIT_MS) * 100);
  const seconds = (openMs / 1000).toFixed(1);
  return `[visual]   ${sceneName}: opened in ${seconds} s, ${share} % of the ${CANVAS_WAIT_MS / 1000} s canvas wait`;
}

/**
 * `reason` with the requests the page lost, so a scene that never loads names the chunk or file
 * that failed. A failed request leaves no console error when its caller waits on it for good.
 */
function withFailedRequests(reason, { failedRequests }) {
  if (failedRequests.length === 0) return reason;
  return `${reason}; failed requests: ${describeFailedRequests(failedRequests)}`;
}

/** The query parameters a scene opens the previewer with, beside its fixture. */
export function sceneQuery(scene) {
  return { camera: scene.camera, litSurface: scene.litSurface, canvasItem: scene.canvasItem };
}

/**
 * Navigates to a scene and captures its target after two byte-identical screenshots. Returns the
 * PNG buffer, or null with a reason when the scene never settles or logs a console error.
 * `pageState` is the page the scene captures on (see `pagePool.mjs`).
 */
export async function captureScene(pageState, baseUrl, scene) {
  const canvas2D = scene.mode === '2d';
  const { page, diagnostics } = pageState;
  clearDiagnostics(diagnostics);

  // A silent stalled resource chain would become a baseline, so it is logged.
  const openedAt = performance.now();
  const { target: canvas, reason: canvasReason } = await openScene(page, baseUrl, scene.file, {
    canvas2D,
    ...sceneQuery(scene),
    onSlow: (ms) => console.log(`[visual]   ${scene.name}: no network idle within ${ms}ms`),
  });
  const waitLine = slowCanvasLine(scene.name, performance.now() - openedAt);
  if (waitLine) console.log(waitLine);
  if (!canvas) return { buffer: null, reason: withFailedRequests(canvasReason, diagnostics) };

  try {
    await applySceneWrites(page, scene.hostCalls);
  } catch (error) {
    return { buffer: null, reason: withFailedRequests(`scene writes: ${error.message}`, diagnostics) };
  }

  if (scene.navigation) {
    // The navmesh overlay defaults on, but is set explicitly, so the baseline rests on no default.
    const reason = await showDisplayOverlay(page, 'Navigation');
    if (reason) return { buffer: null, reason: withFailedRequests(reason, diagnostics) };
  }

  if (scene.collisions) {
    // "Visible Collision Shapes" is off by default (ADR-0005/0006), so every other golden hides a
    // CollisionShape gizmo.
    const reason = await showDisplayOverlay(page, 'Collisions');
    if (reason) return { buffer: null, reason: withFailedRequests(reason, diagnostics) };
  }

  // A real tree selection makes a selected-only gizmo (PathFollow, light helpers, ADR-0056) render,
  // through the whole tree-click, SelectionContext, NodeDispatcher and useGizmoState path.
  if (scene.select) {
    // Expand the whole tree so nested nodes are reachable, then click the row.
    await page.locator('[aria-label="Expand all"]').click();
    const row = page.locator(`[data-node-path="${scene.select}"] [role="treeitem"]`).first();
    try {
      await row.waitFor({ timeout: 10000 });
    } catch {
      const reason = `select target not found in tree: ${scene.select}`;
      return { buffer: null, reason: withFailedRequests(reason, diagnostics) };
    }
    // After CameraFit's fit timers (150/500/1100 ms after mount) have all fired: a click before the
    // last one lets it see the new gizmo and widen the frame, and host load picks the winner. The
    // row renders from the state that starts those timers, so this wait from it spends them all.
    // Selection never moves the camera (CameraFit in packages/textscene-core/src/r3f/TscnCanvas.tsx).
    await page.waitForTimeout(FIT_QUIESCENCE_MS);
    await row.click();
    // `.click()` hovers the row first and leaves its hover highlight on, so the pointer moves off
    // the tree and only the selection renders.
    await page.mouse.move(0, 0);
  }

  // A node the Scene dock does not list, such as one inside a plain instance, has no row to click.
  if (scene.consoleSelect) {
    await page.waitForTimeout(FIT_QUIESCENCE_MS);
    try {
      await selectThroughConsole(page, scene.consoleSelect);
    } catch (error) {
      return { buffer: null, reason: withFailedRequests(`console select: ${error.message}`, diagnostics) };
    }
  }

  // The pose at `animationTime` on the selected AnimationPlayer's first clip, which Godot's
  // `seek` reaches too. A stopped player shows the rest pose, so only a seek puts a clip on screen.
  if (scene.animationTime !== undefined) {
    await pausePlayer(page);
    await seekPlayer(page, scene.animationTime);
    await page.mouse.move(0, 0);
  }

  const result = await settleCanvas(page, canvas, { screenshotTimeout: scene.settleTimeout });
  if (!result.buffer) return { ...result, reason: withFailedRequests(result.reason, diagnostics) };
  if (loggedErrors(diagnostics).length > 0) {
    // A console error in a settled, plausible capture is still a broken render: pixels cannot see a
    // swallowed resource failure that leaves the previous frame on screen.
    return {
      buffer: null,
      reason: `console error(s) logged during capture: ${errorReport(diagnostics)}`,
      status: 'console-error',
    };
  }
  return result;
}
