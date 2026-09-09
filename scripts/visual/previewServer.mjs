/**
 * Build-and-serve lifecycle for the previewer, shared by every harness that
 * captures from a real browser: the visual-regression gate (`run.mjs`) and the
 * parity capture (`scripts/godot-ref/capture-ours.mjs`).
 *
 * Extracted rather than duplicated because the hard-won parts here are the
 * failure modes, not the happy path — a stale `dist/`, a foreign server on the
 * port, and an orphaned `vite preview` grandchild each produce a harness that
 * reports success while measuring the wrong thing. A second copy would drift
 * out of those protections silently.
 *
 * This file is the harness-facing surface; the pieces live in `preview/`:
 * `webBuild` (build + staleness), `server` (port, spawn, kill, wait),
 * `appContract` (the app's own keys, testids and capture frames),
 * `captureContext` (the chrome-free browser context), `viewportProbes` (asking
 * the app what it opened) and `capture` (one settled frame). Import from here,
 * so a consumer never depends on which of them owns a given helper.
 */

export { REPO_ROOT } from './preview/paths.mjs';
export { assertWebBuildFresh, ensureWebBuilt } from './preview/webBuild.mjs';
export {
  assertPortFree,
  killPreviewGroup,
  registerPreviewGroupTeardown,
  startPreview,
  waitForServer,
} from './preview/server.mjs';
export {
  CANVAS_2D_CAPTURE,
  CANVAS_2D_TESTIDS,
  CANVAS_CAPTURE,
  FIT_ON_OPEN_2D_STORAGE_KEY,
  NETWORK_IDLE_MS,
  SETTLE_INITIAL_MS,
  SETTLE_INTERVAL_MS,
  SETTLE_MAX_ATTEMPTS,
  SETTLE_SIM_SECONDS,
  VIEWPORT,
  VIEWPORT_MODE_STORAGE_KEY,
} from './preview/appContract.mjs';
export { createCaptureContext, warmUpGLContext } from './preview/captureContext.mjs';
export {
  findCanvas2DFrame,
  readViewportMode,
  setDisplayToggle,
} from './preview/viewportProbes.mjs';
export {
  findCanvas,
  findCaptureTarget,
  gotoFixture,
  isUniformImage,
  settleCanvas,
  writeCaptureImage,
} from './preview/capture.mjs';
