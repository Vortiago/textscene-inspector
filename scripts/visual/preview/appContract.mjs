/**
 * What the harnesses know about the APP, as opposed to about the browser: the
 * localStorage keys the shell reads, the toolbar's testids, the capture frames
 * and CameraFit's load-time timers.
 *
 * A second copy of these does not fail when the app changes — it silently
 * measures the wrong pixels (the toolbar composited into a probe, or a frame
 * captured before the camera settled), which is the worst failure a parity tool
 * can have. Both harnesses share them for that reason.
 */

/** `tscn-web-source-pane` in apps/textscene-web/src/r3f-main.tsx. */
export const SOURCE_PANE_STORAGE_KEY = 'tscn-web-source-pane';
/** `FRAME_ON_OPEN_STORAGE_KEY` in r3f/contexts/ViewportModeContext.tsx. */
export const FRAME_ON_OPEN_STORAGE_KEY = 'tsi.frameOnOpen';
/**
 * `FIT_ON_OPEN_2D_STORAGE_KEY` in r3f/components/Canvas2DStage/viewport2d.ts.
 * Exported so a test can pin it to that one: a key that stops matching leaves
 * the stage fitting the scene again, which still captures a picture — just not
 * the one the Godot frame can be compared with.
 */
export const FIT_ON_OPEN_2D_STORAGE_KEY = 'tsi.fitOnOpen2D';
/**
 * `VIEWPORT_MODE_STORAGE_KEY` in r3f/contexts/ViewportModeContext.tsx — the
 * user's own workspace preference, which `WorkspaceAutoSelect` overrides only
 * when the scene ROOT claims a workspace. A `Node`-rooted 2D scene
 * (`game_splitscreen.tscn`: Node → ColorRect → SubViewportContainers) claims
 * neither, exactly as in Godot's editor, so without this a 2D capture of one
 * opens in the 3D workspace and finds no stage to shoot.
 */
export const VIEWPORT_MODE_STORAGE_KEY = 'tsi.viewportMode';

export const VIEWPORT = { width: 1280, height: 800 };

/**
 * The 2D capture frame: Godot's project viewport (`CANVAS_2D_WIDTH/HEIGHT` in
 * `viewport2d.ts`), which is the rectangle the previewer's 2D stage draws and
 * the one a Control resolves its anchors against. Both sides render it 1:1 —
 * the Godot harness through a SubViewport of this size, ours by clipping the
 * stage's frame at zoom 1 — so a 2D pair compares pixel for pixel.
 *
 * `clearColor` is Godot's `rendering/environment/defaults/default_clear_color`
 * default, and `background` is what it MEASURES as in a 2D render (2D composites
 * in sRGB, so the 0.3 lands as byte 76 with no transfer applied). Our stage
 * paints its own editor background, so the capture flattens it to that same
 * grey — otherwise every transparent pixel of the scene would differ.
 *
 * `viewport` is the browser viewport a 2D capture needs: the frame must fit
 * INSIDE the stage at zoom 1, and the stage is what remains of the window after
 * the shell's dock (325px) and top bar (44px).
 */
export const CANVAS_2D_CAPTURE = {
  width: 1152,
  height: 648,
  clearColor: [0.3, 0.3, 0.3],
  background: '#4c4c4c',
  viewport: { width: 1600, height: 900 },
};

/** The 2D stage's chrome, painted out for a capture (see `createCaptureContext`). */
export const CANVAS_2D_TESTIDS = {
  stage: 'canvas-2d-stage',
  frame: 'canvas-2d-frame',
  captureFrame: 'canvas-2d-capture-frame',
  zoom: 'canvas-2d-zoom',
  originAxisX: 'origin-axis-x',
  originAxisY: 'origin-axis-y',
};

/**
 * The size of the canvas ELEMENT inside that viewport, once the shell's chrome
 * has taken its share — i.e. the size `canvas.screenshot()` returns.
 *
 * Measured, not derived: it falls out of the app's CSS layout. It lives here so
 * the Godot harness can default to the same frame, which is what makes a probe
 * at (x, y) address the same surface point on both sides with no arguments.
 * Changing VIEWPORT above means re-measuring this.
 */
export const CANVAS_CAPTURE = { width: 955, height: 756 };
export const NETWORK_IDLE_MS = 20000; // ceiling for the app's own resource chain to go quiet
export const SETTLE_INITIAL_MS = 1200; // covers the last CameraFit reframe at 1100 ms
export const SETTLE_INTERVAL_MS = 350;
export const SETTLE_MAX_ATTEMPTS = 12;
