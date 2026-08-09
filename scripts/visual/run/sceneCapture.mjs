/**
 * One golden scene, driven to its settled frame: navigate, apply whatever
 * display toggle or selection the scene declares, then hand off to the
 * stabilization gate.
 *
 * Every wait in here is load-bearing against a race that has produced a wrong
 * baseline before; the comments say which.
 */

import {
  findCanvas,
  gotoFixture,
  setDisplayToggle,
  settleCanvas,
} from '../previewServer.mjs';

// Strictly greater than CameraFit's last load-time fit timer (1100ms after
// the scene mounts), with a comfortable margin for render-loop latency under
// host contention. See the wait in `captureScene`.
const PRE_SELECT_FIT_QUIESCENCE_MS = 1500;

/**
 * Navigate to a scene and capture the canvas once it is provably settled:
 * two consecutive byte-identical screenshots. Returns the PNG buffer, or
 * null with a reason when the scene never stabilizes.
 *
 * When `scene.select` is set, the harness drives a real tree selection first
 * (expand the tree, click that node's row) so a selection-gated gizmo
 * (Marker/Path/PathFollow, ADR-0018) renders — exercising the full
 * tree-click → SelectionContext → NodeDispatcher → useGizmoVisible path in the
 * browser, not just the component's gating logic in isolation.
 */
export async function captureScene(page, baseUrl, scene) {
  // Silence here is how a stalled resource chain becomes a baseline, so say so.
  await gotoFixture(page, baseUrl, scene.file, (ms) =>
    console.log(`[visual]   ${scene.name}: no network idle within ${ms}ms`)
  );
  const { canvas, reason: canvasReason } = await findCanvas(page);
  if (!canvas) return { buffer: null, reason: canvasReason };

  if (scene.navigation) {
    // The navmesh overlay defaults ON, but drive it explicitly so the scene's
    // state does not depend on a default a future change could flip out from
    // under the baseline.
    const reason = await setDisplayToggle(page, 'Navigation', true);
    if (reason) return { buffer: null, reason };
    await page.waitForTimeout(PRE_SELECT_FIT_QUIESCENCE_MS);
    await page.mouse.move(0, 0);
  }

  if (scene.collisions) {
    // "Visible Collision Shapes" is OFF by default (ADR-0005/0006), so a
    // CollisionShape gizmo is invisible to every other golden — which is how
    // capsule/sphere/cylinder shapes drew a unit box unnoticed.
    const reason = await setDisplayToggle(page, 'Collisions', true);
    if (reason) return { buffer: null, reason };
    // Let CameraFit's load-time timers finish before changing what is on
    // screen, and take the pointer off the toolbar so no hover is captured.
    await page.waitForTimeout(PRE_SELECT_FIT_QUIESCENCE_MS);
    await page.mouse.move(0, 0);
  }

  if (scene.select) {
    // Expand the whole tree so nested nodes are reachable, then click the row.
    await page.locator('[aria-label="Expand all"]').click();
    const row = page.locator(`[data-node-path="${scene.select}"] [role="treeitem"]`).first();
    try {
      await row.waitFor({ timeout: 10000 });
    } catch {
      return { buffer: null, reason: `select target not found in tree: ${scene.select}` };
    }
    // Click only after CameraFit's load-time fit timers (150/500/1100ms after
    // the scene mounts) have ALL fired. Selection never moves the camera (by
    // design; see CameraFit in packages/textscene-core/src/r3f/TscnCanvas.tsx),
    // so a click that lands BEFORE the 1100ms timer lets that timer see the
    // just-mounted gizmo and widen the frame, while a click AFTER it leaves
    // the tight pre-selection framing: two individually stable equilibria
    // whose winner depends on host load. The tree row's presence
    // above is our scene-ready signal: rows render from the same scene-graph
    // state whose arrival starts CameraFit's timers, so waiting comfortably
    // past the last timer from here guarantees the timers are spent and pins
    // every `-selected` capture to the single tight equilibrium.
    await page.waitForTimeout(PRE_SELECT_FIT_QUIESCENCE_MS);
    await row.click();
    // `.click()` moves the mouse over the row first, which fires a real
    // `mouseenter` and leaves that row's hover-highlight engaged (since the
    // mouse never moves away afterward) — an accidental artifact of driving
    // a real click, not something these `-selected` scenes intend to capture
    // (this harness exercises the selection path, per the doc comment above;
    // hover is a separate, untested-here affordance). Move the pointer off
    // the tree entirely so only true selection state renders.
    await page.mouse.move(0, 0);
  }

  return settleCanvas(page, canvas);
}
