/**
 * The previewer's build-and-serve lifecycle, shared by the visual gate (`run.mjs`) and the parity
 * capture (`scripts/godot-ref/capture-ours.mjs`): a stale `dist/`, a foreign server on the port or
 * an orphaned `vite preview` each report success while measuring the wrong thing. Import from
 * here, so a consumer never depends on which `preview/` module owns a helper. It re-exports only
 * what a harness imports. A test imports from the owning module.
 */

export { REPO_ROOT } from './preview/paths.mjs';
export { assertPortFree } from './preview/server.mjs';
export { previewPort } from './preview/ports.mjs';
export {
  CANVAS_2D_CAPTURE,
  CANVAS_CAPTURE,
  PERFORMANCE_TESTIDS,
  SETTLE_SIM_SECONDS,
  TEXTURE_WORK_STATUS_TESTID,
  TEXTURE_WORK_WAIT_MS,
  VIEWPORT,
} from './preview/appContract.mjs';
export { createCaptureContext, installStyle, paintedOutChromeCss } from './preview/captureContext.mjs';
export { attachDiagnostics, clearDiagnostics, loggedErrors } from './preview/pageDiagnostics.mjs';
export { readViewportMode, setDisplayToggle } from './preview/viewportProbes.mjs';
export { withPreviewBrowser } from './preview/session.mjs';
export { targetShooter } from './preview/targetShot.mjs';
export {
  findCanvas,
  findCaptureTarget,
  gotoFixture,
  isUniformImage,
  openScene,
  sceneStillLoading,
  settleCanvas,
  writeCaptureImage,
} from './preview/capture.mjs';
