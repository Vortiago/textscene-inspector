/** The web-app E2E gate's checks on a scene's canvas: its size, its ink and its workspace. */

// Far below a passing 2D sprite scene (~8k to ~28k ink px on a 631x756 canvas), as in
// `scripts/vscode/webview-csp-gate.mjs`: nothing drawn reads as 0 on any display, so the
// floor only clears noise.
export const INK_FLOOR_2D = 4000;

// three.js catches a failed WebGL context and never resizes the canvas from the
// browser's 300x150, above the >50 floor `scripts/vscode/driveScene.mjs` uses.
// This canvas fills most of a 1280x800 viewport (~631x756), so 400 splits them.
const MIN_SIZED_CANVAS_DIMENSION = 400;

/** Sized canvas, checked apart from ink: a dead GL context reads 0 ink too. */
export function checkSizedCanvas(gate, label, dims) {
  gate.check(
    dims.width > MIN_SIZED_CANVAS_DIMENSION && dims.height > MIN_SIZED_CANVAS_DIMENSION,
    `${label} canvas never produced a properly sized surface (${dims.width}x${dims.height}): WebGL ` +
      'context creation likely failed (three.js leaves the canvas at its unsized 300x150 default), ' +
      'so the ink check below says nothing'
  );
}

/** `ink` is the `inkStats` of the settled frame, or `null` when the canvas never settled. */
export function checkInk(gate, label, ink, floor) {
  gate.check(!!ink, `${label} canvas never settled, so it was never screenshotted for an ink count`);
  if (ink) {
    gate.check(
      ink.inkPixels >= floor,
      `${label} only ${ink.inkPixels} ink pixels on a ${ink.width}x${ink.height} canvas, floor is ` +
        `${floor}, so nothing rendered`
    );
  }
}

export function checkStage(gate, label, actual, expected) {
  gate.check(actual === expected, `${label} opened in the "${actual}" workspace, expected "${expected}"`);
}
