/**
 * Proves the camera never moves on selection by reading the `viewMatrix`
 * three.js uploads, from outside the app: a patch on
 * `WebGL(2)RenderingContext.prototype` through `addInitScript`, as
 * `scripts/vscode/driveScene.mjs` does, so no production file carries a hook.
 */

/* global window, document, WebGLRenderingContext, WebGL2RenderingContext */
// These globals exist only in the browser this function is serialised into.

/**
 * Installed with `context.addInitScript(installViewMatrixProbe)` before the
 * app's scripts run. Self-contained, since no closure over this module survives
 * `Function.prototype.toString` serialisation.
 */
export function installViewMatrixProbe() {
  const byCanvas = new WeakMap();
  window.__tscnCameraProbe = { byCanvas };

  function patch(proto) {
    if (!proto) return;
    const viewMatrixLocations = new WeakSet();
    const originalGetUniformLocation = proto.getUniformLocation;
    proto.getUniformLocation = function patchedGetUniformLocation(program, name) {
      const location = originalGetUniformLocation.call(this, program, name);
      if (location && name === 'viewMatrix') viewMatrixLocations.add(location);
      return location;
    };
    // three.js uploads `camera.matrixWorldInverse` to every shader's `viewMatrix`,
    // and byte-identity of the inverse is byte-identity of the camera. Shadow
    // passes upload their own first, but the main colour pass renders last, so a
    // settled frame holds the viewport camera's value.
    const originalUniformMatrix4fv = proto.uniformMatrix4fv;
    proto.uniformMatrix4fv = function patchedUniformMatrix4fv(location, transpose, value, ...rest) {
      if (location && this.canvas && viewMatrixLocations.has(location)) {
        const entry = byCanvas.get(this.canvas) ?? { updates: 0, matrix: null };
        entry.matrix = Array.from(value).slice(0, 16);
        entry.updates += 1;
        byCanvas.set(this.canvas, entry);
      }
      return originalUniformMatrix4fv.call(this, location, transpose, value, ...rest);
    };
  }

  patch(typeof WebGLRenderingContext !== 'undefined' ? WebGLRenderingContext.prototype : undefined);
  patch(typeof WebGL2RenderingContext !== 'undefined' ? WebGL2RenderingContext.prototype : undefined);

  // The viewport's GL canvas is the largest on the page: offscreen passes mount
  // small ones. The same heuristic as `readCanvasDataUrl` in
  // `scripts/vscode/driveScene.mjs`.
  window.__tscnReadViewMatrix = function tscnReadViewMatrix() {
    let best = null;
    for (const canvas of document.querySelectorAll('canvas')) {
      const entry = byCanvas.get(canvas);
      if (!entry) continue;
      const area = canvas.width * canvas.height;
      if (!best || area > best.area) best = { area, canvas, entry };
    }
    if (!best) return null;
    return {
      matrix: best.entry.matrix,
      updates: best.entry.updates,
      width: best.canvas.width,
      height: best.canvas.height,
    };
  };
}

/**
 * Exact equality of two 16-element view matrices cloned from the same
 * `Float32Array` layout. `Object.is` states the equality rule explicitly.
 */
export function matricesEqual(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== 16 || b.length !== 16) return false;
  return a.every((value, index) => Object.is(value, b[index]));
}

/** Fixed-precision one-line rendering for a failure message. */
export function formatMatrix(matrix) {
  if (!Array.isArray(matrix)) return String(matrix);
  return `[${matrix.map((value) => value.toFixed(6)).join(', ')}]`;
}
