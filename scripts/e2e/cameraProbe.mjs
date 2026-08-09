/**
 * Camera-invariance probe: proves "the camera never moves on selection"
 * (Atle's product rule — auto-fit is load-time only, regressed once and
 * reverted) by reading the ACTUAL matrix three.js uploads to the GPU for the
 * viewport camera, before and after a tree selection, entirely from OUTSIDE
 * the app.
 *
 * There is no app-level hook to ask "what is the camera's world matrix" —
 * adding one would be a production test seam, which the brief for this gate
 * asks to avoid. Instead this patches `WebGL(2)RenderingContext.prototype`
 * (a global the page cannot see or influence) via Playwright's
 * `addInitScript`, the same mechanism `scripts/vscode/driveScene.mjs` uses to
 * force `preserveDrawingBuffer` for its own canvas readback.
 *
 * Why `viewMatrix` specifically: three.js's `WebGLProgram` (see
 * `node_modules/three/src/renderers/webgl/WebGLProgram.js`) prefixes EVERY
 * compiled shader — vertex and fragment, built-in or custom — with
 * `uniform mat4 viewMatrix;`, and `WebGLRenderer.setProgram` uploads it via
 * `p_uniforms.setValue(gl, 'viewMatrix', camera.matrixWorldInverse)` for every
 * program switch. That upload becomes a real `gl.uniformMatrix4fv` call whose
 * bytes ARE `camera.matrixWorldInverse.elements` — an exact, unmodified read
 * of the viewport camera's world transform (inverted; the two are related by
 * a fixed invertible map, so byte-identity of one is byte-identity of the
 * other). Shadow-map passes upload their OWN light-camera `viewMatrix` first,
 * but the main colour pass always renders last within a completed frame, so
 * sampling after a settle always finds the viewport camera's value.
 */

/* global window, document, WebGLRenderingContext, WebGL2RenderingContext */
// Both globals exist only inside the browser this function is serialised
// into via Playwright's `addInitScript` — never in this Node process.

/**
 * Installed via `context.addInitScript(installViewMatrixProbe)`, BEFORE the
 * app's own scripts run. Must be self-contained (no closures over this
 * module's scope survive `Function.prototype.toString` serialisation).
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

  // The viewport's own GL canvas is the largest on the page — offscreen
  // passes (icon atlases, render-to-texture surfaces) mount their own small
  // canvases. Same heuristic `scripts/vscode/driveScene.mjs`'s
  // `readCanvasDataUrl` uses to pick the canvas to read back.
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
 * Exact (byte-for-byte, given both sides are plain finite numbers cloned from
 * the same `Float32Array` layout) equality of two 16-element view matrices.
 * `Object.is` rather than `===` only to make the "what counts as equal" rule
 * explicit — the values here are never `-0`/`NaN` in practice.
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
