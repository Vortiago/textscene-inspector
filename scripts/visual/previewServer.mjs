/**
 * The previewer's build-and-serve lifecycle, shared by the visual gate (`run.mjs`) and the parity
 * capture (`scripts/godot-ref/capture-ours.mjs`): a stale `dist/`, a foreign server on the port or
 * an orphaned `vite preview` each report success while measuring the wrong thing. Import from
 * here, so a consumer never depends on which `preview/` module owns a helper.
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
  canvas2DViewportFor,
  CANVAS_2D_CAPTURE,
  CANVAS_2D_CHROME,
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
