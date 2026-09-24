/**
 * What both harnesses know about the app: the shell's localStorage keys, the toolbar's testids,
 * the capture frames and CameraFit's load-time timers. A second copy would not fail when the app
 * changes: it would measure the wrong pixels, such as the toolbar composited into a probe.
 */

/** `tscn-web-source-pane` in apps/textscene-web/src/sourcePane.ts. */
export const SOURCE_PANE_STORAGE_KEY = 'tscn-web-source-pane';
/** `FRAME_ON_OPEN_STORAGE_KEY` in r3f/contexts/ViewportModeContext.tsx. */
export const FRAME_ON_OPEN_STORAGE_KEY = 'tsi.frameOnOpen';
/**
 * `FIT_ON_OPEN_2D_STORAGE_KEY` in r3f/components/Canvas2DStage/viewport2d.ts, exported so a test
 * pins it: a key that stops matching lets the stage fit the scene again, and the capture no longer
 * matches the Godot frame.
 */
export const FIT_ON_OPEN_2D_STORAGE_KEY = 'tsi.fitOnOpen2D';
/**
 * `VIEWPORT_MODE_STORAGE_KEY` in r3f/contexts/ViewportModeContext.tsx: the workspace preference,
 * which `WorkspaceAutoSelect` overrides only when the scene root claims a workspace. A `Node`-rooted
 * 2D scene (`game_splitscreen.tscn`) claims neither, as in Godot's editor, so without it a 2D
 * capture opens in the 3D workspace.
 */
export const VIEWPORT_MODE_STORAGE_KEY = 'tsi.viewportMode';

export const VIEWPORT = { width: 1280, height: 800 };

/**
 * The 2D capture frame: Godot's project viewport (`CANVAS_2D_WIDTH/HEIGHT` in `viewport2d.ts`),
 * the rectangle a Control anchors to. Godot renders it through a SubViewport of this size, and
 * ours clips the stage's frame at zoom 1, so a 2D pair compares pixel for pixel.
 */
export const CANVAS_2D_CAPTURE = {
  width: 1152,
  height: 648,
  // Godot's `rendering/environment/defaults/default_clear_color` default.
  clearColor: [0.3, 0.3, 0.3],
  // The clear colour as a 2D render measures it: 2D composites in sRGB, so 0.3 lands as byte 76.
  // The capture flattens our stage's editor background to it, or every transparent pixel differs.
  background: '#4c4c4c',
  // The frame fits inside the stage at zoom 1: the window minus the dock and the top bar.
  viewport: { width: 1600, height: 900 },
};

/** What the shell's dock and top bar take out of the window before the stage. */
export const CANVAS_2D_CHROME = { width: 325, height: 44 };

/**
 * The browser window a 2D capture of a frame this size needs. The stage lays the project rect out
 * at 1:1, so a larger one hangs past its edge (1280x720 misses by five pixels). It never shrinks
 * below the default, which the committed 2D goldens were captured through.
 */
export function canvas2DViewportFor(frame) {
  const { width, height } = CANVAS_2D_CAPTURE.viewport;
  if (!frame) return { width, height };
  return {
    width: Math.max(width, Math.ceil(frame.width) + CANVAS_2D_CHROME.width),
    height: Math.max(height, Math.ceil(frame.height) + CANVAS_2D_CHROME.height),
  };
}

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
 * The canvas element's size inside VIEWPORT after the shell's chrome, as `canvas.screenshot()`
 * returns it. Measured from the CSS layout, so a change to VIEWPORT means a new measurement. The
 * Godot harness defaults to it, so a probe at (x, y) addresses the same point on both sides.
 */
export const CANVAS_CAPTURE = { width: 955, height: 756 };
export const NETWORK_IDLE_MS = 20000; // Ceiling for the app's own resource chain to go quiet.
export const SETTLE_INITIAL_MS = 1200; // Covers the last CameraFit reframe at 1100 ms.
// Convergence, the frames until the picture stops changing, may differ per side: Godot steps a
// fixed count of process frames, and ours captures until two are byte-identical.
export const SETTLE_INTERVAL_MS = 350;
export const SETTLE_MAX_ATTEMPTS = 12;

/**
 * The settle contract: the instant on the scene's simulated clock, in seconds, at which both
 * harnesses open the shutter (`scripts/godot-ref/run.mjs` reads it too). The previewer runs no
 * simulated clock (ADR-0011, ADR-0012), so only its load instant exists, and Godot matches it by
 * pausing the SceneTree before it instantiates the scene. Both sides refuse a non-zero value.
 */
export const SETTLE_SIM_SECONDS = 0;
// A non-zero value needs a driveable elapsed-time hook in the previewer, which has no physics, no
// GDScript and no wall clock. Two sides at different instants disagree and neither harness fails.
